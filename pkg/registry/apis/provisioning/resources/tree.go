package resources

import (
	"context"
	"fmt"
	"path"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// FolderTree contains the entire set of folders (at a given snapshot in time) of the Grafana instance.
// The folders are portrayed as a tree, where a folder has a parent, up until the root folder.
// The root folder is special-cased as a folder that exists, but is not itself stored. It has no ID, no title, and no data, but will return `true` for OK bools.
type FolderTree struct {
	tree    map[string]string
	folders map[string]Folder
}

// In determines if the given folder is in the tree at all. That is, it answers "does the folder even exist in the Grafana instance?"
// An empty folder string means the root folder, and is special-cased to always return true.
func (t *FolderTree) In(folder string) bool {
	_, ok := t.tree[folder]
	return ok || folder == ""
}

// DirPath creates the path to the directory with slashes, up to but not including the baseFolder.
// The baseFolder is expected to be the repository's root folder, as defined by its spec. If this is used in other contexts, it should still function.
// An empty folder string means the root folder, and is special-cased to return no ID data.
// The returned Path field in the ID is relative to the base folder. If it is the base folder, an empty string is returned.
//
// If In(folder) or In(baseFolder) is false, this will return ok=false, because it would be undefined behaviour.
// If baseFolder is not a parent of folder, ok=false is returned.
func (t *FolderTree) DirPath(folder, baseFolder string) (fid Folder, ok bool) {
	if !t.In(folder) || !t.In(baseFolder) {
		return Folder{}, false
	}
	if folder == "" && baseFolder != "" {
		return Folder{}, false
	} else if folder == baseFolder {
		// Zero-value: we're fine with the zv if we're working with the root folder here.
		// Any other folder ID will have the correct metadata and no path (which is correct).
		return t.folders[folder], true
	}

	fid = t.folders[folder]
	fid.Path = fid.Title
	ok = baseFolder == ""

	parent := t.tree[folder]
	for parent != "" {
		if parent == baseFolder {
			ok = true
			break
		}
		fid.Path = path.Join(t.folders[parent].Title, fid.Path)
		parent = t.tree[parent]
	}
	return fid, ok
}

func (t *FolderTree) AllFolders() map[string]Folder {
	return t.folders
}

func NewEmptyFolderTree() *FolderTree {
	return &FolderTree{
		tree:    make(map[string]string, 0),
		folders: make(map[string]Folder, 0),
	}
}

func (t *FolderTree) CreateFolder(ctx context.Context, client *DynamicClient, folder string, repository *provisioning.Repository) error {
	iface := client.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	dir := folder
	if dir == "." || dir == "/" {
		return nil
	}

	logger := logging.FromContext(ctx).With("folder", folder)
	var currentPath string
	parent := repository.Spec.Folder

	for _, folder := range strings.Split(dir, "/") {
		if folder == "" {
			// Trailing / leading slash?
			continue
		}

		currentPath = path.Join(currentPath, folder)
		folderID := ParseFolder(currentPath, repository.GetName())
		logger := logger.With("folder", currentPath)

		if t.tree[folderID.ID] != "" {
			logger.Debug("folder already visited")
			continue
		}

		t.tree[folderID.ID] = parent
		t.folders[folderID.ID] = folderID

		obj, err := iface.Get(ctx, folderID.ID, metav1.GetOptions{})
		// FIXME: Check for IsNotFound properly
		if obj != nil || err == nil {
			logger.Debug("folder already existed")
			parent = folderID.ID
			continue
		}

		obj = &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":       folderID.Title,
					"description": "Repository-managed folder.",
				},
			},
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("create meta accessor for the object: %w", err)
		}

		obj.SetNamespace(client.GetNamespace())
		obj.SetName(folderID.ID)
		meta.SetFolder(parent)
		meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
			Name:      repository.GetName(),
			Path:      currentPath,
			Hash:      "",  // FIXME: which hash?
			Timestamp: nil, // ???&info.Modified.Time,
		})

		_, err = iface.Create(ctx, obj, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create folder '%s': %w", folderID.ID, err)
		}

		parent = folderID.ID
		logger.Info("folder created")
	}
	return nil
}

func FetchRepoFolderTree(ctx context.Context, client *DynamicClient) (*FolderTree, error) {
	iface := client.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	// TODO: handle pagination
	rawFolders, err := iface.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	tree := make(map[string]string, len(rawFolders.Items))
	folders := make(map[string]Folder, len(rawFolders.Items))
	for _, rf := range rawFolders.Items {
		name := rf.GetName()
		// TODO: Can I use MetaAccessor here?
		parent := rf.GetAnnotations()[apiutils.AnnoKeyFolder]
		tree[name] = parent

		id := Folder{
			Title: name,
			ID:    name,
			// TODO: should not this be be the annotation itself?
			Path: "", // We'll set this later in the DirPath function :)
		}
		if title, ok, _ := unstructured.NestedString(rf.Object, "spec", "title"); ok {
			// If the title doesn't exist (it should), we'll just use the K8s name.
			id.Title = title
		}
		folders[name] = id
	}

	return &FolderTree{
		tree:    tree,
		folders: folders,
	}, nil
}

func FolderTreeFromResourceList(resources *provisioning.ResourceList) *FolderTree {
	tree := make(map[string]string, len(resources.Items))
	folderIDs := make(map[string]Folder, len(resources.Items))
	for _, rf := range resources.Items {
		if rf.Group != folders.GROUP {
			continue
		}

		tree[rf.Name] = rf.Folder
		folderIDs[rf.Name] = Folder{
			Title: rf.Title,
			ID:    rf.Name,
			Path:  rf.Path,
		}
	}

	return &FolderTree{
		tree,
		folderIDs,
	}
}
