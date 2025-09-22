package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

//go:generate mockery --name RepositoryPatchFn --structname MockRepositoryPatchFn --inpackage --filename repository_patch_fn_mock.go --with-expecter
type RepositoryPatchFn func(ctx context.Context, repo *provisioning.Repository, patchOperations ...map[string]interface{}) error

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
	syncer Syncer

	metrics jobs.JobMetrics
}

func NewSyncWorker(
	clients resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	storageStatus dualwrite.Service,
	patchStatus RepositoryPatchFn,
	syncer Syncer,
	metrics jobs.JobMetrics,
) *SyncWorker {
	return &SyncWorker{
		clients:             clients,
		repositoryResources: repositoryResources,
		patchStatus:         patchStatus,
		storageStatus:       storageStatus,
		syncer:              syncer,
		metrics:             metrics,
	}
}

func (r *SyncWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPull
}

func (r *SyncWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	cfg := repo.Config()
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())

	start := time.Now()
	outcome := jobs.ErrorOutcome
	totalChangesMade := 0
	defer func() {
		r.metrics.RecordJob(string(provisioning.JobActionPull), outcome, totalChangesMade, time.Since(start).Seconds())
	}()

	// Check if we are onboarding from legacy storage
	// HACK -- this should be handled outside of this worker
	if r.storageStatus != nil && dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, r.storageStatus) {
		return fmt.Errorf("sync not supported until storage has migrated")
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return fmt.Errorf("sync job submitted for repository that does not support read-write")
	}

	syncStatus := job.Status.ToSyncStatus(job.Name)
	// Preserve last ref as we use replace operation
	lastRef := repo.Config().Status.Sync.LastRef
	syncStatus.LastRef = lastRef

	// Update sync status at start using JSON patch
	patchOperations := []map[string]interface{}{
		{
			"op":    "replace",
			"path":  "/status/sync",
			"value": syncStatus,
		},
	}

	progress.SetMessage(ctx, "update sync status at start")
	if err := r.patchStatus(ctx, cfg, patchOperations...); err != nil {
		logger.Error("failed to update the repository status at the start of the sync job", "error", err)
		return fmt.Errorf("update repo with job status at start: %w", err)
	}

	repositoryResources, err := r.repositoryResources.Client(ctx, rw)
	if err != nil {
		logger.Error("failed to create repository resources client", "error", err)
		return fmt.Errorf("create repository resources client: %w", err)
	}

	clients, err := r.clients.Clients(ctx, cfg.Namespace)
	if err != nil {
		logger.Error("failed to get clients for the repository", "error", err)
		return fmt.Errorf("get clients for %s: %w", cfg.Name, err)
	}

	progress.SetMessage(ctx, "execute sync job")
	progress.StrictMaxErrors(20) // make it stop after 20 errors

	currentRef, syncError := r.syncer.Sync(ctx, rw, *job.Spec.Pull, repositoryResources, clients, progress)
	jobStatus := progress.Complete(ctx, syncError)
	syncStatus = jobStatus.ToSyncStatus(job.Name)

	if syncError != nil {
		logger.Debug("failed to sync the repository", "error", syncError)
	} else {
		outcome = jobs.SuccessOutcome
		for _, summary := range jobStatus.Summary {
			totalChangesMade += int(summary.Create + summary.Update + summary.Delete)
		}
	}

	// Create sync status and set hash if successful
	if syncStatus.State == provisioning.JobStateSuccess {
		syncStatus.LastRef = currentRef
	} else {
		syncStatus.LastRef = lastRef
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
	stats, err := repositoryResources.Stats(ctx)
	switch {
	case err != nil:
		logger.Error("unable to read stats", "error", err)
	case stats == nil:
		logger.Error("stats are nil")
	case len(stats.Managed) == 1:
		patchOperations = append(patchOperations, map[string]interface{}{
			"op":    "replace",
			"path":  "/status/stats",
			"value": stats.Managed[0].Stats,
		})
	default:
		logger.Warn("unexpected number of managed stats", "count", len(stats.Managed))
	}

	// Only patch the specific fields we want to update, not the entire status
	if err := r.patchStatus(ctx, cfg, patchOperations...); err != nil {
		logger.Error("failed to update the repository status at the end of the sync job", "error", err)
		return fmt.Errorf("update repo with job final status: %w", err)
	}

	return syncError
}
