package resources

import (
	"context"
	"fmt"
	"sort"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
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
		fid.Path = safepath.Join(t.folders[parent].Title, fid.Path)
		parent = t.tree[parent]
	}
	return fid, ok
}

func (t *FolderTree) Add(folder Folder, parent string) {
	t.tree[folder.ID] = parent
	t.folders[folder.ID] = folder
}

type WalkFunc func(ctx context.Context, folder Folder) error

func (t *FolderTree) Walk(ctx context.Context, fn WalkFunc) error {
	toWalk := make([]Folder, 0, len(t.folders))
	for _, folder := range t.folders {
		folder, _ := t.DirPath(folder.ID, "")
		toWalk = append(toWalk, folder)
	}

	// sort by depth of the paths
	sort.Slice(toWalk, func(i, j int) bool {
		return safepath.Depth(toWalk[i].Path) < safepath.Depth(toWalk[j].Path)
	})

	for _, folder := range toWalk {
		if err := fn(ctx, folder); err != nil {
			return err
		}
	}

	return nil
}

func NewEmptyFolderTree() *FolderTree {
	return &FolderTree{
		tree:    make(map[string]string, 0),
		folders: make(map[string]Folder, 0),
	}
}

func (t *FolderTree) AddUnstructured(item *unstructured.Unstructured, skipRepo string) error {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return fmt.Errorf("extract meta accessor: %w", err)
	}
	manager, _ := meta.GetManagerProperties()
	if manager.Identity == skipRepo {
		return nil // skip it... already in tree?
	}
	folder := Folder{
		Title: meta.FindTitle(item.GetName()),
		ID:    item.GetName(),
	}
	t.tree[folder.ID] = meta.GetFolder()
	t.folders[folder.ID] = folder
	return nil
}

func NewFolderTreeFromResourceList(resources *provisioning.ResourceList) *FolderTree {
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
