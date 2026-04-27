package resources

import (
	"context"
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// FolderTree contains the entire set of folders (at a given snapshot in time) of the Grafana instance.
// The folders are portrayed as a tree, where a folder has a parent, up until the root folder.
// The root folder is special-cased as a folder that exists, but is not itself stored. It has no ID, no title, and no data, but will return `true` for OK bools.
//
//go:generate mockery --name FolderTree --structname MockFolderTree --inpackage --filename tree_mock.go --with-expecter
type FolderTree interface {
	In(folder string) bool
	Get(folderID string) (Folder, bool)
	GetByPath(path string) (Folder, bool)
	DirPath(folder, baseFolder string) (Folder, bool)
	Add(folder Folder, parent string)
	Remove(folderID string)
	AddUnstructured(item *unstructured.Unstructured) error
	Count() int
	Walk(ctx context.Context, fn WalkFunc) error
}

type folderTree struct {
	tree    map[string]string
	folders map[string]Folder
	paths   map[string]string
	count   int
	mu      sync.RWMutex
}

// In determines if the given folder is in the tree at all. That is, it answers "does the folder even exist in the Grafana instance?"
// An empty folder string means the root folder, and is special-cased to always return true.
func (t *folderTree) In(folder string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.in(folder)
}

// in is the unlocked implementation of In used by helpers that already hold the mutex.
func (t *folderTree) in(folder string) bool {
	_, ok := t.tree[folder]
	return ok || folder == ""
}

// Get returns the folder entry stored for a specific folder UID.
func (t *folderTree) Get(folderID string) (Folder, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	f, ok := t.folders[folderID]
	return f, ok
}

// GetByPath returns the folder entry stored at the given source path.
// Paths are normalized to trailing-slash directory form.
func (t *folderTree) GetByPath(path string) (Folder, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	folderID, ok := t.paths[safepath.EnsureTrailingSlash(path)]
	if !ok {
		return Folder{}, false
	}

	f, ok := t.folders[folderID]
	return f, ok
}

// DirPath creates the path to the directory with slashes, up to but not including the baseFolder.
// The baseFolder is expected to be the repository's root folder, as defined by its spec. If this is used in other contexts, it should still function.
// An empty folder string means the root folder, and is special-cased to return no ID data.
// The returned Path field in the ID is relative to the base folder. If it is the base folder, an empty string is returned.
//
// If In(folder) or In(baseFolder) is false, this will return ok=false, because it would be undefined behaviour.
// If baseFolder is not a parent of folder, ok=false is returned.
func (t *folderTree) DirPath(folder, baseFolder string) (fid Folder, ok bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.dirPath(folder, baseFolder)
}

// dirPath is the internal implementation that assumes the mutex is already held
// Needed to avoid deadlock when called from other methods that hold locks like Walk()
func (t *folderTree) dirPath(folder, baseFolder string) (fid Folder, ok bool) {
	// Inline In() logic to avoid deadlock when called from other methods that hold locks
	folderInTree := t.in(folder)
	baseFolderInTree := t.in(baseFolder)

	if !folderInTree || !baseFolderInTree {
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
		// FIXME: missing slash here
		fid.Path = safepath.Join(t.folders[parent].Title, fid.Path)
		parent = t.tree[parent]
	}
	return fid, ok
}

// Add inserts or updates a folder entry and keeps the UID and path indexes in sync.
func (t *folderTree) Add(folder Folder, parent string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	_, exists := t.tree[folder.ID]
	// Remove the stale path key when an existing folder entry is updated in place.
	if existing, ok := t.folders[folder.ID]; ok && existing.Path != "" && existing.Path != folder.Path {
		delete(t.paths, safepath.EnsureTrailingSlash(existing.Path))
	}
	t.tree[folder.ID] = parent
	// Ensure the parent folder is set
	folder.ParentID = parent
	t.folders[folder.ID] = folder
	if folder.Path != "" {
		t.paths[safepath.EnsureTrailingSlash(folder.Path)] = folder.ID
	}
	if !exists {
		t.count++
	}
}

// Remove deletes folderID and all its descendants from the tree.
func (t *folderTree) Remove(folderID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if _, exists := t.tree[folderID]; !exists {
		return
	}

	// Collect the folder and all descendants.
	toDelete := []string{folderID}
	for i := 0; i < len(toDelete); i++ {
		current := toDelete[i]
		for id, parent := range t.tree {
			if parent == current {
				toDelete = append(toDelete, id)
			}
		}
	}

	// Delete collected nodes and adjust count.
	for _, id := range toDelete {
		if _, exists := t.tree[id]; exists {
			if folder, ok := t.folders[id]; ok && folder.Path != "" {
				delete(t.paths, safepath.EnsureTrailingSlash(folder.Path))
			}
			delete(t.tree, id)
			delete(t.folders, id)
			t.count--
		}
	}
}

// Count returns the number of folders currently stored in the tree.
func (t *folderTree) Count() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.count
}

type WalkFunc func(ctx context.Context, folder Folder, parent string) error

// Walk visits all folders in shallowest-first order and passes each folder's parent UID.
func (t *folderTree) Walk(ctx context.Context, fn WalkFunc) error {
	t.mu.RLock()
	defer t.mu.RUnlock()
	toWalk := make([]Folder, 0, len(t.folders))
	for _, folder := range t.folders {
		folder, _ := t.dirPath(folder.ID, "")
		toWalk = append(toWalk, folder)
	}

	// sort by depth (shallowest first)
	safepath.SortByDepth(toWalk, func(f Folder) string { return f.Path }, true)

	for _, folder := range toWalk {
		if err := fn(ctx, folder, t.tree[folder.ID]); err != nil {
			return err
		}
	}

	return nil
}

// NewEmptyFolderTree creates an empty folder tree with UID and source-path indexes.
func NewEmptyFolderTree() FolderTree {
	return &folderTree{
		tree:    make(map[string]string, 0),
		folders: make(map[string]Folder, 0),
		paths:   make(map[string]string, 0),
	}
}

// AddUnstructured adds a live folder object into the tree using its metadata annotations.
func (t *folderTree) AddUnstructured(item *unstructured.Unstructured) error {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return fmt.Errorf("extract meta accessor: %w", err)
	}

	folder := Folder{
		Title:    meta.FindTitle(item.GetName()),
		ID:       item.GetName(),
		ParentID: meta.GetFolder(),
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.tree[folder.ID] = meta.GetFolder()
	t.folders[folder.ID] = folder
	t.count++
	return nil
}

// CollectSubtreeIDs returns the set of folder UIDs reachable by walking down
// from any of the requested rootIDs in src (each root and all of its
// descendants). Roots that are not present in src are reported via the
// missing return value so the caller can record per-resource errors;
// overlapping roots are deduplicated.
func CollectSubtreeIDs(ctx context.Context, src FolderTree, rootIDs []string) (subtree map[string]struct{}, missing []string, err error) {
	parents := make(map[string]string, src.Count())
	if walkErr := src.Walk(ctx, func(_ context.Context, f Folder, parent string) error {
		parents[f.ID] = parent
		return nil
	}); walkErr != nil {
		return nil, nil, fmt.Errorf("walk source folder tree: %w", walkErr)
	}

	subtree = make(map[string]struct{}, len(rootIDs))
	queue := make([]string, 0, len(rootIDs))
	for _, id := range rootIDs {
		if _, ok := parents[id]; !ok {
			missing = append(missing, id)
			continue
		}
		if _, seen := subtree[id]; seen {
			continue
		}
		subtree[id] = struct{}{}
		queue = append(queue, id)
	}

	for i := 0; i < len(queue); i++ {
		current := queue[i]
		for child, parent := range parents {
			if parent != current {
				continue
			}
			if _, seen := subtree[child]; seen {
				continue
			}
			subtree[child] = struct{}{}
			queue = append(queue, child)
		}
	}
	return subtree, missing, nil
}

// NewFolderTreeFromResourceList seeds a tree from the current managed resource listing.
func NewFolderTreeFromResourceList(resources *provisioning.ResourceList) FolderTree {
	tree := make(map[string]string, len(resources.Items))
	folderIDs := make(map[string]Folder, len(resources.Items))
	paths := make(map[string]string, len(resources.Items))
	for _, rf := range resources.Items {
		if rf.Group != folders.GROUP {
			continue
		}

		tree[rf.Name] = rf.Folder
		folderIDs[rf.Name] = Folder{
			Title:        rf.Title,
			ID:           rf.Name,
			Path:         rf.Path,
			MetadataHash: rf.Hash,
			ParentID:     rf.Folder,
		}
		if rf.Path != "" {
			paths[safepath.EnsureTrailingSlash(rf.Path)] = rf.Name
		}
	}

	return &folderTree{
		tree:    tree,
		folders: folderIDs,
		paths:   paths,
		count:   len(resources.Items),
	}
}
