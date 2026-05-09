package migrate

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

//go:generate mockery --name WrapWithStageFn --structname MockWrapWithStageFn --inpackage --filename mock_wrap_with_stage_fn.go --with-expecter
type WrapWithStageFn func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repo repository.Repository, staged bool) error) error

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

	// Export resources first (for both folder and instance sync).
	// Wrap the progress recorder so we can capture which resources were exported.
	progress.SetMessage(ctx, "export resources")
	progress.StrictMaxErrors(1) // strict as we want the entire instance to be managed

	collector := newExportedResourceCollector(progress)

	exportJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Push: &provisioning.ExportJobOptions{
				Message:   options.Message,
				Resources: options.Resources,
			},
		},
	}
	if err := m.exportWorker.Process(ctx, repo, exportJob, collector); err != nil {
		return fmt.Errorf("export resources: %w", err)
	}

	// Build a takeover allowlist from the exported resource identifiers so the
	// sync phase can claim those specific unmanaged resources without rejecting them.
	ctx = resources.WithTakeoverAllowlist(ctx, collector.ExportedResources())

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults(false)

	// Pull resources from the repository
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

	// For instance-type repositories, also clean the namespace.
	// In selective mode (caller supplied an explicit Resources list) we skip
	// the cleanup, because deleting every other unmanaged resource would be
	// destructive — the user only asked to take over the named ones.
	if repo.Config().Spec.Sync.Target != provisioning.SyncTargetTypeFolder && len(options.Resources) == 0 {
		progress.SetMessage(ctx, "clean namespace")
		if err := m.namespaceCleaner.Clean(ctx, namespace, progress); err != nil {
			return fmt.Errorf("clean namespace: %w", err)
		}
	}

	return nil
}
