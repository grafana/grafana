package export

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type exportJob struct {
	logger logging.Logger
	client *resources.DynamicClient // Read from
	target repository.Repository    // Write to

	progress         jobs.ProgressFn
	progressInterval time.Duration
	progressLast     time.Time
	foldersTree      *resources.FolderTree

	prefix         string // from options (now clean+safe)
	ref            string // from options (only git)
	keepIdentifier bool

	jobStatus *provisioning.JobStatus
	summary   map[string]*provisioning.JobResourceSummary
}

func newExportJob(ctx context.Context,
	target repository.Repository,
	options provisioning.ExportJobOptions,
	client *resources.DynamicClient,
	progress jobs.ProgressFn,
) *exportJob {
	prefix := options.Prefix
	if prefix != "" {
		prefix = safepath.Clean(prefix)
	}
	return &exportJob{
		target:           target,
		client:           client,
		logger:           logging.FromContext(ctx),
		progress:         progress,
		progressLast:     time.Now(),
		progressInterval: time.Second * 10,

		prefix:         prefix,
		ref:            options.Branch,
		keepIdentifier: options.Identifier,

		jobStatus: &provisioning.JobStatus{
			State: provisioning.JobStateWorking,
		},
		summary: make(map[string]*provisioning.JobResourceSummary),
	}
}

// Convert git changes into resource file changes
func (r *exportJob) maybeNotify(ctx context.Context) {
	if time.Since(r.progressLast) > r.progressInterval {
		err := r.progress(ctx, *r.jobStatus)
		if err != nil {
			r.logger.Warn("unable to send progress", "err", err)
		}
	}
}

func (r *exportJob) getSummary(gr schema.GroupResource) *provisioning.JobResourceSummary {
	summary, ok := r.summary[gr.String()]
	if !ok {
		summary = &provisioning.JobResourceSummary{
			Group:    gr.Group,
			Resource: gr.Resource,
		}
		r.summary[gr.String()] = summary
	}
	return summary
}

func (r *exportJob) run(ctx context.Context) error {
	logger := r.logger
	targetRepoName := r.target.Config().Name
	status := provisioning.JobStatus{
		State: provisioning.JobStateWorking,
	}
	status.Message = fmt.Sprintf("reading folder tree")
	foldersTree, err := readFolders(ctx, r.client.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	}), targetRepoName)

	summary := r.getSummary(schema.GroupResource{
		Group:    folders.GROUP,
		Resource: folders.RESOURCE,
	})

	// first create folders
	// TODO! this should not be necessary if writing to a path also makes the parents
	err = foldersTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path + "/"
		if r.prefix != "" {
			p = r.prefix + "/" + p
		}
		logger := logger.With("path", p)

		_, err = r.target.Read(ctx, p, r.ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Error("failed to check if folder exists before writing", "error", err)
			return fmt.Errorf("failed to check if folder exists before writing: %w", err)
		} else if err == nil {
			logger.Info("folder already exists")
			summary.Noop++
			return nil
		}

		// Create with an empty body will make a folder (or .keep file if unsupported)
		if err := r.target.Create(ctx, p, r.ref, nil, "export folder `"+p+"`"); err != nil {
			logger.Error("failed to write a folder in repository", "error", err)
			return fmt.Errorf("failed to write folder in repo: %w", err)
		}
		summary.Create++
		logger.Debug("successfully exported folder")
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to write folders: %w", err)
	}
	r.foldersTree = foldersTree

	status.Message = "writing dashboards..."
	r.maybeNotify(ctx)

	dashboardsClient := r.client.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v1alpha1",
		Resource: "dashboards",
	})

	summary = r.getSummary(schema.GroupResource{
		Group:    "dashboard.grafana.app",
		Resource: "dashboards",
	})

	// TODO: handle pagination
	dashboardList, err := dashboardsClient.List(ctx, metav1.ListOptions{Limit: 1000})
	if err != nil {
		return fmt.Errorf("failed to list dashboards: %w", err)
	}
	for _, item := range dashboardList.Items {
		if err = r.add(ctx, summary, &item); err != nil {
			return err
		}
	}
	status.State = provisioning.JobStateSuccess
	status.Message = ""
	return nil
}

func (r *exportJob) add(ctx context.Context, summary *provisioning.JobResourceSummary, obj *unstructured.Unstructured) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	item, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	commitMessage := item.GetMessage()
	name := item.GetName()
	repoName := item.GetRepositoryName()
	if repoName == r.target.Config().GetName() {
		r.logger.Info("skip dashboard since it is already in repository", "dashboard", name)
		return nil
	}

	title := item.FindTitle("")
	if title == "" {
		title = name
	}
	folder := item.GetAnnotations()[apiutils.AnnoKeyFolder]

	// Get the absolute path of the folder
	fid, ok := r.foldersTree.DirPath(folder, "")
	if !ok {
		logger.Error("folder of item was not in tree of repository")
		return fmt.Errorf("folder of item was not in tree of repository")
	}

	delete(obj.Object, "metadata")
	if r.keepIdentifier {
		item.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName, err = safepath.Join(fid.Path, fileName)
		if err != nil {
			return fmt.Errorf("error adding file path %s: %w", title, err)
		}
	}
	if r.prefix != "" {
		fileName, err = safepath.Join(r.prefix, fileName)
		if err != nil {
			return fmt.Errorf("error adding path prefix %s: %w", r.prefix, err)
		}
	}

	// Write the file
	err = r.target.Write(ctx, fileName, r.ref, body, commitMessage)
	if err != nil {
		summary.Error++
		logger.Error("failed to write a file in repository", "error", err)
		if len(summary.Errors) < 20 {
			summary.Errors = append(summary.Errors, fmt.Sprintf("error writing: %s", fileName))
		}
	} else {
		summary.Write++
	}

	return nil
}
