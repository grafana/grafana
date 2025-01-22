package jobs

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFolderTree(t *testing.T) {
	t.Run("empty tree", func(t *testing.T) {
		tree := &folderTree{
			tree:       map[string]string{"x": ""},
			repoFolder: "x",
		}

		assert.True(t, tree.In("x"))
		assert.False(t, tree.In("z"))
		assert.Empty(t, tree.DirPath("x"))
		assert.PanicsWithValue(t, "undefined behaviour", func() { tree.DirPath("z") }, "unknown folders cannot have a DirPath result")
	})

	t.Run("simple tree", func(t *testing.T) {
		tree := &folderTree{
			tree:       map[string]string{"a": "b", "b": "c", "c": "x", "x": ""},
			repoFolder: "x",
		}

		assert.True(t, tree.In("x"))
		assert.True(t, tree.In("a"))
		assert.False(t, tree.In("z"))
		assert.Empty(t, tree.DirPath("x"))
		assert.Equal(t, "c", tree.DirPath("c"))
		assert.Equal(t, "c/b/a", tree.DirPath("a"))
	})
}
