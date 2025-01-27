package rbac

import "github.com/grafana/grafana/pkg/services/authz/rbac/store"

func newFolderTree(folders []store.Folder) folderTree {
	t := folderTree{
		Index: make(map[string]int, len(folders)),
		Nodes: make([]folderNode, 0, len(folders)),
	}

	for _, f := range folders {
		t.insert(f.UID, f.ParentUID)
	}

	return t
}

type folderTree struct {
	Nodes []folderNode
	Index map[string]int
}

type folderNode struct {
	UID string
	// we store -1 for nodes that don't have Parent, otherwise this will be then index of then Parent node
	Parent int
	// indexes for all children of this node
	Children []int
}

func (t *folderTree) insert(uid string, parentUID *string) int {
	parent := -1
	if parentUID != nil {
		// find parent
		i, ok := t.Index[*parentUID]
		if !ok {
			// insert parent if it don't exists yet
			i = t.insert(*parentUID, nil)
		}
		parent = i
	}

	i, ok := t.Index[uid]
	if !ok {
		// this node does not exist yet so we add it to the index and append the new node
		i = len(t.Nodes)
		t.Index[uid] = i
		t.Nodes = append(t.Nodes, folderNode{
			UID:    uid,
			Parent: parent,
		})
	} else {
		// make sure properties are set correctly, this will "path" parent nodes that was added
		// if it did not exist when its child node was added.
		t.Nodes[i].UID = uid
		t.Nodes[i].Parent = parent
	}

	if parent != -1 {
		// update then parent no to include the index of new child node
		pi := parent
		t.Nodes[pi].Children = append(t.Nodes[pi].Children, i)
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
	start, ok := t.Index[uid]
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
	if !fn(t.Nodes[i]) {
		return
	}

	for _, ci := range t.Nodes[i].Children {
		t.walkDescendants(ci, fn)
	}
}

func (t *folderTree) walkAncestors(i int, fn func(n folderNode) bool) {
	if i == -1 || !fn(t.Nodes[i]) {
		return
	}

	t.walkAncestors(t.Nodes[i].Parent, fn)
}
