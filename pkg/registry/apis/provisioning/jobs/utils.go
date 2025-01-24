package jobs

import (
	"context"
	"path"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// FolderTree contains the entire set of folders (at a given snapshot in time) of the Grafana instance.
// The folders are portrayed as a tree, where a folder has a parent, up until the root folder.
// The root folder is special-cased as a folder that exists, but is not itself stored. It has no ID, no title, and no data, but will return `true` for OK bools.
type folderTree struct {
	tree    map[string]string
	folders map[string]resources.FolderID
}

// In determines if the given folder is in the tree at all. That is, it answers "does the folder even exist in the Grafana instance?"
// An empty folder string means the root folder, and is special-cased to always return true.
func (t *folderTree) In(folder string) bool {
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
func (t *folderTree) DirPath(folder, baseFolder string) (fid resources.FolderID, ok bool) {
	if !t.In(folder) || !t.In(baseFolder) {
		return resources.FolderID{}, false
	}
	if folder == "" && baseFolder != "" {
		return resources.FolderID{}, false
	} else if folder == baseFolder {
		// Zero-value: we're fine with the zv if we're working with the root folder here.
		// Any other folder ID will have the correct metadata and no path (which is correct).
		return t.folders[folder], true
	}

	fid = t.folders[folder]
	fid.Path = folder
	ok = baseFolder == ""

	parent := t.tree[folder]
	for parent != "" {
		if parent == baseFolder {
			ok = true
			break
		}
		fid.Path = path.Join(parent, fid.Path)
		parent = t.tree[parent]
	}
	return fid, ok
}

func fetchRepoFolderTree(ctx context.Context, client *resources.DynamicClient) (*folderTree, error) {
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
	tree[""] = "" // the root has no further parents
	folders := make(map[string]resources.FolderID, len(rawFolders.Items))
	for _, rf := range rawFolders.Items {
		name := rf.GetName()
		// TODO: Can I use MetaAccessor here?
		parent := rf.GetAnnotations()[apiutils.AnnoKeyFolder]
		tree[name] = parent

		id := resources.FolderID{
			Title:          name,
			KubernetesName: name,
			Path:           "", // We'll set this later in the DirPath function :)
		}
		if title, ok, _ := unstructured.NestedString(rf.Object, "spec", "title"); ok {
			// If the title doesn't exist (it should), we'll just use the K8s name.
			id.Title = title
		}
		folders[name] = id
	}

	return &folderTree{
		tree:    tree,
		folders: folders,
	}, nil
}
