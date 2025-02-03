package jobs

import (
	"context"
	"errors"
	"fmt"
	"path"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type Syncer interface {
	Sync(ctx context.Context,
		repo repository.Repository,
		options provisioning.SyncJobOptions,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, *provisioning.SyncStatus, error)
}

type syncer struct {
	parser     *resources.Parser
	lister     resources.ResourceLister
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewSyncer(
	repo repository.Repository,
	lister resources.ResourceLister,
	parser *resources.Parser,
) (Syncer, error) {
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})

	return &syncer{
		parser:     parser,
		lister:     lister,
		folders:    folders,
		repository: repo,
	}, nil
}

// Sync replicates all files in the repository.
func (r *syncer) Sync(ctx context.Context,
	repo repository.Repository,
	options provisioning.SyncJobOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, *provisioning.SyncStatus, error) {
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

	syncStatus := &provisioning.SyncStatus{}
	logger := logging.FromContext(ctx)
	var err error
	var changes []repository.FileChange
	versionedRepo, isVersioned := r.repository.(repository.VersionedRepository)
	currentRef := ""

	if isVersioned && versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return nil, nil, fmt.Errorf("getting latest ref: %w", err)
		}
	}

	if isVersioned && cfg.Status.Sync.Hash != "" && !options.Complete {
		if currentRef == cfg.Status.Sync.Hash {
			message := "same commit as last sync"
			syncStatus.State = provisioning.JobStateSuccess
			syncStatus.Message = append(syncStatus.Message, message)
			return &provisioning.JobStatus{
				State:   provisioning.JobStateSuccess,
				Message: message,
			}, syncStatus, nil
		}

		logger.Info("get list of changes", "last_commit", cfg.Status.Sync.Hash, "latest", currentRef)
		changes, err = versionedRepo.CompareFiles(ctx, cfg.Status.Sync.Hash, currentRef)
		if err != nil {
			return nil, nil, fmt.Errorf("compare files: %w", err)
		}
	} else {
		target, err := r.lister.List(ctx, cfg.Namespace, cfg.Name)
		if err != nil {
			return nil, nil, fmt.Errorf("error listing current: %w", err)
		}
		source, err := repo.ReadTree(ctx, "")
		if err != nil {
			return nil, nil, fmt.Errorf("error reading tree: %w", err)
		}

		changes, err = repository.Changes(source, target)
		if err != nil {
			return nil, nil, fmt.Errorf("error calculating changes: %w", err)
		}
		for i := range changes {
			changes[i].Ref = "" // clear the refs so we do not try to write them
		}
	}

	if len(changes) == 0 {
		message := "no changes to sync"
		syncStatus.State = provisioning.JobStateSuccess
		syncStatus.Message = append(syncStatus.Message, message)
		return &provisioning.JobStatus{
			State:   provisioning.JobStateSuccess,
			Message: message,
		}, syncStatus, nil
	}

	if err := r.replicateChanges(ctx, changes); err != nil {
		return nil, nil, fmt.Errorf("replicate changes: %w", err)
	}

	message := fmt.Sprintf("processed %d changes", len(changes))
	syncStatus.State = provisioning.JobStateSuccess
	return &provisioning.JobStatus{
		State:   provisioning.JobStateSuccess,
		Message: message,
	}, syncStatus, nil
}

// replicateFile creates a new resource in the cluster.
// If the resource already exists, it will be updated.
func (r *syncer) replicateFile(ctx context.Context, file *resources.ParsedResource, folderTree *resources.FolderTree) error {
	logger := logging.FromContext(ctx).With("file", file.Info.Path, "ref", file.Info.Ref)
	logger = logger.With("action", file.Action, "name", file.Obj.GetName(), "file_namespace", file.Obj.GetNamespace())

	parent := resources.ParentFolder(file.Info.Path, r.repository.Config())
	logger = logger.With("folder", parent)
	if parent != "" {
		if !folderTree.In(parent) {
			return fmt.Errorf("failed to find parent in tree for %s in %s", file.Info.Path, parent)
		}
		file.Meta.SetFolder(parent)
	}

	if file.Action == provisioning.ResourceActionCreate {
		_, err := file.Client.Create(ctx, file.Obj, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create object: %w", err)
		}
	} else if file.Action == provisioning.ResourceActionUpdate {
		existingMeta, err := utils.MetaAccessor(file.Existing)
		if err != nil {
			return fmt.Errorf("failed to create meta accessor for the existing object: %w", err)
		}

		// Just in case no uid is present on the metadata for some reason.
		logger := logger.With("previous_uid", file.Meta.GetUID(), "previous_resource_version", existingMeta.GetResourceVersion())
		if uid, ok, _ := unstructured.NestedString(file.Existing.Object, "spec", "uid"); ok {
			logger.Debug("updating file's UID with spec.uid", "uid", uid)
			file.Meta.SetUID(types.UID(uid))
		}
		if uid := existingMeta.GetUID(); uid != "" {
			logger.Debug("updating file's UID with existing meta uid", "uid", uid)
			file.Meta.SetUID(uid)
		}
		if rev := existingMeta.GetResourceVersion(); rev != "" {
			logger.Debug("updating file's UID with existing resource version", "version", rev)
			file.Meta.SetResourceVersion(rev)
		}

		_, err = file.Client.Update(ctx, file.Obj, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update object: %w", err)
		}
	} else {
		logger.Error("bug in Grafana: the file's action is unhandled")
		return fmt.Errorf("bug in Grafana: got a file.Action of '%s', which is not defined to be handled", file.Action)
	}

	logger.Info("Replicated file")

	return nil
}

func (r *syncer) replicateChanges(ctx context.Context, changes []repository.FileChange) error {
	// Create an empty tree to avoid loading all folders unnecessarily
	folderTree := resources.NewEmptyFolderTree()

	// Create folder structure first
	for _, change := range changes {
		if change.Action == repository.FileActionDeleted {
			// FIXME: this will leave empty folder behind until the next sync
			continue
		}

		parent := resources.ParentFolder(path.Dir(change.Path), r.repository.Config())
		if err := r.ensureFolderPathExists(ctx, path.Dir(change.Path), parent, folderTree); err != nil {
			return fmt.Errorf("ensure folder path exists: %w", err)
		}
	}

	// Replicate the file changes
	for _, change := range changes {
		if resources.ShouldIgnorePath(change.Path) {
			continue
		}

		fileInfo, err := r.repository.Read(ctx, change.Path, change.Ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		parsed, err := r.parseResource(ctx, fileInfo)
		if err != nil {
			return fmt.Errorf("parse resource: %w", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			if err := r.replicateFile(ctx, parsed, folderTree); err != nil {
				return fmt.Errorf("replicate file: %w", err)
			}
		case repository.FileActionRenamed:
			// delete in old path
			oldPath, err := r.repository.Read(ctx, change.PreviousPath, change.Ref)
			if err != nil {
				return fmt.Errorf("read previous path: %w", err)
			}
			oldParsed, err := r.parseResource(ctx, oldPath)
			if err != nil {
				return fmt.Errorf("parse old resource: %w", err)
			}
			if err := r.deleteFile(ctx, oldParsed); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}
			if err := r.replicateFile(ctx, parsed, folderTree); err != nil {
				return fmt.Errorf("replicate file in new path: %w", err)
			}
		case repository.FileActionDeleted:
			if err := r.deleteFile(ctx, parsed); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}
		}
	}

	return nil
}

func (r *syncer) deleteFile(ctx context.Context, file *resources.ParsedResource) error {
	_, err := file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if err != nil { // IsNotFound
		return fmt.Errorf("get object to delete: %w", err)
	}

	if err = file.Client.Delete(ctx, file.Obj.GetName(), metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	return nil
}

func (r *syncer) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*resources.ParsedResource, error) {
	file, err := r.parser.Parse(ctx, fileInfo, true)
	if err != nil {
		return nil, fmt.Errorf("failed to parse file %s: %w", fileInfo.Path, err)
	}

	if file.GVR == nil {
		return nil, errors.New("parsed file is missing GVR")
	}

	if file.Client == nil {
		return nil, errors.New("parsed file is missing client")
	}

	return file, nil
}

// ensureFolderPathExists creates the folder structure in the cluster.
func (r *syncer) ensureFolderPathExists(ctx context.Context, dirPath, parent string, folderTree *resources.FolderTree) error {
	return safepath.Walk(ctx, dirPath, func(ctx context.Context, path string) error {
		fid := resources.ParseFolder(path, r.repository.Config().GetName())
		if folderTree.In(fid.ID) {
			// already visited
			parent = fid.ID
			return nil
		}

		if err := r.ensureFolderExists(ctx, fid, parent); err != nil {
			return fmt.Errorf("ensure folder exists: %w", err)
		}

		folderTree.Add(fid, parent)
		parent = fid.ID

		return nil
	})
}

// ensureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
func (r *syncer) ensureFolderExists(ctx context.Context, folder resources.Folder, parent string) error {
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
