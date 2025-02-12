package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"reflect"
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
	syncJob, err := r.createJob(ctx, repo, *job.Spec.Sync, progress)
	if err != nil {
		return nil, fmt.Errorf("failed to create sync job: %w", err)
	}

	// Execute the job
	ref, syncError := syncJob.run(ctx)
	if len(syncJob.jobStatus.Errors) > 0 {
		syncJob.jobStatus.State = provisioning.JobStateError
	}

	if syncError != nil {
		syncJob.jobStatus = &provisioning.JobStatus{
			State:    provisioning.JobStateError,
			Started:  job.Status.Started,
			Finished: time.Now().UnixMilli(),
			Message:  syncError.Error(),
			Errors:   syncJob.jobStatus.Errors,
		}
	}

	if !reflect.DeepEqual(syncJob.summary, provisioning.JobResourceSummary{}) {
		syncJob.jobStatus.Summary = []*provisioning.JobResourceSummary{&syncJob.summary}
	}

	syncStatus := syncJob.jobStatus.ToSyncStatus(job.Name)
	if syncStatus.State == provisioning.JobStateSuccess {
		syncStatus.Hash = ref
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

	return syncJob.jobStatus, nil
}

// start a job and run it
func (r *SyncWorker) createJob(ctx context.Context,
	repo repository.Repository,
	options provisioning.SyncJobOptions,
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
		summary: provisioning.JobResourceSummary{
			Resource: "all",
			Group:    "all",
		},
		repository: repo,
		options:    options,
		progress:   progress,
		parser:     parser,
		lister:     r.lister,
		jobStatus: &provisioning.JobStatus{
			State: provisioning.JobStateWorking,
		},
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
	options    provisioning.SyncJobOptions
	progress   jobs.ProgressFn

	parser       *resources.Parser
	lister       resources.ResourceLister
	folders      dynamic.ResourceInterface
	dashboards   dynamic.ResourceInterface
	folderLookup *resources.FolderTree

	jobStatus *provisioning.JobStatus

	// FIXME: generic summary for now (not typed)
	summary provisioning.JobResourceSummary
}

func (r *syncJob) run(ctx context.Context) (string, error) {
	// Ensure the configured folder exists and is managed by the repository
	cfg := r.repository.Config()
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := r.ensureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
		}, ""); err != nil {
			return "", fmt.Errorf("unable to create root folder: %w", err)
		}
	}

	var err error
	var currentRef string

	versionedRepo, _ := r.repository.(repository.VersionedRepository)
	if versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return "", fmt.Errorf("getting latest ref: %w", err)
		}

		if cfg.Status.Sync.Hash != "" && r.options.Incremental {
			if currentRef == cfg.Status.Sync.Hash {
				message := "same commit as last sync"
				r.jobStatus.Message = message
				return currentRef, nil
			}
			return currentRef, r.applyVersionedChanges(ctx, versionedRepo, cfg.Status.Sync.Hash, currentRef)
		}
	}

	// Read the complete change set
	target, err := r.lister.List(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		return "", fmt.Errorf("error listing current: %w", err)
	}
	source, err := r.repository.ReadTree(ctx, currentRef)
	if err != nil {
		return "", fmt.Errorf("error reading tree: %w", err)
	}
	changes, err := Changes(source, target)
	if err != nil {
		return "", fmt.Errorf("error calculating changes: %w", err)
	}

	if len(changes) == 0 {
		r.jobStatus.Message = "no changes to sync"
		return currentRef, nil
	}

	// Load any existing folder information
	r.folderLookup = resources.NewFolderTreeFromResourceList(target)

	// Now apply the changes
	if err := r.applyChanges(ctx, changes); err != nil {
		return "", fmt.Errorf("apply changes: %w", err)
	}

	return currentRef, nil
}

func (r *syncJob) applyChanges(ctx context.Context, changes []ResourceFileChange) error {
	// Do the longest paths first (important for delete)
	sort.Slice(changes, func(i, j int) bool {
		return len(changes[i].Path) > len(changes[j].Path)
	})

	logger := logging.FromContext(ctx)
	// Create folder structure first
	for _, change := range changes {
		if len(r.jobStatus.Errors) > 20 {
			return errors.New("too many errors")
		}

		if err := r.progress(ctx, *r.jobStatus); err != nil {
			logger.Warn("error notifying progress", "err", err)
			r.jobStatus.Errors = append(r.jobStatus.Errors, fmt.Errorf("error notifying progress: %w", err).Error())
		}

		if change.Action == repository.FileActionDeleted {
			if change.Existing == nil || change.Existing.Name == "" {
				logger.Error("deleted file is missing existing reference", "file", change.Path)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("unable to delete resource from: %s", change.Path))
				continue
			}

			client, err := r.client(change.Existing.Resource)
			if err != nil {
				logger.Warn("unable to get client for deleted object", "file", change.Path, "err", err, "obj", change.Existing)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("unsupported object: %s / %s", change.Path, change.Existing.Resource))
				continue
			}
			err = client.Delete(ctx, change.Existing.Name, metav1.DeleteOptions{})
			if err != nil {
				logger.Warn("deleting error", "file", change.Path, "err", err)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error deleting %s: %s // %s", change.Existing.Resource, change.Existing.Name, change.Path))
			} else {
				r.summary.Delete++
			}
			continue
		}

		// Write the resource file
		err := r.writeResourceFromFile(ctx, change.Path, "", change.Action)
		if err != nil {
			logger.Warn("write resource error", "file", change.Path, "err", err)
			r.jobStatus.Errors = append(r.jobStatus.Errors,
				fmt.Sprintf("error writing: %s // %s", change.Path, err.Error()))
		}
	}

	return nil
}

// Convert git changes into resource file changes
func (r *syncJob) applyVersionedChanges(ctx context.Context, repo repository.VersionedRepository, previousRef, currentRef string) error {
	diff, err := repo.CompareFiles(ctx, previousRef, currentRef)
	if err != nil {
		return fmt.Errorf("compare files error: %w", err)
	}

	if len(diff) < 1 {
		r.jobStatus.Message = "no changes detected between commits"
		return nil
	}

	logger := logging.FromContext(ctx)
	for _, change := range diff {
		if len(r.jobStatus.Errors) > 20 {
			return fmt.Errorf("too many errors")
		}

		if err := r.progress(ctx, *r.jobStatus); err != nil {
			logger.Warn("error notifying progress", "err", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			err = r.writeResourceFromFile(ctx, change.Path, change.Ref, change.Action)
			if err != nil {
				logger.Warn("error writing", "change", change, "err", err)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error loading: %s / %s", change.Path, err.Error()))
			}

		case repository.FileActionDeleted:
			err = r.deleteObject(ctx, change.Path, change.PreviousRef)
			if err != nil {
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error deleting file: %s / %s", change.Path, err.Error()))
				continue
			}

		case repository.FileActionRenamed:
			// 1. Delete
			err = r.deleteObject(ctx, change.Path, change.PreviousRef)
			if err != nil {
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error deleting renamed file: %s / %s", change.Path, err.Error()))
				continue
			}

			// 2. Create
			err = r.writeResourceFromFile(ctx, change.Path, change.Ref, repository.FileActionCreated)
			if err != nil {
				logger.Warn("error writing", "change", change, "err", err)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error loading: %s / %s", change.Path, err.Error()))
			}
		}
	}

	return nil
}

func (r *syncJob) deleteObject(ctx context.Context, path string, ref string) error {
	info, err := r.repository.Read(ctx, path, ref)
	if err != nil {
		return err
	}

	obj, gvk, _ := resources.DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if obj == nil {
		return fmt.Errorf("no object found in: %s", path)
	}

	// Find the referenced file
	objName, _ := resources.NamesFromHashedRepoPath(r.repository.Config().Name, path)

	client, err := r.client(gvk.Kind)
	if err != nil {
		return err
	}
	err = client.Delete(ctx, objName, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("deleting error: %s, %w", path, err)
	}
	r.summary.Delete++

	return nil
}

func (r *syncJob) writeResourceFromFile(ctx context.Context, path string, ref string, action repository.FileAction) error {
	if resources.ShouldIgnorePath(path) {
		return nil // skip
	}

	// Make sure the parent folders exist
	folder, err := r.ensureFolderPathExists(ctx, path)
	if err != nil {
		return err // fail when we can not make folders
	}

	// Read the referenced file
	fileInfo, err := r.repository.Read(ctx, path, ref)
	if err != nil {
		return err
	}

	parsed, err := r.parser.Parse(ctx, fileInfo, false) // no validation
	if err != nil {
		return err
	}

	parsed.Meta.SetFolder(folder)
	parsed.Meta.SetUID("")             // clear identifiers
	parsed.Meta.SetResourceVersion("") // clear identifiers

	switch action {
	case repository.FileActionCreated:
		_, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
		if err != nil {
			return err
		}
		r.summary.Create++

	case repository.FileActionUpdated:
		_, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
		if err != nil {
			return err
		}
		r.summary.Update++

	default:
		return fmt.Errorf("unexpected action: %s", action)
	}
	return nil
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

	traverse := ""

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
