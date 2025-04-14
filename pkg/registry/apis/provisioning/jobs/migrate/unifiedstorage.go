package migrate

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

//go:generate mockery --name WrapWithCloneFn --structname MockWrapWithCloneFn --inpackage --filename mock_wrap_with_clone_fn.go --with-expecter
type WrapWithCloneFn func(ctx context.Context, repo repository.Repository, cloneOptions repository.CloneOptions, pushOptions repository.PushOptions, fn func(repo repository.Repository, cloned bool) error) error

type UnifiedStorageMigrator struct {
	namespaceCleaner NamespaceCleaner
	exportWorker     jobs.Worker
	syncWorker       jobs.Worker
}

func NewUnifiedStorageMigrator(
	namespaceCleaner NamespaceCleaner,
	exportWorker jobs.Worker,
	syncWorker jobs.Worker,
) *UnifiedStorageMigrator {
	return &UnifiedStorageMigrator{
		namespaceCleaner: namespaceCleaner,
		exportWorker:     exportWorker,
		syncWorker:       syncWorker,
	}
}

func (m *UnifiedStorageMigrator) Migrate(ctx context.Context, repo repository.ReaderWriter, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	namespace := repo.Config().GetNamespace()
	progress.SetMessage(ctx, "export resources")
	exportJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Push: &provisioning.ExportJobOptions{},
		},
	}
	if err := m.exportWorker.Process(ctx, repo, exportJob, progress); err != nil {
		return fmt.Errorf("export resources: %w", err)
	}

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults()
	progress.SetMessage(ctx, "pull resources")

	syncJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Pull: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}

	if err := m.syncWorker.Process(ctx, repo, syncJob, progress); err != nil {
		return fmt.Errorf("pull resources: %w", err)
	}

	progress.SetMessage(ctx, "clean namespace")
	if err := m.namespaceCleaner.Clean(ctx, namespace, progress); err != nil {
		return fmt.Errorf("clean namespace: %w", err)
	}

	return nil
}
