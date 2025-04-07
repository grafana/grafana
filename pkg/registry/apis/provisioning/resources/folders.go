package resources

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

const maxFolders = 10000

type FolderManager struct {
	repo   repository.ReaderWriter
	tree   FolderTree
	client dynamic.ResourceInterface
}

func NewFolderManager(repo repository.ReaderWriter, client dynamic.ResourceInterface, lookup FolderTree) *FolderManager {
	return &FolderManager{
		repo:   repo,
		tree:   lookup,
		client: client,
	}
}

func (fm *FolderManager) Client() dynamic.ResourceInterface {
	return fm.client
}

func (fm *FolderManager) Tree() FolderTree {
	return fm.tree
}

func (fm *FolderManager) SetTree(tree FolderTree) {
	fm.tree = tree
}

// EnsureFoldersExist creates the folder structure in the cluster.
func (fm *FolderManager) EnsureFolderPathExist(ctx context.Context, filePath string) (parent string, err error) {
	cfg := fm.repo.Config()
	parent = RootFolder(cfg)

	dir := filePath
	if !safepath.IsDir(filePath) {
		dir = safepath.Dir(filePath)
	}

	if dir == "" {
		return parent, nil
	}

	f := ParseFolder(dir, cfg.Name)
	if fm.tree.In(f.ID) {
		return f.ID, nil
	}

	err = safepath.Walk(ctx, f.Path, func(ctx context.Context, traverse string) error {
		f := ParseFolder(traverse, cfg.GetName())
		if fm.tree.In(f.ID) {
			parent = f.ID
			return nil
		}

		if err := fm.EnsureFolderExists(ctx, f, parent); err != nil {
			return fmt.Errorf("ensure folder exists: %w", err)
		}

		fm.tree.Add(f, parent)
		parent = f.ID
		return nil
	})

	if err != nil {
		return "", err
	}

	return f.ID, nil
}

// EnsureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
func (fm *FolderManager) EnsureFolderExists(ctx context.Context, folder Folder, parent string) error {
	cfg := fm.repo.Config()
	obj, err := fm.client.Get(ctx, folder.ID, metav1.GetOptions{})
	if err == nil {
		current, ok := obj.GetAnnotations()[utils.AnnoKeyManagerIdentity]
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
		return fmt.Errorf("failed to create folder: %w", err)
	}
	return nil
}

func (fm *FolderManager) GetFolder(ctx context.Context, name string) (*unstructured.Unstructured, error) {
	return fm.client.Get(ctx, name, metav1.GetOptions{})
}

// ReplicateTree replicates the folder tree to the repository.
// The function fn is called for each folder.
// If the folder already exists, the function is called with created set to false.
// If the folder is created, the function is called with created set to true.
func (fm *FolderManager) EnsureTreeExists(ctx context.Context, ref, path string, fn func(folder Folder, created bool, err error) error) error {
	return fm.tree.Walk(ctx, func(ctx context.Context, folder Folder) error {
		p := folder.Path
		if path != "" {
			p = safepath.Join(path, p)
		}
		if !safepath.IsDir(p) {
			p = p + "/" // trailing slash indicates folder
		}

		_, err := fm.repo.Read(ctx, p, ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			return fn(folder, false, fmt.Errorf("check if folder exists before writing: %w", err))
		} else if err == nil {
			return fn(folder, false, nil)
		}

		msg := fmt.Sprintf("Add folder %s", p)
		if err := fm.repo.Create(ctx, p, ref, nil, msg); err != nil {
			return fn(folder, true, fmt.Errorf("write folder in repo: %w", err))
		}

		return fn(folder, true, nil)
	})
}

func (fm *FolderManager) LoadFromServer(ctx context.Context) error {
	return ForEach(ctx, fm.client, func(item *unstructured.Unstructured) error {
		if fm.tree.Count() > maxFolders {
			return errors.New("too many folders")
		}

		return fm.tree.AddUnstructured(item, fm.repo.Config().Name)
	})
}
