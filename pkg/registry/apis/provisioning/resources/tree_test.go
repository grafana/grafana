package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
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
