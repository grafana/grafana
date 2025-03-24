package resources

import (
	"context"
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
	if fm.lookup.In(f.ID) {
		return f.ID, nil
	}

	err = safepath.Walk(ctx, f.Path, func(ctx context.Context, traverse string) error {
		f := ParseFolder(traverse, cfg.GetName())
		if fm.lookup.In(f.ID) {
			parent = f.ID
			return nil
		}

		if err := fm.EnsureFolderExists(ctx, f, parent); err != nil {
			return fmt.Errorf("ensure folder exists: %w", err)
		}

		fm.lookup.Add(f, parent)
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
