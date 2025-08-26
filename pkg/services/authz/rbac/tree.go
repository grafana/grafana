package rbac

import (
	"iter"

	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func newFolderTree(folders []store.Folder) folderTree {
	t := folderTree{
		Index: make(map[string]int, len(folders)),
		Nodes: make([]folderNode, 0, len(folders)),
	}

	for _, f := range folders {
		t.Insert(f.UID, f.ParentUID)
	}

	return t
}

type folderTree struct {
	// All nodes for the folderTree.
	Nodes []folderNode
	// Index is a map of folderNode UID to its positons in Nodes.
	Index map[string]int
}

type folderNode struct {
	// UID is the uniqiue identifier for folderNode
	UID string
	// Parent is the position into folderTree nodes for parent, we store -1 for nodes that don't have a parent.
	Parent int
	// Children is positons into folderTree nodes for all children.
	Children []int
}

func (t *folderTree) Insert(uid string, parentUID *string) int {
	parent := -1
	if parentUID != nil {
		// find parent
		i, ok := t.Index[*parentUID]
		if !ok {
			// insert parent if it don't exists yet
			i = t.Insert(*parentUID, nil)
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
		// if a node is added as a parent node first, its parent will not be set, so we make sure to do it now
		t.Nodes[i].Parent = parent
	}

	if parent != -1 {
		// update parent to include the index of new child node
		t.Nodes[parent].Children = append(t.Nodes[parent].Children, i)
	}

	return i
}

// Ancestors returns an iterator that yields ancestors for uid
func (t *folderTree) Ancestors(uid string) iter.Seq[folderNode] {
	current, ok := t.Index[uid]
	if !ok {
		return func(yield func(folderNode) bool) {}
	}

	current = t.Nodes[current].Parent
	return func(yield func(folderNode) bool) {
		for {
			if current == -1 || !yield(t.Nodes[current]) {
				return
			}

			current = t.Nodes[current].Parent
		}
	}
}

// Children returns an iterator that yields all children for uid
func (t *folderTree) Children(uid string) iter.Seq[folderNode] {
	current, ok := t.Index[uid]
	if !ok {
		return func(yield func(folderNode) bool) {}
	}

	queue := t.Nodes[current].Children
	return func(yield func(folderNode) bool) {
		for len(queue) > 0 {
			current, queue = queue[0], queue[1:]
			if !yield(t.Nodes[current]) {
				return
			}
			queue = append(queue, t.Nodes[current].Children...)
		}
	}
}
