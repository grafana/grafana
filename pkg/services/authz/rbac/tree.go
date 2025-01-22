package rbac

import "github.com/grafana/grafana/pkg/services/authz/rbac/store"

func newFolderTree(folders []store.Folder) folderTree {
	t := folderTree{
		index: make(map[string]int, len(folders)),
		nodes: make([]folderNode, 0, len(folders)),
	}

	for _, f := range folders {
		t.insert(f.UID, f.ParentUID)
	}

	return t
}

type folderTree struct {
	nodes []folderNode
	index map[string]int
}

type folderNode struct {
	uid string
	// we store -1 for nodes that don't have parent, otherwise this will be then index of then parent node
	parent int
	// indexes for all children of this node
	children []int
}

func (t *folderTree) insert(uid string, parentUID *string) int {
	parent := -1
	if parentUID != nil {
		// find parent
		i, ok := t.index[*parentUID]
		if !ok {
			// insert parent if it don't exists yet
			i = t.insert(*parentUID, nil)
		}
		parent = i
	}

	i, ok := t.index[uid]
	if !ok {
		// this node does not exist yet so we add it to the index and append the new node
		i = len(t.nodes)
		t.index[uid] = i
		t.nodes = append(t.nodes, folderNode{
			uid:    uid,
			parent: parent,
		})
	} else {
		// make sure properties are set correctly, this will "path" parent nodes that was added
		// if it did not exist when its child node was added.
		t.nodes[i].uid = uid
		t.nodes[i].parent = parent
	}

	if parent != -1 {
		// update then parent no to include the index of new child node
		pi := parent
		t.nodes[pi].children = append(t.nodes[pi].children, i)
	}

	return i
}

type direction int8

const (
	directionDescendants = iota
	directionAncestors   = iota
)

// Walk calls fn for every node for choosen direction.
// It will stop travesal of sub-tree if false is returned from fn.
func (t *folderTree) Walk(uid string, direction direction, fn func(n folderNode) bool) {
	start, ok := t.index[uid]
	if !ok {
		return
	}

	if direction == directionDescendants {
		t.walkDescendants(start, fn)
	} else {
		t.walkAncestors(start, fn)
	}
	return
}

func (t *folderTree) walkDescendants(i int, fn func(n folderNode) bool) {
	if !fn(t.nodes[i]) {
		return
	}

	for _, ci := range t.nodes[i].children {
		t.walkDescendants(ci, fn)
	}
}

func (t *folderTree) walkAncestors(i int, fn func(n folderNode) bool) {
	if i == -1 || !fn(t.nodes[i]) {
		return
	}

	t.walkAncestors(t.nodes[i].parent, fn)
}
