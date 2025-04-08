package sync

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

//go:generate mockery --name RepositoryPatchFn --structname MockRepositoryPatchFn --inpackage --filename repository_patch_fn_mock.go --with-expecter
type RepositoryPatchFn func(ctx context.Context, repo *provisioning.Repository, ops []map[string]interface{}) error

//go:generate mockery --name FullSyncFn --structname MockFullSyncFn --inpackage --filename full_sync_fn_mock.go --with-expecter
type FullSyncFn func(ctx context.Context, repo repository.Reader, clients resources.ResourceClients, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

//go:generate mockery --name IncrementalSyncFn --structname MockIncrementalSyncFn --inpackage --filename incremental_sync_fn_mock.go --with-expecter
type IncrementalSyncFn func(ctx context.Context, repo repository.Versioned, previousRef, currentRef string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error

// SyncWorker synchronizes the external repo with grafana database
// this function updates the status for both the job and the referenced repository
type SyncWorker struct {
	// Clients for the repository
	clients resources.ClientFactory

	// ResourceClients for the repository
	repositoryResources resources.RepositoryResourcesFactory

	// Check if the system is using unified storage
	storageStatus dualwrite.Service

	// Patch status for the repository
	patchStatus RepositoryPatchFn

	// Sync functions
	fullSync        FullSyncFn
	incrementalSync IncrementalSyncFn
}

func NewSyncWorker(
	clients resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	storageStatus dualwrite.Service,
	patchStatus RepositoryPatchFn,
	fullSync FullSyncFn,
	incrementalSync IncrementalSyncFn,
) *SyncWorker {
	return &SyncWorker{
		clients:             clients,
		repositoryResources: repositoryResources,
		patchStatus:         patchStatus,
		storageStatus:       storageStatus,
		fullSync:            fullSync,
		incrementalSync:     incrementalSync,
	}
}

func (r *SyncWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPull
}

func (r *SyncWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	cfg := repo.Config()
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	// Check if we are onboarding from legacy storage
	if dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, r.storageStatus) {
		return fmt.Errorf("sync not supported until storage has migrated")
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return fmt.Errorf("sync job submitted for repository that does not support read-write -- this is a bug")
	}

	syncStatus := job.Status.ToSyncStatus(job.Name)
	// Preserve last ref as we use replace operation
	syncStatus.LastRef = repo.Config().Status.Sync.LastRef

	// Update sync status at start using JSON patch
	patchOperations := []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/sync",
			"value": syncStatus,
		},
	}

	progress.SetMessage(ctx, "update sync status at start")
	if err := r.patchStatus(ctx, cfg, patchOperations); err != nil {
		return fmt.Errorf("update repo with job status at start: %w", err)
	}

	progress.SetMessage(ctx, "execute sync job")
	repositoryResources, err := r.repositoryResources.Client(ctx, rw)
	if err != nil {
		return fmt.Errorf("create repository resources client: %w", err)
	}

	syncError := r.run(ctx, rw, progress, *job.Spec.Pull, repositoryResources)
	jobStatus := progress.Complete(ctx, syncError)
	syncStatus = jobStatus.ToSyncStatus(job.Name)

	// Create sync status and set hash if successful
	if syncStatus.State == provisioning.JobStateSuccess {
		syncStatus.LastRef = progress.GetRef()
	}

	// Update final status using JSON patch
	progress.SetMessage(ctx, "update status and stats")
	patchOperations = []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/sync",
			"value": syncStatus,
		},
	}

	// Only add stats patch if stats are not nil
	if stats, err := repositoryResources.Stats(ctx); err != nil {
		logger.Error("unable to read stats", "error", err)
	} else if stats != nil && len(stats.Managed) == 1 {
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/stats",
			"value": stats.Managed[0].Stats,
		})
	}

	// Only patch the specific fields we want to update, not the entire status
	if err := r.patchStatus(ctx, cfg, patchOperations); err != nil {
		return fmt.Errorf("update repo with job final status: %w", err)
	}

	return syncError
}

// start a job and run it
func (r *SyncWorker) run(ctx context.Context, repo repository.ReaderWriter, progress jobs.JobProgressRecorder, options provisioning.SyncJobOptions, repositoryResources resources.RepositoryResources) error {
	cfg := repo.Config()

	clients, err := r.clients.Clients(ctx, cfg.Namespace)
	if err != nil {
		return fmt.Errorf("get clients for %s: %w", cfg.Name, err)
	}

	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := repositoryResources.EnsureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
			Path:  "", // at the root of the repository
		}, ""); err != nil {
			return fmt.Errorf("create root folder: %w", err)
		}
	}

	var currentRef string
	versionedRepo, _ := repo.(repository.Versioned)
	if versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return fmt.Errorf("get latest ref: %w", err)
		}
		progress.SetRef(currentRef)

		if cfg.Status.Sync.LastRef != "" && options.Incremental {
			if currentRef == cfg.Status.Sync.LastRef {
				progress.SetFinalMessage(ctx, "same commit as last sync")
				return nil
			}

			progress.SetMessage(ctx, "incremental sync")

			return r.incrementalSync(ctx, versionedRepo, cfg.Status.Sync.LastRef, currentRef, repositoryResources, progress)
		}
	}

	progress.SetMessage(ctx, "full sync")

	return r.fullSync(ctx, repo, clients, currentRef, repositoryResources, progress)
}
