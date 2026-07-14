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

func (m *UnifiedStorageMigrator) Migrate(ctx context.Context, repo repository.ReaderWriter, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := provisioning.MigrateJobOptions{}
	if job.Spec.Migrate != nil {
		options = *job.Spec.Migrate
	}
	namespace := repo.Config().GetNamespace()

	// A branch migration targets a branch other than the repository's configured
	// branch, i.e. a pull request workflow. The exported resources cannot be
	// taken over and synced back yet: the pull phase reads the configured branch,
	// which does not contain them until the branch is merged. So instead of
	// taking ownership we remove the migrated resources from the instance; they
	// return as managed resources when the branch is merged and a regular sync
	// runs on the configured branch.
	branchMigration := options.Branch != "" && options.Branch != repo.Config().Branch()

	// Export resources first (for both folder and instance sync).
	// Wrap the progress recorder so we can capture which resources were exported.
	progress.SetMessage(ctx, "export resources")
	progress.StrictMaxErrors(1) // strict as we want the entire instance to be managed

	collector := newExportedResourceCollector(progress)

	exportJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Message: job.Spec.Message,
			Push: &provisioning.ExportJobOptions{
				Message:              options.Message,
				Branch:               options.Branch,
				Resources:            options.Resources,
				GenerateNewFolderIDs: options.GenerateNewFolderIDs,
			},
		},
	}
	if err := m.exportWorker.Process(ctx, repo, exportJob, collector); err != nil {
		return fmt.Errorf("export resources: %w", err)
	}

	// On a branch migration we skip the takeover/pull phase entirely: the
	// exported resources live on a branch that is not yet merged, so there is
	// nothing to claim from the configured branch.
	if !branchMigration {
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
	}

	// A selective branch migration deletes only the resources it migrated. The
	// default (non-branch) selective flow takes those resources over via the pull
	// above, so it must not delete anything here — only the branch flow, which
	// cannot take them over, reaches this deletion. Folders are excluded: they are
	// emitted purely to resolve paths and may be shared with resources that were
	// not migrated.
	if branchMigration && len(options.Resources) > 0 {
		progress.SetMessage(ctx, "delete migrated resources")
		if err := m.namespaceCleaner.CleanResources(ctx, namespace, collector.ExportedNonFolderResources(), progress); err != nil {
			return fmt.Errorf("delete migrated resources: %w", err)
		}
		return nil
	}

	// For instance-type repositories, also clean the namespace.
	// In selective mode (caller supplied an explicit Resources list) we skip
	// the cleanup, because deleting every other unmanaged resource would be
	// destructive — the user only asked to take over the named ones (handled
	// above for branch migrations).
	// Folderless repositories also coexist with unmanaged resources, so they
	// must never trigger a namespace clean.
	//
	// For a default-branch migration this removes the unmanaged leftovers that
	// were not taken over by the pull above. For a full branch migration the
	// exported resources are still unmanaged (they were never taken over), so this
	// is what removes the migrated resources from the instance.
	target := repo.Config().Spec.Sync.Target
	if target != provisioning.SyncTargetTypeFolder && target != provisioning.SyncTargetTypeFolderless && len(options.Resources) == 0 {
		progress.SetMessage(ctx, "clean namespace")
		if err := m.namespaceCleaner.Clean(ctx, namespace, progress); err != nil {
			return fmt.Errorf("clean namespace: %w", err)
		}
	}

	return nil
}
