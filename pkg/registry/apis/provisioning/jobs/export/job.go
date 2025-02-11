package export

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/k8sctx"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// ExportJob holds all context for a running job
type exportJob struct {
	logger    logging.Logger
	client    *resources.DynamicClient // Read from
	target    repository.Repository    // Write to
	legacy    legacy.LegacyMigrator
	namespace string

	progress         jobs.ProgressFn
	progressInterval time.Duration
	progressLast     time.Time
	foldersTree      *resources.FolderTree

	prefix         string // from options (now clean+safe)
	ref            string // from options (only git)
	keepIdentifier bool
	addAuthorInfo  bool
	withHistory    bool

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
		namespace:        target.Config().Namespace,
		target:           target,
		client:           client,
		logger:           logging.FromContext(ctx),
		progress:         progress,
		progressLast:     time.Now(),
		progressInterval: time.Second * 10,

		prefix:         prefix,
		ref:            options.Branch,
		keepIdentifier: options.Identifier,
		addAuthorInfo:  options.History,
		withHistory:    options.History,

		jobStatus: &provisioning.JobStatus{
			State: provisioning.JobStateWorking,
		},
		summary: make(map[string]*provisioning.JobResourceSummary),
	}
}

// Send progress messages to any listeners
func (r *exportJob) maybeNotify(ctx context.Context) {
	if time.Since(r.progressLast) > r.progressInterval {
		err := r.progress(ctx, *r.jobStatus)
		if err != nil {
			r.logger.Warn("unable to send progress", "err", err)
		}
	}
}

// Register summary information for a group/resource
func (r *exportJob) getSummary(gr schema.GroupResource) *provisioning.JobResourceSummary {
	summary, ok := r.summary[gr.String()]
	if !ok {
		summary = &provisioning.JobResourceSummary{
			Group:    gr.Group,
			Resource: gr.Resource,
		}
		r.summary[gr.String()] = summary
		r.jobStatus.Summary = append(r.jobStatus.Summary, summary)
	}
	return summary
}

func (r *exportJob) export(ctx context.Context, kind schema.GroupVersionResource) error {
	ctx, cancel, err := k8sctx.Fork(ctx)
	if err != nil {
		return err
	}
	defer cancel()

	r.jobStatus.Message = "Exporting " + kind.Resource + "..."
	r.maybeNotify(ctx)
	client := r.client.Resource(kind)
	summary := r.getSummary(kind.GroupResource())

	continueToken := ""
	for {
		list, err := client.List(ctx, metav1.ListOptions{Limit: 100, Continue: continueToken})
		if err != nil {
			return fmt.Errorf("error executing list: %w", err)
		}

		for _, item := range list.Items {
			if err = r.add(ctx, summary, &item); err != nil {
				return fmt.Errorf("error adding value: %w", err)
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return nil
}

func (r *exportJob) add(ctx context.Context, summary *provisioning.JobResourceSummary, obj *unstructured.Unstructured) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	r.maybeNotify(ctx)

	item, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	// Message from annotations
	commitMessage := item.GetMessage()
	if commitMessage == "" {
		g := item.GetGeneration()
		if g > 0 {
			commitMessage = fmt.Sprintf("Generation: %d", g)
		} else {
			commitMessage = "exported from grafana"
		}
	}

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
	folder := item.GetFolder()

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

	// Add the author in context (if available)
	ctx = r.withAuthorSignature(ctx, item)

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

func (r *exportJob) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	if !r.addAuthorInfo {
		return ctx
	}

	sig := repository.CommitSignature{
		Name: item.GetUpdatedBy(),
		When: item.GetCreationTimestamp().Time,
	}
	if sig.Name == "" {
		sig.Name = item.GetCreatedBy()
	}
	if sig.Name == "" {
		return ctx // no user info
	}
	// TODO: convert internal id to name+email
	updated, _ := item.GetUpdatedTimestamp()
	if updated != nil {
		sig.When = *updated
	}
	return repository.WithAuthorSignature(ctx, sig)
}
