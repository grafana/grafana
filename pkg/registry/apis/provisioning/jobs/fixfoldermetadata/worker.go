package fixfoldermetadata

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// Worker is a no-op placeholder for the fix-folder-metadata job type.
// It will be replaced by a full implementation that regenerates folder metadata files.
type Worker struct{}

func NewWorker() *Worker {
	return &Worker{}
}

func (w *Worker) IsSupported(_ context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionFixFolderMetadata
}

func (w *Worker) Process(ctx context.Context, _ repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	logger.Info("fixFolderMetadata job is a no-op placeholder — will be replaced by full implementation")

	progress.SetMessage(ctx, "fixFolderMetadata (no-op)")
	progress.SetFinalMessage(ctx, "fixFolderMetadata completed (no-op placeholder)")

	return nil
}
