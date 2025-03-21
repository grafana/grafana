package export

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// ExportJob holds all context for a running job
type exportJob struct {
	logger    logging.Logger
	client    *resources.ResourceClients // Read from
	target    repository.ReaderWriter    // Write to
	namespace string

	progress   jobs.JobProgressRecorder
	folderTree *resources.FolderTree

	path           string // from options (now clean+safe)
	ref            string // from options (only git)
	keepIdentifier bool
}

func newExportJob(ctx context.Context,
	target repository.ReaderWriter,
	options provisioning.ExportJobOptions,
	clients *resources.ResourceClients,
	progress jobs.JobProgressRecorder,
) *exportJob {
	return &exportJob{
		namespace:      target.Config().Namespace,
		target:         target,
		client:         clients,
		logger:         logging.FromContext(ctx),
		progress:       progress,
		path:           options.Path,
		ref:            options.Branch,
		keepIdentifier: options.Identifier,
		folderTree:     resources.NewEmptyFolderTree(),
	}
}
