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
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type exportJob struct {
	logger logging.Logger
	target repository.Repository
	client *resources.DynamicClient // READY ONLY

	progress         jobs.ProgressFn
	progressInterval time.Duration
	progressLast     time.Time

	jobStatus        *provisioning.JobStatus
	folderSummary    provisioning.JobResourceSummary
	dashboardSummary provisioning.JobResourceSummary
}

func newExportJob(ctx context.Context, target repository.Repository, client *resources.DynamicClient, progress jobs.ProgressFn) *exportJob {
	return &exportJob{
		target:           target,
		client:           client,
		logger:           logging.FromContext(ctx),
		progress:         progress,
		progressLast:     time.Now(),
		progressInterval: time.Second * 10,

		jobStatus: &provisioning.JobStatus{
			State: provisioning.JobStateWorking,
		},
		folderSummary: provisioning.JobResourceSummary{
			Group:    folders.GROUP,
			Resource: folders.RESOURCE,
		},
		dashboardSummary: provisioning.JobResourceSummary{
			Group:    dashboard.GROUP,
			Resource: "dashboards",
		},
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

func (r *exportJob) run(ctx context.Context, options provisioning.ExportJobOptions) error {
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

	ref := options.Branch // only valid for git (defaults to the configured repo)
	if options.Prefix != "" {
		options.Prefix = safepath.Clean(options.Prefix)
	}

	// first create folders
	err = foldersTree.Walk(ctx, func(ctx context.Context, folder resources.Folder) error {
		p := folder.Path + "/"
		if options.Prefix != "" {
			p = options.Prefix + "/" + p
		}
		logger := logger.With("path", p)

		_, err = r.target.Read(ctx, p, ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.Error("failed to check if folder exists before writing", "error", err)
			return fmt.Errorf("failed to check if folder exists before writing: %w", err)
		} else if err == nil {
			logger.Info("folder already exists")
			r.folderSummary.Noop++
			return nil
		}

		// Create with an empty body will make a folder (or .keep file if unsupported)
		if err := r.target.Create(ctx, p, ref, nil, "export folder `"+p+"`"); err != nil {
			logger.Error("failed to write a folder in repository", "error", err)
			return fmt.Errorf("failed to write folder in repo: %w", err)
		}
		r.folderSummary.Create++
		logger.Debug("successfully exported folder")
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to write folders: %w", err)
	}
	status.Message = "writing dashboards..."
	r.maybeNotify(ctx)

	dashboardsClient := r.client.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v1alpha1",
		Resource: "dashboards",
	})

	// TODO: handle pagination
	dashboardList, err := dashboardsClient.List(ctx, metav1.ListOptions{Limit: 1000})
	if err != nil {
		return fmt.Errorf("failed to list dashboards: %w", err)
	}

	commitMessage := fmt.Sprintf("grafana export to: %s", targetRepoName)
	for _, item := range dashboardList.Items {
		if ctx.Err() != nil {
			logger.Debug("cancelling replication process due to ctx error", "error", err)
			return ctx.Err()
		}

		name := item.GetName()
		repoName := item.GetAnnotations()[apiutils.AnnoKeyRepoName]
		if repoName == r.target.Config().GetName() {
			logger.Info("skip dashboard since it is already in repository", "dashboard", name)
			continue
		}

		title, _, _ := unstructured.NestedString(item.Object, "spec", "title")
		if title == "" {
			title = name
		}
		folder := item.GetAnnotations()[apiutils.AnnoKeyFolder]

		// Get the absolute path of the folder
		fid, ok := foldersTree.DirPath(folder, "")
		if !ok {
			logger.Error("folder of item was not in tree of repository")
			return fmt.Errorf("folder of item was not in tree of repository")
		}

		delete(item.Object, "metadata")
		if options.Identifier {
			item.SetName(name) // keep the identifier in the metadata
		}

		body, err := json.MarshalIndent(item.Object, "", "  ")
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
		if options.Prefix != "" {
			fileName, err = safepath.Join(options.Prefix, fileName)
			if err != nil {
				return fmt.Errorf("error adding path prefix %s: %w", options.Prefix, err)
			}
		}

		// Write the file
		err = r.target.Write(ctx, fileName, ref, body, commitMessage)
		if err != nil {
			r.dashboardSummary.Error++
			logger.Error("failed to write a file in repository", "error", err)
			if len(r.dashboardSummary.Errors) < 20 {
				r.dashboardSummary.Errors = append(r.dashboardSummary.Errors, fmt.Sprintf("error writing: %s", fileName))
			}
		} else {
			r.dashboardSummary.Write++
		}
	}
	status.State = provisioning.JobStateSuccess
	status.Message = ""
	return nil
}
