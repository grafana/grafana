package sync

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

// SyncWorker synchronizes the external repo with grafana database
// this function updates the status for both the job and the referenced repository
type SyncWorker struct {
	// Used to update the repository status with sync info
	client client.ProvisioningV0alpha1Interface

	// Lists the values saved in grafana database
	lister resources.ResourceLister

	// Parses fields saved in remore repository
	parsers resources.ParserFactory

	// Clients for the repository
	clients resources.ClientFactory

	// Check if the system is using unified storage
	storageStatus dualwrite.Service
}

func NewSyncWorker(
	client client.ProvisioningV0alpha1Interface,
	parsers resources.ParserFactory,
	clients resources.ClientFactory,
	lister resources.ResourceLister,
	storageStatus dualwrite.Service,
) *SyncWorker {
	return &SyncWorker{
		client:        client,
		parsers:       parsers,
		clients:       clients,
		lister:        lister,
		storageStatus: storageStatus,
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
	syncError := r.run(ctx, rw, progress, *job.Spec.Pull)
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
	if stats, err := r.lister.Stats(ctx, cfg.Namespace, cfg.Name); err != nil {
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
func (r *SyncWorker) run(ctx context.Context, repo repository.ReaderWriter, progress jobs.JobProgressRecorder, options provisioning.SyncJobOptions) error {
	cfg := repo.Config()
	parser, err := r.parsers.GetParser(ctx, repo)
	if err != nil {
		return fmt.Errorf("get parser for %s: %w", cfg.Name, err)
	}

	clients, err := r.clients.Clients(ctx, cfg.Namespace)
	if err != nil {
		return fmt.Errorf("get clients for %s: %w", cfg.Name, err)
	}

	folderClient, err := clients.Folder()
	if err != nil {
		return fmt.Errorf("get folder client: %w", err)
	}

	folders := resources.NewFolderManager(repo, folderClient, resources.NewEmptyFolderTree())
	resourceManager := resources.NewResourcesManager(repo, folders, parser, clients, nil)

	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := folders.EnsureFolderExists(ctx, resources.Folder{
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

			return IncrementalSync(ctx, versionedRepo, cfg.Status.Sync.LastRef, currentRef, folders, resourceManager, progress)
		}
	}

	progress.SetMessage(ctx, "full sync")

	return FullSync(ctx, repo, clients, currentRef, folders, resourceManager, r.lister, progress)
}

func (r *SyncWorker) patchStatus(ctx context.Context, repo *provisioning.Repository, patchOperations []map[string]interface{}) error {
	patch, err := json.Marshal(patchOperations)
	if err != nil {
		return fmt.Errorf("unable to marshal patch data: %w", err)
	}

	_, err = r.client.Repositories(repo.Namespace).
		Patch(ctx, repo.Name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status")
	if err != nil {
		return fmt.Errorf("unable to update repo with job status: %w", err)
	}

	return nil
}
