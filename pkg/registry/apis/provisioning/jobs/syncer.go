package jobs

import (
	"context"
	"errors"
	"fmt"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type UnsyncOptions struct {
	KeepDashboards bool
}

type Syncer struct {
	client     *resources.DynamicClient
	parser     *resources.Parser
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewSyncer(
	repo repository.Repository,
	parser *resources.Parser,
) (*Syncer, error) {
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	return &Syncer{
		parser:     parser,
		client:     dynamicClient,
		folders:    folders,
		repository: repo,
	}, nil
}

// Sync replicates all files in the repository.
func (r *Syncer) Sync(ctx context.Context) (string, error) {
	// FIXME: how to handle the scenario in which folder changes?
	cfg := r.repository.Config()
	lastCommit := cfg.Status.Sync.Hash
	versionedRepo, isVersioned := r.repository.(repository.VersionedRepository)

	if err := r.ensureRepositoryFolderExists(ctx); err != nil {
		return "", fmt.Errorf("ensure repository folder exists: %w", err)
	}

	logger := logging.FromContext(ctx)
	var latest string
	switch {
	case !isVersioned:
		logger.Info("replicate tree unversioned repository")
		if err := r.replicateTree(ctx, ""); err != nil {
			return "", fmt.Errorf("replicate tree: %w", err)
		}
	case lastCommit == "":
		var err error
		latest, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return "", fmt.Errorf("latest ref: %w", err)
		}
		if err := r.replicateTree(ctx, latest); err != nil {
			return latest, fmt.Errorf("replicate tree: %w", err)
		}
		logger.Info("initial replication for versioned repository", "latest", latest)
	default:
		var err error
		latest, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return "", fmt.Errorf("latest ref: %w", err)
		}

		logger.Info("replicate changes for versioned repository", "last_commit", lastCommit, "latest", latest)
		changes, err := versionedRepo.CompareFiles(ctx, lastCommit, latest)
		if err != nil {
			return latest, fmt.Errorf("compare files: %w", err)
		}

		if err := r.replicateChanges(ctx, changes); err != nil {
			return latest, fmt.Errorf("replicate changes: %w", err)
		}
	}

	return latest, nil
}

func (r *Syncer) Unsync(ctx context.Context, opts UnsyncOptions) error {
	cfg := r.repository.Config()

	logger := logging.FromContext(ctx)
	logger = logger.With("repository", cfg.Name, "namespace", cfg.GetNamespace(), "folder", cfg.Spec.Folder)
	logger.Info("start repository unsync")
	defer logger.Info("end repository unsync")

	if r.repository.Config().Spec.Folder != "" {
		obj, err := r.folders.Get(ctx, r.repository.Config().Spec.Folder, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get folder to unsync: %w", err)
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("create meta accessor from folder object: %w", err)
		}

		meta.SetRepositoryInfo(nil)
		obj, err = r.folders.Update(ctx, obj, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("remove repo info from folder: %w", err)
		}

		logger.Info("removed repo info from folder", "object", obj)
	} else {
		logger.Info("skip repo info removal as it's root folder")
	}

	return nil
}

// replicateTree replicates all files in the repository.
func (r *Syncer) replicateTree(ctx context.Context, ref string) error {
	tree, err := r.repository.ReadTree(ctx, ref)
	if err != nil {
		return fmt.Errorf("read tree: %w", err)
	}

	for _, entry := range tree {
		logger := logging.FromContext(ctx).With("file", entry.Path)
		if !entry.Blob {
			logger.Debug("ignoring non-blob entry")
			continue
		}

		if resources.ShouldIgnorePath(entry.Path) {
			logger.Debug("ignoring file")
			continue
		}

		info, err := r.repository.Read(ctx, entry.Path, ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		// The parse function will fill in the repository metadata, so copy it over here
		info.Hash = entry.Hash
		info.Modified = nil // modified?

		if err := r.replicateFile(ctx, info); err != nil {
			if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
				logger.Info("file does not contain a resource")
				continue
			}
			return fmt.Errorf("replicate file: %w", err)
		}
	}

	return nil
}

// replicateFile creates a new resource in the cluster.
// If the resource already exists, it will be updated.
func (r *Syncer) replicateFile(ctx context.Context, fileInfo *repository.FileInfo) error {
	logger := logging.FromContext(ctx).With("file", fileInfo.Path, "ref", fileInfo.Ref)
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}
	logger = logger.With("action", file.Action, "name", file.Obj.GetName(), "file_namespace", file.Obj.GetNamespace(), "namespace", r.client.GetNamespace())

	parent, err := r.createFolderPath(ctx, fileInfo.Path)
	if err != nil {
		return fmt.Errorf("failed to create folder path: %w", err)
	}
	logger = logger.With("folder", parent)

	if parent != "" {
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
		if gen := existingMeta.GetGeneration(); gen != 0 {
			logger.Debug("updating file's UID with existing generation + 1", "generation", gen, "new_generation", gen+1)
			file.Meta.SetGeneration(gen + 1)
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

func (r *Syncer) createFolderPath(ctx context.Context, filePath string) (string, error) {
	dir := path.Dir(filePath)
	parent := r.repository.Config().Spec.Folder
	if dir == "." || dir == "/" {
		return parent, nil
	}

	logger := logging.FromContext(ctx).With("file", filePath)

	var currentPath string
	for _, folder := range strings.Split(dir, "/") {
		if folder == "" {
			// Trailing / leading slash?
			continue
		}

		currentPath = path.Join(currentPath, folder)

		logger := logger.With("folder", folder)
		obj, err := r.folders.Get(ctx, folder, metav1.GetOptions{})
		// FIXME: Check for IsNotFound properly
		if obj != nil || err == nil {
			logger.Debug("folder already existed")
			parent = folder
			continue
		}

		obj = &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":       folder, // TODO: how do we want to get this?
					"description": "Repository-managed folder.",
				},
			},
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return "", fmt.Errorf("create meta accessor for the object: %w", err)
		}

		obj.SetNamespace(r.client.GetNamespace())
		obj.SetName(folder)
		meta.SetFolder(parent)
		meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
			Name:      r.repository.Config().Name,
			Path:      currentPath,
			Hash:      "",  // FIXME: which hash?
			Timestamp: nil, // ???&info.Modified.Time,
		})

		_, err = r.folders.Create(ctx, obj, metav1.CreateOptions{})
		if err != nil {
			return parent, fmt.Errorf("failed to create folder '%s': %w", folder, err)
		}

		parent = folder
		logger.Info("folder created")
	}

	return parent, nil
}

func (r *Syncer) replicateChanges(ctx context.Context, changes []repository.FileChange) error {
	for _, change := range changes {
		if resources.ShouldIgnorePath(change.Path) {
			continue
		}

		fileInfo, err := r.repository.Read(ctx, change.Path, change.Ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			if err := r.replicateFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("replicate file: %w", err)
			}
		case repository.FileActionRenamed:
			// delete in old path
			oldPath, err := r.repository.Read(ctx, change.PreviousPath, change.Ref)
			if err != nil {
				return fmt.Errorf("read previous path: %w", err)
			}
			if err := r.deleteFile(ctx, oldPath); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}

			if err := r.replicateFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("replicate file in new path: %w", err)
			}
		case repository.FileActionDeleted:
			if err := r.deleteFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}
		}
	}

	return nil
}

func (r *Syncer) deleteFile(ctx context.Context, fileInfo *repository.FileInfo) error {
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}

	_, err = file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
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

	// TODO: delete folders if empty recursively

	return nil
}

func (r *Syncer) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*resources.ParsedResource, error) {
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

func (r *Syncer) ensureRepositoryFolderExists(ctx context.Context) error {
	if r.repository.Config().Spec.Folder == "" {
		return nil
	}

	obj, err := r.folders.Get(ctx, r.repository.Config().Spec.Folder, metav1.GetOptions{})
	if err == nil {
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("create meta accessor for the object: %w", err)
		}

		meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
			Name:      r.repository.Config().Name,
			Path:      "",
			Hash:      "",  // FIXME: which hash?
			Timestamp: nil, // ???&info.Modified.Time,
		})

		if _, err := r.folders.Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("failed to add repo info to configured folder: %w", err)
		}

		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if folder exists: %w", err)
	}

	cfg := r.repository.Config()
	title := cfg.Spec.Title
	if title == "" {
		title = cfg.Spec.Folder
	}

	obj = &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]any{
				"title": title, // TODO: how do we want to get this?
			},
		},
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("create meta accessor for the object: %w", err)
	}

	obj.SetNamespace(cfg.GetNamespace())
	obj.SetName(cfg.Spec.Folder)
	meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
		Name:      r.repository.Config().Name,
		Path:      "",
		Hash:      "",  // FIXME: which hash?
		Timestamp: nil, // ???&info.Modified.Time,
	})

	if _, err := r.folders.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	return nil
}
