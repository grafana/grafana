package resources

import (
	"context"
	"testing"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFolderTree(t *testing.T) {
	newFid := func(kube, title string) Folder {
		return Folder{ID: kube, Title: title}
	}

	t.Run("empty tree", func(t *testing.T) {
		tree := &folderTree{
			tree:    make(map[string]string),
			folders: make(map[string]Folder),
		}

		assert.False(t, tree.In("x"), "x should not be in tree")
		assert.False(t, tree.In("z"), "z should not be in tree")
		_, ok := tree.DirPath("x", "")
		assert.False(t, ok, "x should not have a DirPath")
	})

	t.Run("single directory in tree", func(t *testing.T) {
		tree := &folderTree{
			tree:    map[string]string{"x": ""},
			folders: map[string]Folder{"x": newFid("x", "X!")},
		}

		assert.True(t, tree.In("x"), "x should be in tree")
		id, ok := tree.DirPath("x", "x")
		if assert.True(t, ok, "x should have DirPath with itself as base") {
			assert.Equal(t, "x", id.ID, "KubernetesName")
			assert.Equal(t, "X!", id.Title, "Title")
			assert.Equal(t, "", id.Path, "Path")
		}
		id, ok = tree.DirPath("x", "")
		if assert.True(t, ok, "x should have DirPath with empty base") {
			assert.Equal(t, "x", id.ID, "KubernetesName")
			assert.Equal(t, "X!", id.Title, "Title")
			assert.Equal(t, "X!", id.Path, "Path")
		}
	})

	t.Run("simple nesting tree", func(t *testing.T) {
		tree := &folderTree{
			tree: map[string]string{"a": "b", "b": "c", "c": "x", "x": ""},
			folders: map[string]Folder{
				"x": newFid("x", "X!"),
				"c": newFid("c", "C :)"),
				"b": newFid("b", "!!B#!"),
				"a": newFid("a", "[€]@£a"),
			},
		}

		assert.True(t, tree.In("x"), "x should be in tree")
		assert.True(t, tree.In("a"), "a should be in tree")
		assert.False(t, tree.In("z"), "z should not be in tree, for it is undeclared")

		id, ok := tree.DirPath("x", "")
		if assert.True(t, ok, "x should have DirPath with empty base") {
			assert.Equal(t, "x", id.ID, "KubernetesName")
			assert.Equal(t, "X!", id.Title, "Title")
			assert.Equal(t, "X!", id.Path, "Path")
		}

		id, ok = tree.DirPath("c", "c")
		if assert.True(t, ok, "c should have DirPath with itself as base") {
			assert.Equal(t, "c", id.ID, "KubernetesName")
			assert.Equal(t, "C :)", id.Title, "Title")
			assert.Equal(t, "", id.Path, "Path")
		}

		id, ok = tree.DirPath("a", "x")
		if assert.True(t, ok, "a should have DirPath with x as base") {
			assert.Equal(t, "a", id.ID, "KubernetesName")
			assert.Equal(t, "[€]@£a", id.Title, "Title")
			assert.Equal(t, "C :)/!!B#!/[€]@£a", id.Path, "Path")
		}
		_, ok = tree.DirPath("x", "a")
		assert.False(t, ok, "x should not have DirPath with a as base, because a is a subfolder of x")

		id, ok = tree.DirPath("", "")
		if assert.True(t, ok, "the root folder should have a path to itself") {
			assert.Empty(t, id.ID)
			assert.Empty(t, id.Path)
			assert.Empty(t, id.Title)
		}
	})

	t.Run("add new folder increments count", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		assert.Equal(t, 0, tree.Count())

		tree.Add(Folder{ID: "a", Title: "A", Path: "a/"}, "")
		assert.Equal(t, 1, tree.Count())
		assert.True(t, tree.In("a"))

		tree.Add(Folder{ID: "b", Title: "B", Path: "b/"}, "a")
		assert.Equal(t, 2, tree.Count())
		assert.True(t, tree.In("b"))
	})

	t.Run("add existing folder updates parent and metadata without incrementing count", func(t *testing.T) {
		tree := NewEmptyFolderTree()

		tree.Add(Folder{ID: "x", Title: "Old Title", Path: "old-path/"}, "old-parent")
		assert.Equal(t, 1, tree.Count())

		// Re-add with new parent, title, and path
		tree.Add(Folder{ID: "x", Title: "New Title", Path: "new-path/"}, "new-parent")
		assert.Equal(t, 1, tree.Count(), "count should not increment for existing folder ID")
		assert.True(t, tree.In("x"))

		// Verify the metadata was updated
		id, ok := tree.DirPath("x", "")
		assert.True(t, ok)
		assert.Equal(t, "New Title", id.Title)
	})

	t.Run("get by path returns folder with normalized path", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "a", Title: "A", Path: "a/"}, "")

		ft := tree.(*folderTree)
		byPath, ok := ft.GetByPath("a")
		require.True(t, ok)
		assert.Equal(t, "a", byPath.ID)

		byPath, ok = ft.GetByPath("a/")
		require.True(t, ok)
		assert.Equal(t, "a", byPath.ID)
	})

	t.Run("updating folder path removes the previous path lookup", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "a", Title: "A", Path: "old/"}, "")
		tree.Add(Folder{ID: "a", Title: "A", Path: "new/"}, "")

		ft := tree.(*folderTree)
		_, ok := ft.GetByPath("old")
		require.False(t, ok)

		byPath, ok := ft.GetByPath("new")
		require.True(t, ok)
		assert.Equal(t, "a", byPath.ID)
	})

	t.Run("remove existing folder decrements count and removes from tree", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "a", Title: "A", Path: "a/"}, "")
		tree.Add(Folder{ID: "b", Title: "B", Path: "b/"}, "a")
		assert.Equal(t, 2, tree.Count())
		assert.True(t, tree.In("b"))

		tree.Remove("b")
		assert.Equal(t, 1, tree.Count())
		assert.False(t, tree.In("b"))
		assert.True(t, tree.In("a"))
	})

	t.Run("remove non-existent folder is a no-op", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "a", Title: "A", Path: "a/"}, "")
		assert.Equal(t, 1, tree.Count())

		tree.Remove("non-existent")
		assert.Equal(t, 1, tree.Count())
		assert.True(t, tree.In("a"))
	})

	t.Run("remove cascades to children", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "a", Title: "A", Path: "a/"}, "")
		tree.Add(Folder{ID: "b", Title: "B", Path: "a/b/"}, "a")
		tree.Add(Folder{ID: "c", Title: "C", Path: "a/b/c/"}, "b")
		tree.Add(Folder{ID: "d", Title: "D", Path: "d/"}, "")

		assert.Equal(t, 4, tree.Count())
		assert.True(t, tree.In("a"))
		assert.True(t, tree.In("b"))
		assert.True(t, tree.In("c"))
		assert.True(t, tree.In("d"))

		tree.Remove("b")

		assert.Equal(t, 2, tree.Count())
		assert.False(t, tree.In("b"))
		assert.False(t, tree.In("c"))
		assert.True(t, tree.In("a"))
		assert.True(t, tree.In("d"))
	})

	t.Run("remove cascades deep and across branches", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "root", Title: "Root", Path: "root/"}, "")
		tree.Add(Folder{ID: "b", Title: "B", Path: "root/b/"}, "root")
		tree.Add(Folder{ID: "c", Title: "C", Path: "root/b/c/"}, "b")
		tree.Add(Folder{ID: "d", Title: "D", Path: "root/b/d/"}, "b")
		tree.Add(Folder{ID: "e", Title: "E", Path: "root/e/"}, "root")
		tree.Add(Folder{ID: "f", Title: "F", Path: "root/e/f/"}, "e")
		tree.Add(Folder{ID: "g", Title: "G", Path: "root/e/g/"}, "e")
		tree.Add(Folder{ID: "x", Title: "X", Path: "x/"}, "")

		// Verify all folders are in the tree.
		assert.Equal(t, 8, tree.Count())
		assert.True(t, tree.In("root"))
		assert.True(t, tree.In("b"))
		assert.True(t, tree.In("c"))
		assert.True(t, tree.In("d"))
		assert.True(t, tree.In("e"))
		assert.True(t, tree.In("f"))
		assert.True(t, tree.In("g"))
		assert.True(t, tree.In("x"))

		// Only x should remain in the tree.
		tree.Remove("root")
		assert.Equal(t, 1, tree.Count())
		assert.False(t, tree.In("root"))
		assert.False(t, tree.In("b"))
		assert.False(t, tree.In("c"))
		assert.False(t, tree.In("d"))
		assert.False(t, tree.In("e"))
		assert.False(t, tree.In("f"))
		assert.False(t, tree.In("g"))
		assert.True(t, tree.In("x"))
	})

	t.Run("walk tree", func(t *testing.T) {
		tree := &folderTree{
			tree: map[string]string{"a": "b", "b": "c", "c": "x", "x": ""},
			folders: map[string]Folder{
				"x": newFid("x", "X!"),
				"c": newFid("c", "C :)"),
				"b": newFid("b", "!!B#!"),
				"a": newFid("a", "[€]@£a"),
			},
		}

		visited := make(map[string]string)
		err := tree.Walk(context.Background(), func(ctx context.Context, folder Folder, parent string) error {
			visited[folder.ID] = parent
			return nil
		})

		assert.NoError(t, err)
		assert.Equal(t, map[string]string{
			"x": "",
			"c": "x",
			"b": "c",
			"a": "b",
		}, visited)
	})
}

func TestFolderTree_Get(t *testing.T) {
	t.Run("returns folder entry with MetadataHash", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		f := Folder{ID: "uid-1", Title: "My Folder", Path: "my-folder", MetadataHash: "abc123"}
		tree.Add(f, "")

		got, ok := tree.Get("uid-1")
		require.True(t, ok)
		assert.Equal(t, "uid-1", got.ID)
		assert.Equal(t, "My Folder", got.Title)
		assert.Equal(t, "abc123", got.MetadataHash)
	})

	t.Run("returns false for missing folder", func(t *testing.T) {
		tree := NewEmptyFolderTree()

		_, ok := tree.Get("nonexistent")
		assert.False(t, ok)
	})
}

func TestNewFolderTreeFromResourceList_MetadataHash(t *testing.T) {
	t.Run("populates MetadataHash from ResourceListItem.Hash", func(t *testing.T) {
		rl := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:   "folder-uid",
					Title:  "My Folder",
					Path:   "my-folder",
					Hash:   "stored-checksum",
					Group:  folders.GROUP,
					Folder: "",
				},
			},
		}

		tree := NewFolderTreeFromResourceList(rl)
		got, ok := tree.Get("folder-uid")
		require.True(t, ok)
		assert.Equal(t, "stored-checksum", got.MetadataHash)
	})

	t.Run("empty hash when no sourceChecksum stored", func(t *testing.T) {
		rl := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:  "folder-uid",
					Title: "My Folder",
					Path:  "my-folder",
					Hash:  "",
					Group: folders.GROUP,
				},
			},
		}

		tree := NewFolderTreeFromResourceList(rl)
		got, ok := tree.Get("folder-uid")
		require.True(t, ok)
		assert.Empty(t, got.MetadataHash)
	})

	t.Run("populates ParentID from ResourceListItem.Folder", func(t *testing.T) {
		rl := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:   "parent-uid",
					Title:  "Parent",
					Path:   "parent",
					Group:  folders.GROUP,
					Folder: "",
				},
				{
					Name:   "child-uid",
					Title:  "Child",
					Path:   "parent/child",
					Group:  folders.GROUP,
					Folder: "parent-uid",
				},
			},
		}

		tree := NewFolderTreeFromResourceList(rl)

		parent, ok := tree.Get("parent-uid")
		require.True(t, ok)
		assert.Empty(t, parent.ParentID, "root folder should have empty ParentID")

		child, ok := tree.Get("child-uid")
		require.True(t, ok)
		assert.Equal(t, "parent-uid", child.ParentID)
	})
}

func TestCollectSubtreeIDs(t *testing.T) {
	// Build:  a → b → c
	//         a → d
	//         e (sibling root)
	build := func() FolderTree {
		tree := NewEmptyFolderTree()
		tree.Add(Folder{ID: "a", Title: "A"}, "")
		tree.Add(Folder{ID: "b", Title: "B"}, "a")
		tree.Add(Folder{ID: "c", Title: "C"}, "b")
		tree.Add(Folder{ID: "d", Title: "D"}, "a")
		tree.Add(Folder{ID: "e", Title: "E"}, "")
		return tree
	}

	t.Run("subtree from intermediate node includes only descendants", func(t *testing.T) {
		set, missing, err := CollectSubtreeIDs(context.Background(), build(), []string{"b"})
		require.NoError(t, err)
		assert.Empty(t, missing)
		assert.ElementsMatch(t, []string{"b", "c"}, keysOf(set))
	})

	t.Run("subtree from root includes whole tree branch", func(t *testing.T) {
		set, missing, err := CollectSubtreeIDs(context.Background(), build(), []string{"a"})
		require.NoError(t, err)
		assert.Empty(t, missing)
		assert.ElementsMatch(t, []string{"a", "b", "c", "d"}, keysOf(set))
	})

	t.Run("multiple roots are merged and deduplicated", func(t *testing.T) {
		// a is the parent of b: requesting both should not double-count
		set, missing, err := CollectSubtreeIDs(context.Background(), build(), []string{"a", "b", "e"})
		require.NoError(t, err)
		assert.Empty(t, missing)
		assert.ElementsMatch(t, []string{"a", "b", "c", "d", "e"}, keysOf(set))
	})

	t.Run("missing roots reported, present roots still expanded", func(t *testing.T) {
		set, missing, err := CollectSubtreeIDs(context.Background(), build(), []string{"a", "ghost"})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{"ghost"}, missing)
		assert.ElementsMatch(t, []string{"a", "b", "c", "d"}, keysOf(set))
	})

	t.Run("leaf root yields singleton", func(t *testing.T) {
		set, missing, err := CollectSubtreeIDs(context.Background(), build(), []string{"c"})
		require.NoError(t, err)
		assert.Empty(t, missing)
		assert.ElementsMatch(t, []string{"c"}, keysOf(set))
	})
}

func keysOf(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestFolderTree_Add_SetsParentID(t *testing.T) {
	tree := NewEmptyFolderTree()

	f := Folder{ID: "child", Title: "Child", Path: "child/"}
	tree.Add(f, "parent-uid")

	got, ok := tree.Get("child")
	require.True(t, ok)
	assert.Equal(t, "parent-uid", got.ParentID, "Add should set ParentID to parent")

	// Root folder
	root := Folder{ID: "root", Title: "Root", Path: "root/"}
	tree.Add(root, "")

	gotRoot, ok := tree.Get("root")
	require.True(t, ok)
	assert.Empty(t, gotRoot.ParentID, "root folder should have empty ParentID")
}
