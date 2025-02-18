package migrate

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
type migrationWorker struct {
	logger    logging.Logger
	target    repository.Repository
	legacy    legacy.LegacyMigrator
	client    *resources.DynamicClient // Read from
	namespace string

	progress jobs.JobProgressRecorder

	userInfo   map[string]repository.CommitSignature
	folderTree *resources.FolderTree

	options provisioning.MigrateJobOptions
}

func newMigrationWorker(ctx context.Context,
	target repository.Repository,
	options provisioning.MigrateJobOptions,
	client *resources.DynamicClient,
	progress jobs.JobProgressRecorder,
) *migrationWorker {
	if options.Prefix != "" {
		options.Prefix = safepath.Clean(options.Prefix)
	}
	return &migrationWorker{
		namespace:  target.Config().Namespace,
		target:     target,
		logger:     logging.FromContext(ctx),
		progress:   progress,
		options:    options,
		client:     client,
		folderTree: resources.NewEmptyFolderTree(),
	}
}

func (w *migrationWorker) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	if w.userInfo == nil {
		return ctx
	}
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := w.userInfo[id] // lookup
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
