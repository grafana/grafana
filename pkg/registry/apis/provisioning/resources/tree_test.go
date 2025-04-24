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
