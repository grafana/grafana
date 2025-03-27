package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
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
	parsers *resources.ParserFactory

	// Check if the system is using unified storage
	storageStatus dualwrite.Service
}

func NewSyncWorker(
	client client.ProvisioningV0alpha1Interface,
	parsers *resources.ParserFactory,
	lister resources.ResourceLister,
	storageStatus dualwrite.Service,
) *SyncWorker {
	return &SyncWorker{
		client:        client,
		parsers:       parsers,
		lister:        lister,
		storageStatus: storageStatus,
	}
}

func (r *SyncWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionSync
}

func (r *SyncWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	cfg := repo.Config()
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	// Check if we are onboarding from legacy storage
	if dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, r.storageStatus) {
		return fmt.Errorf("sync not supported until storage has migrated")
	}

	rw, ok := repo.(repository.Reader)
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
func (r *SyncWorker) createJob(ctx context.Context, repo repository.Reader, progress jobs.JobProgressRecorder) (*syncJob, error) {
	cfg := repo.Config()
	parser, err := r.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", cfg.Name, err)
	}

	folderClient, err := parser.Clients().Folder()
	if err != nil {
		return nil, fmt.Errorf("unable to get folder client: %w", err)
	}

	job := &syncJob{
		repository:      repo,
		progress:        progress,
		parser:          parser,
		lister:          r.lister,
		folders:         resources.NewFolderManager(repo, folderClient),
		resourcesLookup: map[resourceID]string{},
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

type resourceID struct {
	Name     string
	Resource string
	Group    string
}

// created once for each sync execution
type syncJob struct {
	repository      repository.Reader
	progress        jobs.JobProgressRecorder
	parser          *resources.Parser
	lister          resources.ResourceLister
	folders         *resources.FolderManager
	folderLookup    *resources.FolderTree
	resourcesLookup map[resourceID]string // the path with this k8s name
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

	// Load any existing folder information
	r.folderLookup = resources.NewFolderTreeFromResourceList(target)

	// Now apply the changes
	return r.applyChanges(ctx, changes)
}

func (r *syncJob) applyChanges(ctx context.Context, changes []ResourceFileChange) error {
	if len(r.resourcesLookup) > 0 {
		return fmt.Errorf("this should be empty")
	}

	r.progress.SetTotal(ctx, len(changes))
	r.progress.SetMessage(ctx, "replicating changes")

	for _, change := range changes {
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

			client, _, err := r.parser.Clients().ForResource(versionlessGVR)
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
			result.Resource = folders.RESOURCE
			result.Group = folders.GROUP
			r.progress.Record(ctx, result)

			continue
		}

		// Write the resource file
		r.progress.Record(ctx, r.writeResourceFromFile(ctx, change.Path, "", change.Action))
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
					Resource: folders.RESOURCE,
					Group:    folders.GROUP,
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

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			r.progress.Record(ctx, r.writeResourceFromFile(ctx, change.Path, change.Ref, change.Action))
		case repository.FileActionDeleted:
			r.progress.Record(ctx, r.deleteObject(ctx, change.Path, change.PreviousRef))
		case repository.FileActionRenamed:
			// 1. Delete
			result := r.deleteObject(ctx, change.Path, change.PreviousRef)
			if result.Error != nil {
				r.progress.Record(ctx, result)
				continue
			}

			// 2. Create
			r.progress.Record(ctx, r.writeResourceFromFile(ctx, change.Path, change.Ref, repository.FileActionCreated))
		case repository.FileActionIgnored:
			r.progress.Record(ctx, jobs.JobResourceResult{
				Path:   change.Path,
				Action: repository.FileActionIgnored,
			})
		}
	}

	r.progress.SetMessage(ctx, "versioned changes replicated")

	return nil
}

func (r *syncJob) deleteObject(ctx context.Context, path string, ref string) jobs.JobResourceResult {
	info, err := r.repository.Read(ctx, path, ref)
	result := jobs.JobResourceResult{
		Path:   path,
		Action: repository.FileActionDeleted,
	}

	if err != nil {
		result.Error = fmt.Errorf("failed to read file: %w", err)
		return result
	}

	obj, gvk, _ := resources.DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if obj == nil {
		result.Error = errors.New("no object found")
		return result
	}

	objName := obj.GetName()
	if objName == "" {
		// Find the referenced file
		objName, _ = resources.NamesFromHashedRepoPath(r.repository.Config().Name, path)
	}

	result.Name = objName
	result.Resource = gvk.Kind
	result.Group = gvk.Group

	client, _, err := r.parser.Clients().ForKind(*gvk)
	if err != nil {
		result.Error = fmt.Errorf("unable to get client for deleted object: %w", err)
		return result
	}

	err = client.Delete(ctx, objName, metav1.DeleteOptions{})
	if err != nil {
		result.Error = fmt.Errorf("failed to delete: %w", err)
		return result
	}

	return result
}

func (r *syncJob) writeResourceFromFile(ctx context.Context, path string, ref string, action repository.FileAction) jobs.JobResourceResult {
	result := jobs.JobResourceResult{
		Path:   path,
		Action: action,
	}

	// Read the referenced file
	fileInfo, err := r.repository.Read(ctx, path, ref)
	if err != nil {
		result.Error = fmt.Errorf("failed to read file: %w", err)
		return result
	}

	parsed, err := r.parser.Parse(ctx, fileInfo, false) // no validation
	if err != nil {
		result.Error = fmt.Errorf("failed to parse file: %w", err)
		return result
	}

	// Check if the resource already exists
	id := resourceID{
		Name:     parsed.Obj.GetName(),
		Resource: parsed.GVR.Resource,
		Group:    parsed.GVK.Group,
	}
	existing, found := r.resourcesLookup[id]
	if found {
		result.Error = fmt.Errorf("duplicate resource name: %s, %s and %s", parsed.Obj.GetName(), path, existing)
		return result
	}
	r.resourcesLookup[id] = path

	// Make sure the parent folders exist
	folder, err := r.folders.EnsureFolderPathExist(ctx, path)
	if err != nil {
		result.Error = fmt.Errorf("failed to ensure folder path exists: %w", err)
		return result
	}

	parsed.Meta.SetFolder(folder)
	parsed.Meta.SetUID("")             // clear identifiers
	parsed.Meta.SetResourceVersion("") // clear identifiers

	result.Name = parsed.Obj.GetName()
	result.Resource = parsed.GVR.Resource
	result.Group = parsed.GVK.Group

	// Update will also create (for resources we care about)
	_, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
	result.Error = err
	return result
}
