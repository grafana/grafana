package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"sort"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/k8sctx"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// SyncWorker synchronizes the external repo with grafana database
// this function updates the status for both the job and the referenced repository
type SyncWorker struct {
	client  client.ProvisioningV0alpha1Interface
	parsers *resources.ParserFactory
	lister  resources.ResourceLister
}

func NewSyncWorker(
	client client.ProvisioningV0alpha1Interface,
	parsers *resources.ParserFactory,
	lister resources.ResourceLister,
) *SyncWorker {
	return &SyncWorker{
		client:  client,
		parsers: parsers,
		lister:  lister,
	}
}

func (r *SyncWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionSync
}

func (r *SyncWorker) Process(ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	progress jobs.ProgressFn,
) (*provisioning.JobStatus, error) {
	ctx, cancel, err := k8sctx.Fork(ctx)
	if err != nil {
		return nil, err
	}
	defer cancel()

	cfg := repo.Config()
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())

	// Update sync status at the start
	data := map[string]any{
		"status": map[string]any{
			"sync": job.Status.ToSyncStatus(job.Name),
		},
	}

	if err := r.patchStatus(ctx, cfg, data); err != nil {
		return nil, fmt.Errorf("update repo with job status at start: %w", err)
	}

	// Create job
	syncJob, err := r.createJob(ctx, repo, progress)
	if err != nil {
		return nil, fmt.Errorf("failed to create sync job: %w", err)
	}

	// Execute the job
	results, syncError := syncJob.run(ctx, *job.Spec.Sync)
	// Initialize base job status
	jobStatus := provisioning.JobStatus{
		Started:  job.Status.Started,
		Finished: time.Now().UnixMilli(),
		State:    provisioning.JobStateSuccess,
		Message:  "sync completed successfully",
	}

	// Handle sync error
	if syncError != nil {
		jobStatus.State = provisioning.JobStateError
		jobStatus.Message = syncError.Error()
	}

	// Process results if available
	if results != nil {
		jobStatus.Summary = results.Summary()
		jobStatus.Errors = results.Errors()

		// Check for errors in results
		if len(jobStatus.Errors) > 0 && jobStatus.State != provisioning.JobStateError {
			jobStatus.State = provisioning.JobStateError
			jobStatus.Message = "sync completed with errors"
		}

		// Override message if results have a custom message
		if results.Message != "" && jobStatus.State != provisioning.JobStateError {
			jobStatus.Message = results.Message
		}
	}

	// Create sync status and set hash if successful
	syncStatus := jobStatus.ToSyncStatus(job.Name)
	if syncStatus.State == provisioning.JobStateSuccess && results != nil {
		syncStatus.Hash = results.Ref
	}

	// Update the resource stats -- give the index some time to catch up
	time.Sleep(1 * time.Second)
	stats, err := r.lister.Stats(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		logger.Warn("unable to read stats", "error", err)
	}
	if stats == nil {
		stats = &provisioning.ResourceStats{}
	}

	data = map[string]any{
		"status": map[string]any{
			"sync":  syncStatus,
			"stats": stats.Items,
		},
	}

	if err := r.patchStatus(ctx, cfg, data); err != nil {
		return nil, fmt.Errorf("update repo with job final status: %w", err)
	}

	if syncError != nil {
		return nil, syncError
	}

	return &jobStatus, nil
}

// start a job and run it
func (r *SyncWorker) createJob(ctx context.Context,
	repo repository.Repository,
	progress jobs.ProgressFn,
) (*syncJob, error) {
	cfg := repo.Config()
	if !cfg.Spec.Sync.Enabled {
		return nil, errors.New("sync is not enabled")
	}

	parser, err := r.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", cfg.Name, err)
	}

	dynamicClient := parser.Client()
	if repo.Config().Namespace != dynamicClient.GetNamespace() {
		return nil, fmt.Errorf("namespace mismatch")
	}

	job := &syncJob{
		repository: repo,
		progress:   progress,
		parser:     parser,
		lister:     r.lister,
		folders: dynamicClient.Resource(schema.GroupVersionResource{
			Group:    folders.GROUP,
			Version:  folders.VERSION,
			Resource: folders.RESOURCE,
		}),
		dashboards: dynamicClient.Resource(schema.GroupVersionResource{
			Group:    dashboard.GROUP,
			Version:  "v1alpha1",
			Resource: dashboard.DASHBOARD_RESOURCE,
		}),
	}

	return job, nil
}

func (r *SyncWorker) patchStatus(ctx context.Context, repo *provisioning.Repository, data interface{}) error {
	patch, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("unable to marshal patch data: %w", err)
	}

	repo, err = r.client.Repositories(repo.Namespace).
		Patch(ctx, repo.Name, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
	if err != nil {
		return fmt.Errorf("unable to update repo with job status: %w", err)
	}

	return nil
}

// created once for each sync execution
type syncJob struct {
	repository repository.Repository
	progress   jobs.ProgressFn

	parser       *resources.Parser
	lister       resources.ResourceLister
	folders      dynamic.ResourceInterface
	dashboards   dynamic.ResourceInterface
	folderLookup *resources.FolderTree
}

func (r *syncJob) run(ctx context.Context, options provisioning.SyncJobOptions) (*ResultsRecorder, error) {
	// Ensure the configured folder exists and is managed by the repository
	cfg := r.repository.Config()
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := r.ensureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
		}, ""); err != nil {
			return nil, fmt.Errorf("unable to create root folder: %w", err)
		}
	}

	var err error
	var currentRef string

	versionedRepo, _ := r.repository.(repository.VersionedRepository)
	if versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return nil, fmt.Errorf("getting latest ref: %w", err)
		}

		if cfg.Status.Sync.Hash != "" && options.Incremental {
			if currentRef == cfg.Status.Sync.Hash {
				return &ResultsRecorder{Message: "same commit as last sync"}, nil
			}

			results, err := r.applyVersionedChanges(ctx, versionedRepo, cfg.Status.Sync.Hash, currentRef)
			if err != nil {
				return nil, fmt.Errorf("apply versioned changes: %w", err)
			}
			results.Ref = currentRef
			return results, nil
		}
	}

	// Read the complete change set
	target, err := r.lister.List(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		return nil, fmt.Errorf("error listing current: %w", err)
	}
	source, err := r.repository.ReadTree(ctx, currentRef)
	if err != nil {
		return nil, fmt.Errorf("error reading tree: %w", err)
	}
	changes, err := Changes(source, target)
	if err != nil {
		return nil, fmt.Errorf("error calculating changes: %w", err)
	}

	if len(changes) == 0 {
		return &ResultsRecorder{Message: "no changes to sync", Ref: currentRef}, nil
	}

	// Load any existing folder information
	r.folderLookup = resources.NewFolderTreeFromResourceList(target)

	// Now apply the changes
	results := r.applyChanges(ctx, changes)
	results.Ref = currentRef

	return results, nil
}

func (r *syncJob) applyChanges(ctx context.Context, changes []ResourceFileChange) *ResultsRecorder {
	// Do the longest paths first (important for delete)
	sort.Slice(changes, func(i, j int) bool {
		return len(changes[i].Path) > len(changes[j].Path)
	})

	results := &ResultsRecorder{Total: len(changes)}
	logger := logging.FromContext(ctx)
	// Create folder structure first
	for _, change := range changes {
		if len(results.Errors()) > 20 {
			results.Record(Result{
				Name:     change.Existing.Name,
				Resource: change.Existing.Resource,
				Group:    change.Existing.Group,
				Path:     change.Path,
				// FIXME: should we use a skipped action instead? or a different action type?
				Action: repository.FileActionIgnored,
				Error:  errors.New("too many errors"),
			})
			continue
		}

		jobStatus := provisioning.JobStatus{
			State:    provisioning.JobStateWorking,
			Message:  "replicating changes",
			Errors:   results.Errors(),
			Progress: results.Progress(),
			Summary:  results.Summary(),
		}

		if err := r.progress(ctx, jobStatus); err != nil {
			logger.Warn("error notifying progress", "err", err)
		}

		if change.Action == repository.FileActionDeleted {
			result := Result{
				Name:     change.Existing.Name,
				Resource: change.Existing.Resource,
				Group:    change.Existing.Group,
				Path:     change.Path,
				Action:   change.Action,
			}

			if change.Existing == nil || change.Existing.Name == "" {
				logger.Error("deleted file is missing existing reference", "file", change.Path)
				result.Error = errors.New("missing existing reference")
				results.Record(result)
				continue
			}

			client, err := r.client(change.Existing.Resource)
			if err != nil {
				logger.Error("unable to get client for deleted object", "file", change.Path, "err", err, "obj", change.Existing)
				result.Error = fmt.Errorf("unable to get client for deleted object: %w", err)
				results.Record(result)
				continue
			}

			err = client.Delete(ctx, change.Existing.Name, metav1.DeleteOptions{})
			if err != nil {
				logger.Error("deleting error", "file", change.Path, "err", err)
			}

			result.Error = err
			results.Record(result)

			continue
		}

		// Write the resource file
		result := r.writeResourceFromFile(ctx, change.Path, "", change.Action)
		if result.Error != nil {
			logger.Error("write resource error", "file", change.Path, "err", result.Error)
		}
		results.Record(result)
	}

	return results
}

// Convert git changes into resource file changes
func (r *syncJob) applyVersionedChanges(ctx context.Context, repo repository.VersionedRepository, previousRef, currentRef string) (*ResultsRecorder, error) {
	diff, err := repo.CompareFiles(ctx, previousRef, currentRef)
	if err != nil {
		return nil, fmt.Errorf("compare files error: %w", err)
	}

	results := &ResultsRecorder{Total: len(diff)}
	if len(diff) < 1 {
		results.Message = "no changes detected between commits"
		return nil, nil
	}

	logger := logging.FromContext(ctx)
	for _, change := range diff {
		if len(results.Errors()) > 20 {
			results.Record(Result{
				Path: change.Path,
				// FIXME: should we use a skipped action instead? or a different action type?
				Action: repository.FileActionIgnored,
				Error:  errors.New("too many errors"),
			})
			continue
		}

		jobStatus := provisioning.JobStatus{
			State:    provisioning.JobStateWorking,
			Message:  "replicating versioned changes",
			Errors:   results.Errors(),
			Progress: results.Progress(),
			Summary:  results.Summary(),
		}

		if err := r.progress(ctx, jobStatus); err != nil {
			logger.Warn("error notifying progress", "err", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			result := r.writeResourceFromFile(ctx, change.Path, change.Ref, change.Action)
			if result.Error != nil {
				logger.Error("error writing", "change", change, "err", err)
			}
			results.Record(result)
		case repository.FileActionDeleted:
			result := r.deleteObject(ctx, change.Path, change.PreviousRef)
			if result.Error != nil {
				logger.Error("error deleting", "change", change, "err", result.Error)
			}
			results.Record(result)
		case repository.FileActionRenamed:
			// 1. Delete
			result := r.deleteObject(ctx, change.Path, change.PreviousRef)
			if result.Error != nil {
				logger.Error("error deleting", "change", change, "err", result.Error)
				results.Record(result)
				continue
			}

			// 2. Create
			result = r.writeResourceFromFile(ctx, change.Path, change.Ref, repository.FileActionCreated)
			if result.Error != nil {
				logger.Warn("error writing", "change", change, "err", result.Error)
			}
			results.Record(result)
		}
	}

	return results, nil
}

func (r *syncJob) deleteObject(ctx context.Context, path string, ref string) Result {
	info, err := r.repository.Read(ctx, path, ref)
	result := Result{
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

	// Find the referenced file
	objName, _ := resources.NamesFromHashedRepoPath(r.repository.Config().Name, path)
	result.Name = objName
	result.Resource = gvk.Kind
	result.Group = gvk.Group

	client, err := r.client(gvk.Kind)
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

func (r *syncJob) writeResourceFromFile(ctx context.Context, path string, ref string, action repository.FileAction) Result {
	result := Result{
		Path:   path,
		Action: action,
	}

	if resources.ShouldIgnorePath(path) {
		result.Action = repository.FileActionIgnored
		return result
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

	// Make sure the parent folders exist
	folder, err := r.ensureFolderPathExists(ctx, path)
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

	switch action {
	case repository.FileActionCreated:
		_, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
		result.Error = err
	case repository.FileActionUpdated:
		_, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
		result.Error = err
	default:
		result.Error = fmt.Errorf("unsupported action: %s", action)
	}
	return result
}

// ensureFolderPathExists creates the folder structure in the cluster.
func (r *syncJob) ensureFolderPathExists(ctx context.Context, filePath string) (parent string, err error) {
	cfg := r.repository.Config()
	parent = resources.RootFolder(cfg)

	dir := path.Dir(filePath)
	if dir == "." {
		return parent, nil
	}

	if r.folderLookup == nil {
		r.folderLookup = resources.NewEmptyFolderTree()
	}

	f := resources.ParseFolder(dir, cfg.Name)
	if r.folderLookup.In(f.ID) {
		return f.ID, nil
	}

	var traverse string
	for i, part := range strings.Split(f.Path, "/") {
		if i == 0 {
			traverse = part
		} else {
			traverse, err = safepath.Join(traverse, part)
			if err != nil {
				return "", fmt.Errorf("unable to make path: %w", err)
			}
		}

		f := resources.ParseFolder(traverse, cfg.GetName())
		if r.folderLookup.In(f.ID) {
			parent = f.ID
			continue
		}

		if err := r.ensureFolderExists(ctx, f, parent); err != nil {
			return "", fmt.Errorf("ensure folder exists: %w", err)
		}
		r.folderLookup.Add(f, parent)
		parent = f.ID
	}

	return f.ID, err
}

// ensureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
func (r *syncJob) ensureFolderExists(ctx context.Context, folder resources.Folder, parent string) error {
	cfg := r.repository.Config()
	obj, err := r.folders.Get(ctx, folder.ID, metav1.GetOptions{})
	if err == nil {
		current, ok := obj.GetAnnotations()[utils.AnnoKeyRepoName]
		if !ok {
			return fmt.Errorf("target folder is not managed by a repository")
		}
		if current != cfg.Name {
			return fmt.Errorf("target folder is managed by a different repository (%s)", current)
		}
		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if folder exists: %w", err)
	}

	obj = &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]any{
				"title": folder.Title,
			},
		},
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("create meta accessor for the object: %w", err)
	}

	obj.SetNamespace(cfg.GetNamespace())
	obj.SetName(folder.ID)
	if parent != "" {
		meta.SetFolder(parent)
	}
	meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
		Name:      cfg.GetName(),
		Path:      folder.Path,
		Hash:      "",  // FIXME: which hash?
		Timestamp: nil, // ???&info.Modified.Time,
	})

	if _, err := r.folders.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	return nil
}

func (r *syncJob) client(kind string) (dynamic.ResourceInterface, error) {
	switch kind {
	case dashboard.GROUP, dashboard.DASHBOARD_RESOURCE, "Dashboard":
		return r.dashboards, nil
	case folders.GROUP, folders.RESOURCE, "Folder":
		return r.folders, nil
	}
	return nil, fmt.Errorf("unsupported resource: %s", kind)
}
