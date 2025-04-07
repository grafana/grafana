package sync

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
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
	syncJob, err := r.createJob(ctx, rw, progress)
	if err != nil {
		return fmt.Errorf("failed to create sync job: %w", err)
	}

	syncError := syncJob.run(ctx, *job.Spec.Pull)
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
func (r *SyncWorker) createJob(ctx context.Context, repo repository.ReaderWriter, progress jobs.JobProgressRecorder) (*syncJob, error) {
	cfg := repo.Config()
	parser, err := r.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", cfg.Name, err)
	}

	clients, err := r.clients.Clients(ctx, cfg.Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get clients for %s: %w", cfg.Name, err)
	}

	folderClient, err := clients.Folder()
	if err != nil {
		return nil, fmt.Errorf("unable to get folder client: %w", err)
	}

	folders := resources.NewFolderManager(repo, folderClient, resources.NewEmptyFolderTree())
	job := &syncJob{
		repository:      repo,
		progress:        progress,
		lister:          r.lister,
		folders:         folders,
		clients:         clients,
		resourceManager: resources.NewResourcesManager(repo, folders, parser, clients, nil),
	}

	return job, nil
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

// created once for each sync execution
type syncJob struct {
	repository      repository.Reader
	progress        jobs.JobProgressRecorder
	lister          resources.ResourceLister
	clients         resources.ResourceClients
	folders         *resources.FolderManager
	resourceManager *resources.ResourcesManager
}

func (r *syncJob) run(ctx context.Context, options provisioning.SyncJobOptions) error {
	// Ensure the configured folder exists and is managed by the repository
	cfg := r.repository.Config()
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := r.folders.EnsureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
			Path:  "", // at the root of the repository
		}, ""); err != nil {
			return fmt.Errorf("unable to create root folder: %w", err)
		}
	}

	var err error
	var currentRef string

	versionedRepo, _ := r.repository.(repository.Versioned)
	if versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return fmt.Errorf("getting latest ref: %w", err)
		}
		r.progress.SetRef(currentRef)

		if cfg.Status.Sync.LastRef != "" && options.Incremental {
			if currentRef == cfg.Status.Sync.LastRef {
				r.progress.SetFinalMessage(ctx, "same commit as last sync")
				return nil
			}

			return r.applyVersionedChanges(ctx, versionedRepo, cfg.Status.Sync.LastRef, currentRef)
		}
	}

	// Read the complete change set
	target, err := r.lister.List(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		return fmt.Errorf("error listing current: %w", err)
	}
	source, err := r.repository.ReadTree(ctx, currentRef)
	if err != nil {
		return fmt.Errorf("error reading tree: %w", err)
	}
	changes, err := Changes(source, target)
	if err != nil {
		return fmt.Errorf("error calculating changes: %w", err)
	}

	if len(changes) == 0 {
		r.progress.SetFinalMessage(ctx, "no changes to sync")
		return nil
	}

	r.folders.SetTree(resources.NewFolderTreeFromResourceList(target))

	// Now apply the changes
	return r.applyChanges(ctx, changes)
}

func (r *syncJob) applyChanges(ctx context.Context, changes []ResourceFileChange) error {
	r.progress.SetTotal(ctx, len(changes))
	r.progress.SetMessage(ctx, "replicating changes")

	for _, change := range changes {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := r.progress.TooManyErrors(); err != nil {
			return err
		}

		if change.Action == repository.FileActionDeleted {
			result := jobs.JobResourceResult{
				Name:     change.Existing.Name,
				Resource: change.Existing.Resource,
				Group:    change.Existing.Group,
				Path:     change.Path,
				Action:   change.Action,
			}

			if change.Existing == nil || change.Existing.Name == "" {
				result.Error = errors.New("missing existing reference")
				r.progress.Record(ctx, result)
				continue
			}

			versionlessGVR := schema.GroupVersionResource{
				Group:    change.Existing.Group,
				Resource: change.Existing.Resource,
			}

			// TODO: should we use the clients or the resource manager instead?
			client, _, err := r.clients.ForResource(versionlessGVR)
			if err != nil {
				result.Error = fmt.Errorf("unable to get client for deleted object: %w", err)
				r.progress.Record(ctx, result)
				continue
			}

			result.Error = client.Delete(ctx, change.Existing.Name, metav1.DeleteOptions{})
			r.progress.Record(ctx, result)
			continue
		}

		// If folder ensure it exists
		if safepath.IsDir(change.Path) {
			result := jobs.JobResourceResult{
				Path:   change.Path,
				Action: change.Action,
			}

			folder, err := r.folders.EnsureFolderPathExist(ctx, change.Path)
			if err != nil {
				result.Error = fmt.Errorf("create folder: %w", err)
				r.progress.Record(ctx, result)
				continue
			}

			result.Name = folder
			result.Resource = resources.FolderResource.Resource
			result.Group = resources.FolderResource.Group
			r.progress.Record(ctx, result)

			continue
		}

		name, gvk, err := r.resourceManager.WriteResourceFromFile(ctx, change.Path, "")
		result := jobs.JobResourceResult{
			Path:     change.Path,
			Action:   change.Action,
			Name:     name,
			Error:    err,
			Resource: gvk.Kind,
			Group:    gvk.Group,
		}
		r.progress.Record(ctx, result)
	}

	r.progress.SetMessage(ctx, "changes replicated")

	return nil
}

// Convert git changes into resource file changes
func (r *syncJob) applyVersionedChanges(ctx context.Context, repo repository.Versioned, previousRef, currentRef string) error {
	diff, err := repo.CompareFiles(ctx, previousRef, currentRef)
	if err != nil {
		return fmt.Errorf("compare files error: %w", err)
	}

	if len(diff) < 1 {
		r.progress.SetFinalMessage(ctx, "no changes detected between commits")
		return nil
	}

	r.progress.SetTotal(ctx, len(diff))
	r.progress.SetMessage(ctx, "replicating versioned changes")

	for _, change := range diff {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := r.progress.TooManyErrors(); err != nil {
			return err
		}

		if err := resources.IsPathSupported(change.Path); err != nil {
			// Maintain the safe segment for empty folders
			safeSegment := safepath.SafeSegment(change.Path)
			if !safepath.IsDir(safeSegment) {
				safeSegment = safepath.Dir(safeSegment)
			}

			if safeSegment != "" && resources.IsPathSupported(safeSegment) == nil {
				folder, err := r.folders.EnsureFolderPathExist(ctx, safeSegment)
				if err != nil {
					return fmt.Errorf("unable to create empty file folder: %w", err)
				}

				r.progress.Record(ctx, jobs.JobResourceResult{
					Path:     safeSegment,
					Action:   repository.FileActionCreated,
					Resource: resources.FolderResource.Resource,
					Group:    resources.FolderResource.Group,
					Name:     folder,
				})

				continue
			}

			r.progress.Record(ctx, jobs.JobResourceResult{
				Path:   change.Path,
				Action: repository.FileActionIgnored,
			})
			continue
		}

		result := jobs.JobResourceResult{
			Path:   change.Path,
			Action: change.Action,
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			name, gvk, err := r.resourceManager.WriteResourceFromFile(ctx, change.Path, change.Ref)
			if err != nil {
				result.Error = fmt.Errorf("write resource: %w", err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
		case repository.FileActionDeleted:
			name, gvk, err := r.resourceManager.RemoveResourceFromFile(ctx, change.Path, change.PreviousRef)
			if err != nil {
				result.Error = fmt.Errorf("delete resource: %w", err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
		case repository.FileActionRenamed:
			name, gvk, err := r.resourceManager.RenameResourceFile(ctx, change.Path, change.PreviousRef, change.Path, change.Ref)
			if err != nil {
				result.Error = fmt.Errorf("rename resource: %w", err)
			}
			result.Name = name
			result.Resource = gvk.Kind
			result.Group = gvk.Group
		case repository.FileActionIgnored:
			// do nothing
		}
		r.progress.Record(ctx, result)
	}

	r.progress.SetMessage(ctx, "versioned changes replicated")

	return nil
}
