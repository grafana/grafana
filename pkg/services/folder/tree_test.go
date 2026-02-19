package folder

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewFolderTree(t *testing.T) {
	t.Run("empty folder list still has general folder", func(t *testing.T) {
		tree := NewFolderTree([]*Folder{})
		require.NotNil(t, tree)
		// General folder is always present at index 0
		assert.Len(t, tree.Nodes, 1)
		assert.Equal(t, GeneralFolderUID, tree.Nodes[0].UID)
		assert.Equal(t, -1, tree.Nodes[0].Parent) // General folder has no parent
		// Both "" and "general" map to index 0
		assert.True(t, tree.Contains(""))
		assert.True(t, tree.Contains(GeneralFolderUID))
	})

	t.Run("single folder becomes child of general", func(t *testing.T) {
		folders := []*Folder{
			{UID: "a", Title: "Folder A"},
		}
		tree := NewFolderTree(folders)

		require.NotNil(t, tree)
		// General folder + 1 user folder
		assert.Len(t, tree.Nodes, 2)
		assert.Contains(t, tree.Index, "a")
		assert.Equal(t, "Folder A", tree.GetTitle("a"))
		// "a" should be a child of the general folder
		assert.Equal(t, 0, tree.Nodes[tree.Index["a"]].Parent)
	})

	t.Run("parent-child relationship", func(t *testing.T) {
		folders := []*Folder{
			{UID: "parent", Title: "Parent"},
			{UID: "child", Title: "Child", ParentUID: "parent"},
		}
		tree := NewFolderTree(folders)

		// General folder + 2 user folders
		require.Len(t, tree.Nodes, 3)

		parentIdx := tree.Index["parent"]
		childIdx := tree.Index["child"]

		// Parent should have child in its children
		assert.Contains(t, tree.Nodes[parentIdx].Children, childIdx)

		// Child should have parent as its parent
		assert.Equal(t, parentIdx, tree.Nodes[childIdx].Parent)

		// Parent should be a child of general folder
		assert.Equal(t, 0, tree.Nodes[parentIdx].Parent)
	})

	t.Run("deep hierarchy", func(t *testing.T) {
		folders := []*Folder{
			{UID: "root", Title: "Root"},
			{UID: "level1", Title: "Level 1", ParentUID: "root"},
			{UID: "level2", Title: "Level 2", ParentUID: "level1"},
			{UID: "level3", Title: "Level 3", ParentUID: "level2"},
		}
		tree := NewFolderTree(folders)

		// General folder + 4 user folders
		require.Len(t, tree.Nodes, 5)

		// Verify the hierarchy - "root" is now a child of general folder
		assert.Equal(t, 0, tree.Nodes[tree.Index["root"]].Parent) // root's parent is general
		assert.Equal(t, tree.Index["root"], tree.Nodes[tree.Index["level1"]].Parent)
		assert.Equal(t, tree.Index["level1"], tree.Nodes[tree.Index["level2"]].Parent)
		assert.Equal(t, tree.Index["level2"], tree.Nodes[tree.Index["level3"]].Parent)
	})
}

func TestFolderTree_Ancestors(t *testing.T) {
	folders := []*Folder{
		{UID: "root", Title: "Root"},
		{UID: "level1", Title: "Level 1", ParentUID: "root"},
		{UID: "level2", Title: "Level 2", ParentUID: "level1"},
		{UID: "level3", Title: "Level 3", ParentUID: "level2"},
	}
	tree := NewFolderTree(folders)

	t.Run("general folder has no ancestors", func(t *testing.T) {
		var ancestors []string //nolint:prealloc
		for node := range tree.Ancestors(GeneralFolderUID) {
			ancestors = append(ancestors, node.UID)
		}
		assert.Len(t, ancestors, 0)
	})

	t.Run("top-level folder has general as ancestor", func(t *testing.T) {
		var ancestors []string //nolint:prealloc
		for node := range tree.Ancestors("root") {
			ancestors = append(ancestors, node.UID)
		}
		assert.Equal(t, []string{GeneralFolderUID}, ancestors)
	})

	t.Run("leaf folder has all ancestors including general", func(t *testing.T) {
		var ancestors []string //nolint:prealloc
		for node := range tree.Ancestors("level3") {
			ancestors = append(ancestors, node.UID)
		}
		assert.Equal(t, []string{"level2", "level1", "root", GeneralFolderUID}, ancestors)
	})

	t.Run("middle folder has partial ancestors including general", func(t *testing.T) {
		var ancestors []string //nolint:prealloc
		for node := range tree.Ancestors("level2") {
			ancestors = append(ancestors, node.UID)
		}
		assert.Equal(t, []string{"level1", "root", GeneralFolderUID}, ancestors)
	})

	t.Run("non-existent folder returns empty iterator", func(t *testing.T) {
		var ancestors []string //nolint:prealloc
		for node := range tree.Ancestors("nonexistent") {
			ancestors = append(ancestors, node.UID)
		}
		assert.Len(t, ancestors, 0)
	})

	t.Run("stops at first inaccessible ancestor in chain", func(t *testing.T) {
		// Create: child -> accessible-parent -> placeholder-grandparent
		foldersPartial := []*Folder{
			{UID: "accessible-parent", Title: "Accessible Parent", ParentUID: "placeholder-grandparent"},
			{UID: "child", Title: "Child", ParentUID: "accessible-parent"},
		}
		treePartial := NewFolderTree(foldersPartial)

		var ancestors []string //nolint:prealloc
		for node := range treePartial.Ancestors("child") {
			ancestors = append(ancestors, node.UID)
		}
		// Should only have accessible-parent, stops at placeholder-grandparent
		assert.Equal(t, []string{"accessible-parent"}, ancestors)
	})
}

func TestFolderTree_Children(t *testing.T) {
	folders := []*Folder{
		{UID: "root", Title: "Root"},
		{UID: "child1", Title: "Child 1", ParentUID: "root"},
		{UID: "child2", Title: "Child 2", ParentUID: "root"},
		{UID: "grandchild1", Title: "Grandchild 1", ParentUID: "child1"},
		{UID: "grandchild2", Title: "Grandchild 2", ParentUID: "child1"},
	}
	tree := NewFolderTree(folders)

	t.Run("general folder has all folders as descendants", func(t *testing.T) {
		childUIDs := make(map[string]bool)
		for node := range tree.Children(GeneralFolderUID) {
			childUIDs[node.UID] = true
		}
		assert.Len(t, childUIDs, 5)
		assert.True(t, childUIDs["root"])
		assert.True(t, childUIDs["child1"])
		assert.True(t, childUIDs["child2"])
		assert.True(t, childUIDs["grandchild1"])
		assert.True(t, childUIDs["grandchild2"])
	})

	t.Run("top-level folder has all its descendants", func(t *testing.T) {
		childUIDs := make(map[string]bool)
		for node := range tree.Children("root") {
			childUIDs[node.UID] = true
		}
		assert.Len(t, childUIDs, 4)
		assert.True(t, childUIDs["child1"])
		assert.True(t, childUIDs["child2"])
		assert.True(t, childUIDs["grandchild1"])
		assert.True(t, childUIDs["grandchild2"])
	})

	t.Run("leaf folder has no children", func(t *testing.T) {
		var children []string //nolint:prealloc
		for node := range tree.Children("grandchild1") {
			children = append(children, node.UID)
		}
		assert.Len(t, children, 0)
	})

	t.Run("middle folder has subtree children", func(t *testing.T) {
		childUIDs := make(map[string]bool)
		for node := range tree.Children("child1") {
			childUIDs[node.UID] = true
		}
		assert.Len(t, childUIDs, 2)
		assert.True(t, childUIDs["grandchild1"])
		assert.True(t, childUIDs["grandchild2"])
	})

	t.Run("non-existent folder returns empty iterator", func(t *testing.T) {
		var children []string //nolint:prealloc
		for node := range tree.Children("nonexistent") {
			children = append(children, node.UID)
		}
		assert.Len(t, children, 0)
	})

	t.Run("children iterator should not yield duplicates", func(t *testing.T) {
		folders := []*Folder{
			{UID: "child", Title: "Child", ParentUID: "parent"},
			{UID: "parent", Title: "Parent"},
		}
		tree := NewFolderTree(folders)

		// Iterate children of General folder
		var children []string //nolint:prealloc
		for node := range tree.Children(GeneralFolderUID) {
			children = append(children, node.UID)
		}

		// Should see parent and child exactly once each
		assert.Len(t, children, 2, "Should have exactly 2 descendants (parent and child)")
	})
}

func TestFolderTree_Contains(t *testing.T) {
	t.Run("general folder is always accessible", func(t *testing.T) {
		tree := NewFolderTree([]*Folder{})
		assert.True(t, tree.Contains(GeneralFolderUID))
		assert.True(t, tree.Contains("")) // RootFolderUID
	})

	t.Run("folders from GetFolders are accessible", func(t *testing.T) {
		folders := []*Folder{
			{UID: "folder-a", Title: "Folder A"},
			{UID: "folder-b", Title: "Folder B"},
		}
		tree := NewFolderTree(folders)

		assert.True(t, tree.Contains("folder-a"))
		assert.True(t, tree.Contains("folder-b"))
	})

	t.Run("placeholder ancestors are NOT accessible", func(t *testing.T) {
		// Simulate GetFolders returning only child but not parent
		// User has access to "child" but NOT "parent"
		folders := []*Folder{
			{UID: "child", Title: "Child Folder", ParentUID: "parent"},
		}
		tree := NewFolderTree(folders)

		// Child is accessible (came from GetFolders)
		assert.True(t, tree.Contains("child"))

		// But parent is NOT accessible (placeholder)
		assert.False(t, tree.Contains("parent"))
	})

	t.Run("deeply nested placeholder ancestors are NOT accessible", func(t *testing.T) {
		// User only has access to the deepest folder
		folders := []*Folder{
			{UID: "level3", Title: "Level 3", ParentUID: "level2"},
		}
		tree := NewFolderTree(folders)

		// level3 is accessible
		assert.True(t, tree.Contains("level3"))

		// level2 exists (placeholder) but not accessible
		assert.False(t, tree.Contains("level2"))
	})

	t.Run("non-existent folder is not accessible", func(t *testing.T) {
		tree := NewFolderTree([]*Folder{})
		assert.False(t, tree.Contains("non-existent"))
	})

	t.Run("mixed accessible and placeholder folders", func(t *testing.T) {
		// User has access to "parent" and "grandchild" but NOT "child"
		// This is an edge case but let's verify the behavior
		folders := []*Folder{
			{UID: "parent", Title: "Parent"},
			{UID: "grandchild", Title: "Grandchild", ParentUID: "child"},
		}
		tree := NewFolderTree(folders)

		// parent is accessible (from GetFolders)
		assert.True(t, tree.Contains("parent"))

		// grandchild is accessible (from GetFolders)
		assert.True(t, tree.Contains("grandchild"))

		// child is a placeholder (grandchild's parent), NOT accessible
		assert.False(t, tree.Contains("child"))
	})

	t.Run("accessible field is set correctly on nodes", func(t *testing.T) {
		folders := []*Folder{
			{UID: "accessible", Title: "Accessible", ParentUID: "placeholder"},
		}
		tree := NewFolderTree(folders)

		// Verify Accessible field directly
		accessibleIdx := tree.Index["accessible"]
		placeholderIdx := tree.Index["placeholder"]

		assert.True(t, tree.Nodes[accessibleIdx].Accessible)
		assert.False(t, tree.Nodes[placeholderIdx].Accessible)
		assert.True(t, tree.Nodes[0].Accessible) // General folder
	})
}

func TestFolderTree_GetTitle(t *testing.T) {
	folders := []*Folder{
		{UID: "a", Title: "Folder A"},
		{UID: "b", Title: "Folder B"},
	}
	tree := NewFolderTree(folders)

	assert.Equal(t, "Folder A", tree.GetTitle("a"))
	assert.Equal(t, "Folder B", tree.GetTitle("b"))
	assert.Equal(t, "", tree.GetTitle("nonexistent"))
}

func TestFolderTree_OutOfOrderInsertion(t *testing.T) {
	// Test that folders inserted out of order (child before parent) still work correctly
	folders := []*Folder{
		{UID: "child", Title: "Child", ParentUID: "parent"},
		{UID: "parent", Title: "Parent"},
	}
	tree := NewFolderTree(folders)

	// General folder + 2 user folders
	require.Len(t, tree.Nodes, 3)

	// Verify parent-child relationship is correct
	parentIdx := tree.Index["parent"]
	childIdx := tree.Index["child"]

	assert.Contains(t, tree.Nodes[parentIdx].Children, childIdx)
	assert.Equal(t, parentIdx, tree.Nodes[childIdx].Parent)

	// Parent should be a child of general folder
	assert.Equal(t, 0, tree.Nodes[parentIdx].Parent)

	// Verify no duplicate children entries
	assert.Len(t, tree.Nodes[parentIdx].Children, 1)
	assert.Len(t, tree.Nodes[0].Children, 1)

	// Verify titles are correct
	assert.Equal(t, "Parent", tree.GetTitle("parent"))
	assert.Equal(t, "Child", tree.GetTitle("child"))
}

func TestFolderTree_GetByID(t *testing.T) {
	folders := []*Folder{
		{ID: 1, UID: "a", Title: "Folder A"},
		{ID: 2, UID: "b", Title: "Folder B"},
		{ID: 3, UID: "c", Title: "Folder C", ParentUID: "a"},
	}
	tree := NewFolderTree(folders)

	t.Run("get existing folder by ID", func(t *testing.T) {
		node, ok := tree.GetByID(1)
		require.True(t, ok)
		assert.Equal(t, "a", node.UID)
		assert.Equal(t, "Folder A", node.Title)
		assert.Equal(t, int64(1), node.ID)

		root, ok := tree.GetByID(0)
		require.True(t, ok)
		assert.Equal(t, GeneralFolderUID, root.UID)
	})

	t.Run("get non-existent folder by ID returns false", func(t *testing.T) {
		_, ok := tree.GetByID(999)
		assert.False(t, ok)
	})

	t.Run("IDIndex contains all folders with IDs and general folder", func(t *testing.T) {
		// General folder has ID=0 which is not indexed
		assert.Len(t, tree.IDIndex, 4)
		assert.Contains(t, tree.IDIndex, int64(0))
		assert.Contains(t, tree.IDIndex, int64(1))
		assert.Contains(t, tree.IDIndex, int64(2))
		assert.Contains(t, tree.IDIndex, int64(3))
	})
}
