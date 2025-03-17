package resources

import (
	"context"
	"errors"
	"fmt"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

var (
	ErrFolderUnmanaged       = errors.New("folder is not managed")
	ErrFolderManagedByOthers = errors.New("folder is managed by another repository")
)

type FolderManager struct {
	repo   repository.Repository
	lookup *FolderTree
	client dynamic.ResourceInterface
}

func NewFolderManager(repo repository.Repository, client dynamic.ResourceInterface) *FolderManager {
	return &FolderManager{
		repo:   repo,
		lookup: NewEmptyFolderTree(),
		client: client,
	}
}

func (fm *FolderManager) Client() dynamic.ResourceInterface {
	return fm.client
}

// EnsureFoldersExist creates the folder structure in the cluster.
func (fm *FolderManager) EnsureFolderPathExist(ctx context.Context, filePath string) (parent string, err error) {
	if filePath == "" || filePath == "/" || filePath == "." || filePath == "./" {
		return "", fmt.Errorf("invald initial path")
	}

	cfg := fm.repo.Config()
	parent = RootFolder(cfg)

	dir := filePath
	if !strings.HasSuffix(filePath, "/") {
		dir = path.Dir(filePath)
	}
	if dir == "." {
		return parent, nil
	}

	f := ParseFolder(dir, cfg.Name)
	if fm.lookup.In(f.ID) {
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

		f := ParseFolder(traverse, cfg.GetName())
		if fm.lookup.In(f.ID) {
			parent = f.ID
			continue
		}

		if err := fm.EnsureFolderExists(ctx, f, parent); err != nil {
			return "", fmt.Errorf("ensure folder exists: %w", err)
		}
		fm.lookup.Add(f, parent)
		parent = f.ID
	}

	return f.ID, err
}

// EnsureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
func (fm *FolderManager) EnsureFolderExists(ctx context.Context, folder Folder, parent string) error {
	cfg := fm.repo.Config()
	exists, err := fm.checkFolderIsOurs(ctx, folder)
	if err != nil || exists {
		return err
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]any{
				"title": folder.Title,
			},
		},
	}
	obj.SetAPIVersion(v0alpha1.APIVERSION)
	obj.SetKind(v0alpha1.FolderResourceInfo.GroupVersionKind().Kind)
	obj.SetNamespace(cfg.GetNamespace())
	obj.SetName(folder.ID)

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("create meta accessor for the object: %w", err)
	}

	if parent != "" {
		meta.SetFolder(parent)
	}
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: cfg.GetName(),
	})
	meta.SetSourceProperties(utils.SourceProperties{
		Path: folder.Path,
	})

	if _, err := fm.client.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		if apierrors.IsConflict(err) {
			// Might be a race of two jobs causing this code to run.
			exists, err := fm.checkFolderIsOurs(ctx, folder)
			if err != nil || exists {
				return err
			}
		}
		return fmt.Errorf("failed to create folder: %w", err)
	}
	return nil
}

func (fm *FolderManager) checkFolderIsOurs(ctx context.Context, folder Folder) (exists bool, err error) {
	cfg := fm.repo.Config()
	obj, err := fm.client.Get(ctx, folder.ID, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		// The folder simply doesn't exist. There is no ownership to check.
		return false, nil
	} else if err != nil {
		// Another error occurred. This is unexpected.
		return false, fmt.Errorf("failed to get folder: %w", err)
	}
	// exists should always be true by now.

	current, ok := obj.GetAnnotations()[utils.AnnoKeyManagerIdentity]
	if !ok {
		return true, ErrFolderUnmanaged
	}
	if current != cfg.Name {
		return true, fmt.Errorf("%w (current owner is %s, we are %s)", ErrFolderManagedByOthers, current, cfg.Name)
	}
	return true, nil
}

func (fm *FolderManager) GetFolder(ctx context.Context, name string) (*unstructured.Unstructured, error) {
	return fm.client.Get(ctx, name, metav1.GetOptions{})
}
