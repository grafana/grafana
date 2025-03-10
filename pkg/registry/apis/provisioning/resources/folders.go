package resources

import (
	"context"
	"fmt"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type FolderManager struct {
	Repo   repository.Repository
	Lookup *FolderTree
	Client dynamic.ResourceInterface
}

// EnsureFoldersExist creates the folder structure in the cluster.
func (fm *FolderManager) EnsureFolderPathExist(ctx context.Context, filePath string) (parent string, err error) {
	if filePath == "" || filePath == "/" || filePath == "." || filePath == "./" {
		return "", fmt.Errorf("invald initial path")
	}

	cfg := fm.Repo.Config()
	parent = RootFolder(cfg)

	dir := filePath
	if !strings.HasSuffix(filePath, "/") {
		dir = path.Dir(filePath)
	}
	if dir == "." {
		return parent, nil
	}

	if fm.Lookup == nil {
		fm.Lookup = NewEmptyFolderTree()
	}

	f := ParseFolder(dir, cfg.Name)
	if fm.Lookup.In(f.ID) {
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
		if fm.Lookup.In(f.ID) {
			parent = f.ID
			continue
		}

		if err := fm.EnsureFolderExists(ctx, f, parent); err != nil {
			return "", fmt.Errorf("ensure folder exists: %w", err)
		}
		fm.Lookup.Add(f, parent)
		parent = f.ID
	}

	return f.ID, err
}

// ensureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
func (fm *FolderManager) EnsureFolderExists(ctx context.Context, folder Folder, parent string) error {
	cfg := fm.Repo.Config()
	obj, err := fm.Client.Get(ctx, folder.ID, metav1.GetOptions{})
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

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("create meta accessor for the object: %w", err)
	}

	obj.SetNamespace(cfg.GetNamespace())
	obj.SetName(folder.ID)
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

	if _, err := fm.Client.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}
	return nil
}
