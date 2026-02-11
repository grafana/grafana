package folder

import (
	"iter"
)

// FolderTree represents a tree structure of folders for efficient ancestor/descendant traversal.
type FolderTree struct {
	// Nodes contains all folder nodes in the tree.
	Nodes []FolderNode
	// Index maps folder UID to its position in Nodes for O(1) lookup.
	Index map[string]int
	// IDIndex maps folder ID to its position in Nodes for O(1) lookup.
	IDIndex map[int64]int
}

// FolderNode represents a single folder in the tree.
type FolderNode struct {
	// Deprecated: use UID instead
	ID    int64
	UID   string
	Title string

	Parent     int
	Children   []int
	Accessible bool // Accessible is true if the node was returned by GetFolders
}

// NewFolderTree builds a folder tree from a list of folders.
// The General/Root folder is always inserted as the root node at index 0.
// Folders with no ParentUID become children of the General folder.
func NewFolderTree(folders []*Folder) *FolderTree {
	t := &FolderTree{
		Index:   make(map[string]int, len(folders)+1),
		IDIndex: make(map[int64]int, len(folders)+1),
		Nodes:   make([]FolderNode, 0, len(folders)+1),
	}

	// Insert the General folder as the root (always at index 0).
	// This is the only node with Parent = -1.
	t.Nodes = append(t.Nodes, FolderNode{
		UID:        GeneralFolderUID,
		Title:      "General",
		Parent:     -1,
		Accessible: true,
	})
	t.Index[GeneralFolderUID] = 0
	t.Index[RootFolderUID] = 0 // Point RootFolderUID to root node
	t.IDIndex[0] = 0           // ID 0 for General folder

	for _, f := range folders {
		var parentUID *string
		if f.ParentUID != "" {
			parentUID = &f.ParentUID
		}
		// Folders from GetFolders are accessible (not placeholders)
		t.insert(f.ID, f.UID, f.Title, parentUID, true)
	}

	// Build Children relationships from Parent fields
	for i := 1; i < len(t.Nodes); i++ { // Skip General folder (index 0)
		parent := t.Nodes[i].Parent
		if parent != -1 {
			t.Nodes[parent].Children = append(t.Nodes[parent].Children, i)
		}
	}

	return t
}

// insert adds a folder to the tree.
// Folders with no parent become children of the General folder (index 0).
func (t *FolderTree) insert(id int64, uid string, title string, parentUID *string, accessible bool) int {
	// Default parent is the General folder (index 0).
	// Only the General folder itself has Parent = -1.
	parent := 0
	if parentUID != nil {
		// Find or create parent
		i, ok := t.Index[*parentUID]
		if !ok {
			// Insert parent as placeholder if it doesn't exist yet (ID=0 for placeholder, accessible=false)
			i = t.insert(0, *parentUID, "", nil, false)
		}
		parent = i
	}

	i, ok := t.Index[uid]
	if !ok {
		// This node doesn't exist yet, add it to the index and append the new node
		i = len(t.Nodes)
		t.Index[uid] = i
		if id != 0 {
			t.IDIndex[id] = i
		}
		t.Nodes = append(t.Nodes, FolderNode{
			ID:         id,
			UID:        uid,
			Title:      title,
			Parent:     parent,
			Accessible: accessible,
		})
	} else {
		// Node exists (was a placeholder). Update with actual folder data.
		t.Nodes[i].Parent = parent
		if title != "" {
			t.Nodes[i].Title = title
		}
		if id != 0 && t.Nodes[i].ID == 0 {
			t.Nodes[i].ID = id
			t.IDIndex[id] = i
		}
		t.Nodes[i].Accessible = accessible
	}

	return i
}

// Ancestors returns an iterator that yields all accessible ancestor folders of the given UID,
// starting from the immediate parent and going up to the root.
func (t *FolderTree) Ancestors(uid string) iter.Seq[FolderNode] {
	current, ok := t.Index[uid]
	if !ok {
		return func(yield func(FolderNode) bool) {}
	}

	current = t.Nodes[current].Parent
	return func(yield func(FolderNode) bool) {
		for {
			if current == -1 || !t.Nodes[current].Accessible || !yield(t.Nodes[current]) {
				return
			}
			current = t.Nodes[current].Parent
		}
	}
}

// Children returns an iterator that yields all descendant folders of the given UID
// using breadth-first traversal.
func (t *FolderTree) Children(uid string) iter.Seq[FolderNode] {
	current, ok := t.Index[uid]
	if !ok {
		return func(yield func(FolderNode) bool) {}
	}

	queue := t.Nodes[current].Children
	return func(yield func(FolderNode) bool) {
		for len(queue) > 0 {
			current, queue = queue[0], queue[1:]
			if !yield(t.Nodes[current]) {
				return
			}
			queue = append(queue, t.Nodes[current].Children...)
		}
	}
}

// Contains returns true if the folder with the given UID exists in the tree.
func (t *FolderTree) Contains(uid string) bool {
	if i, ok := t.Index[uid]; ok {
		return t.Nodes[i].Accessible
	}
	return false
}

// GetTitle returns the title of the folder with the given UID.
// Returns empty string if the folder is not found.
func (t *FolderTree) GetTitle(uid string) string {
	if i, ok := t.Index[uid]; ok {
		node := t.Nodes[i]
		if node.Accessible {
			return node.Title
		}
	}
	return ""
}

// GetByID returns the folder node with the given ID.
func (t *FolderTree) GetByID(id int64) (FolderNode, bool) {
	if i, ok := t.IDIndex[id]; ok {
		return t.Nodes[i], true
	}
	return FolderNode{}, false
}
