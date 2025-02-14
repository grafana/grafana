package export

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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

	progress jobs.JobProgressRecorder

	userInfo   map[string]repository.CommitSignature
	folderTree *resources.FolderTree

	prefix         string // from options (now clean+safe)
	ref            string // from options (only git)
	keepIdentifier bool
	withHistory    bool
}

func newExportJob(ctx context.Context,
	target repository.Repository,
	options provisioning.ExportJobOptions,
	client *resources.DynamicClient,
	progress jobs.JobProgressRecorder,
) *exportJob {
	prefix := options.Prefix
	if prefix != "" {
		prefix = safepath.Clean(prefix)
	}
	return &exportJob{
		namespace:      target.Config().Namespace,
		target:         target,
		client:         client,
		logger:         logging.FromContext(ctx),
		progress:       progress,
		prefix:         prefix,
		ref:            options.Branch,
		keepIdentifier: options.Identifier,
		withHistory:    options.History,
		folderTree:     resources.NewEmptyFolderTree(),
	}
}

func (r *exportJob) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	if r.userInfo == nil {
		return ctx
	}
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := r.userInfo[id] // lookup
	if sig.Name == "" && sig.Email == "" {
		sig.Name = id
	}
	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}

	return repository.WithAuthorSignature(ctx, sig)
}
