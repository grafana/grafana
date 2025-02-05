package jobs

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// Sync will make grafana look like the contents of the repository
// it will add/remove/update resources in grafana so the results look like a mirror
type Syncer interface {
	Sync(ctx context.Context,
		repo repository.Repository,
		options provisioning.SyncJobOptions,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, *provisioning.SyncStatus, error)
}

// syncer will start sync jobs
type syncer struct {
	parsers *resources.ParserFactory
	lister  resources.ResourceLister
}

// start a job and run it
func (r *syncer) Sync(ctx context.Context,
	repo repository.Repository,
	options provisioning.SyncJobOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, *provisioning.SyncStatus, error) {
	parser, err := r.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}
	dynamicClient := parser.Client()
	if repo.Config().Namespace != dynamicClient.GetNamespace() {
		return nil, nil, fmt.Errorf("namespace mismatch")
	}
	job := &syncJob{
		repository: repo,
		options:    options,
		progress:   progress,
		parser:     parser,
		lister:     r.lister,
		jobStatus:  &provisioning.JobStatus{},
		syncStatus: &provisioning.SyncStatus{},
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
	return job.run(ctx)
}

// created once for each sync execution
type syncJob struct {
	repository repository.Repository
	options    provisioning.SyncJobOptions
	progress   func(provisioning.JobStatus) error

	parser     *resources.Parser
	lister     resources.ResourceLister
	folders    dynamic.ResourceInterface
	dashboards dynamic.ResourceInterface

	changes    []ResourceFileChange
	jobStatus  *provisioning.JobStatus
	syncStatus *provisioning.SyncStatus

	// generic summary for now (not typed)
	summary provisioning.JobResourceSummary
}

func (r *syncJob) run(ctx context.Context) (*provisioning.JobStatus, *provisioning.SyncStatus, error) {
	cfg := r.repository.Config()
	if !cfg.Spec.Sync.Enabled {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateError,
			Message: "sync is not enabled",
		}, nil, nil
	}

	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := r.ensureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
		}, ""); err != nil {
			return nil, nil, fmt.Errorf("unable to create root folder: %w", err)
		}
	}

	var err error
	var currentRef string

	versionedRepo, _ := r.repository.(repository.VersionedRepository)
	if versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return nil, nil, fmt.Errorf("getting latest ref: %w", err)
		}

		if cfg.Status.Sync.Hash != "" && r.options.Incremental {
			if currentRef == cfg.Status.Sync.Hash {
				message := "same commit as last sync"
				r.syncStatus.Hash = currentRef
				r.syncStatus.State = provisioning.JobStateSuccess
				r.syncStatus.Message = append(r.syncStatus.Message, message)
				r.syncStatus.Incremental = true
				return &provisioning.JobStatus{
					State:   provisioning.JobStateSuccess,
					Message: message,
				}, r.syncStatus, nil
			}

			r.changes, err = r.getVersionedChanges(ctx, versionedRepo, cfg.Status.Sync.Hash, currentRef)
			if err != nil {
				return nil, nil, fmt.Errorf("error getting versioned changes: %w", err)
			}
		}
	}

	// Read the complete change set
	if r.changes == nil {
		r.syncStatus.Incremental = false
		target, err := r.lister.List(ctx, cfg.Namespace, cfg.Name)
		if err != nil {
			return nil, nil, fmt.Errorf("error listing current: %w", err)
		}
		source, err := r.repository.ReadTree(ctx, "")
		if err != nil {
			return nil, nil, fmt.Errorf("error reading tree: %w", err)
		}
		r.changes, err = Changes(source, target)
		if err != nil {
			return nil, nil, fmt.Errorf("error calculating changes: %w", err)
		}
	}

	r.syncStatus.Hash = currentRef
	if len(r.changes) == 0 {
		message := "no changes to sync"
		r.syncStatus.State = provisioning.JobStateSuccess
		r.syncStatus.Message = append(r.syncStatus.Message, message)
		return &provisioning.JobStatus{
			State:   provisioning.JobStateSuccess,
			Message: message,
		}, r.syncStatus, nil
	}

	// Now apply the changes
	err = r.applyChanges(ctx, r.changes)
	if err != nil {
		r.jobStatus.State = provisioning.JobStateError
		r.jobStatus.Message = "Sync error: " + err.Error()
		r.syncStatus.State = r.jobStatus.State
		r.syncStatus.Message = append(r.syncStatus.Message, r.jobStatus.Message)
	} else if r.jobStatus.State == "" {
		if len(r.jobStatus.Errors) > 0 {
			r.jobStatus.State = provisioning.JobStateError
		} else {
			r.jobStatus.State = provisioning.JobStateSuccess
		}
	}
	r.jobStatus.Summary = []provisioning.JobResourceSummary{r.summary}
	return r.jobStatus, r.syncStatus, nil
}

func (r *syncJob) applyChanges(ctx context.Context, changes []ResourceFileChange) error {
	// Create an empty tree to avoid loading all folders unnecessarily
	folderTree := resources.NewEmptyFolderTree()
	logger := logging.FromContext(ctx)

	// Create folder structure first
	for _, change := range changes {
		if resources.ShouldIgnorePath(change.Path) {
			r.summary.Noop++
			continue
		}
		if len(r.jobStatus.Errors) > 20 {
			r.jobStatus.Errors = append(r.jobStatus.Errors, "too many errors, stopping")
			r.jobStatus.State = provisioning.JobStateError
			return nil
		}

		if change.Action == provisioning.FileActionDeleted {
			if change.Existing == nil || change.Existing.Name == "" {
				logger.Error("deleted file is missing existing reference", "file", change.Path)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("unable to delete resource from: %s", change.Path))
				continue
			}

			client, err := r.client(change.Existing)
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

		// Make sure the parent folders exist
		folder, err := r.ensureFolderPathExists(ctx, change.Path, folderTree, r.repository.Config())
		if err != nil {
			return err // fail when we can not make folders
		}

		// Read the referenced file
		fileInfo, err := r.repository.Read(ctx, change.Path, "")
		if err != nil {
			r.jobStatus.Errors = append(r.jobStatus.Errors,
				fmt.Sprintf("Unable to read: %s", change.Path),
			)
			continue
		}

		parsed, err := r.parser.Parse(ctx, fileInfo, false) // no validation
		if err != nil {
			logger.Warn("parsing error", "file", change.Path, "err", err)
			r.jobStatus.Errors = append(r.jobStatus.Errors,
				fmt.Sprintf("Unable to parse: %s // %s", change.Path, err.Error()),
			)
			continue
		}

		parsed.Meta.SetFolder(folder)
		parsed.Meta.SetUID("")             // clear identifiers
		parsed.Meta.SetResourceVersion("") // clear identifiers

		switch change.Action {
		case provisioning.FileActionCreated:
			_, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
			if err != nil {
				logger.Warn("create error", "file", change.Path, "err", err)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error creating: %s from %s", parsed.Obj.GetName(), change.Path),
				)
			} else {
				r.summary.Create++
			}

		case provisioning.FileActionUpdated:
			_, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
			if err != nil {
				logger.Warn("update error", "file", change.Path, "err", err)
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error updating: %s from %s", parsed.Obj.GetName(), change.Path),
				)
			} else {
				r.summary.Update++
			}
		default:
			return fmt.Errorf("unexpected action: %s", change.Action)
		}
	}
	return nil
}

// Convert git changes into resource file changes
func (r *syncJob) getVersionedChanges(ctx context.Context, repo repository.VersionedRepository, previousRef, currentRef string) ([]ResourceFileChange, error) {
	diff, err := repo.CompareFiles(ctx, previousRef, currentRef)
	if err != nil {
		return nil, fmt.Errorf("compare files error: %w", err)
	}
	changes := make([]ResourceFileChange, 0, len(diff)+5)
	for _, change := range diff {
		switch change.Action {
		case provisioning.FileActionCreated, provisioning.FileActionUpdated:
			changes = append(changes, ResourceFileChange{
				Path:   change.Path,
				Action: change.Action,
			})

		case provisioning.FileActionDeleted:
			deleteFile, err := r.toDeleteFileChange(ctx, change.Path, change.PreviousRef)
			if err != nil {
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error reading deleted file: %s", change.Path))
				continue
			}
			changes = append(changes, deleteFile)

		case provisioning.FileActionRenamed:
			deleteFile, err := r.toDeleteFileChange(ctx, change.PreviousPath, change.PreviousRef)
			if err != nil {
				r.jobStatus.Errors = append(r.jobStatus.Errors,
					fmt.Sprintf("error reading moved file: %s", change.Path))
				continue
			}
			changes = append(changes, deleteFile, ResourceFileChange{
				Path:   change.Path,
				Action: provisioning.FileActionCreated, // rename = delete + create
			})
		}
	}
	return changes, nil
}

func (r *syncJob) toDeleteFileChange(ctx context.Context, path string, ref string) (ResourceFileChange, error) {
	change := ResourceFileChange{
		Path:   path,
		Action: provisioning.FileActionDeleted,
	}
	info, err := r.repository.Read(ctx, path, ref)
	if err != nil {
		return change, err
	}

	obj, gvk, _ := resources.DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if obj == nil {
		return change, fmt.Errorf("no object found in: %s", path)
	}

	// Find the referenced file
	objName, _ := resources.NamesFromHashedRepoPath(r.repository.Config().Name, path)
	change.Existing = &provisioning.ResourceListItem{
		Group:    gvk.Group,
		Resource: getResourceFromGVK(gvk),
		Name:     objName,
	}
	return change, nil
}

// ensureFolderPathExists creates the folder structure in the cluster.
func (r *syncJob) ensureFolderPathExists(ctx context.Context, filePath string, folderTree *resources.FolderTree, cfg *provisioning.Repository) (parent string, err error) {
	parent = resources.RootFolder(cfg)

	dir := path.Dir(filePath)
	if dir == "." {
		return parent, nil
	}

	f := resources.ParseFolder(dir, cfg.Name)
	if folderTree.In(f.ID) {
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
		if folderTree.In(f.ID) {
			parent = f.ID
			continue
		}

		if err := r.ensureFolderExists(ctx, f, parent); err != nil {
			return "", fmt.Errorf("ensure folder exists: %w", err)
		}
		folderTree.Add(f, parent)
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

func (r *syncJob) client(obj *provisioning.ResourceListItem) (dynamic.ResourceInterface, error) {
	switch obj.Group {
	case dashboard.GROUP:
		switch obj.Resource {
		case dashboard.DASHBOARD_RESOURCE:
			return r.dashboards, nil
		}
	case folders.GROUP:
		switch obj.Resource {
		case folders.RESOURCE:
			return r.folders, nil
		}
	}
	return nil, fmt.Errorf("unsupported resource: %s/%s", obj.Group, obj.Resource)
}

func getResourceFromGVK(gvk *schema.GroupVersionKind) string {
	switch gvk.Group {
	case dashboard.GROUP:
		switch gvk.Kind {
		case "Dashboard":
			return dashboard.DASHBOARD_RESOURCE
		}
	case folders.GROUP:
		switch gvk.Kind {
		case "Folder":
			return folders.RESOURCE
		}
	}
	return ""
}
