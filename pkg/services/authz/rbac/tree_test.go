package rbac

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/stretchr/testify/assert"
)

func Test_Tree(t *testing.T) {

	tree := newFolderTree([]store.Folder{
		{UID: "1"},
		{UID: "11", ParentUID: strPtr("1")},
		{UID: "12", ParentUID: strPtr("1")},
		{UID: "111", ParentUID: strPtr("11")},
		{UID: "1111", ParentUID: strPtr("111")},
		{UID: "121", ParentUID: strPtr("12")},
		// not ordered insert to make sure pathcing works correctly
		{UID: "22", ParentUID: strPtr("2")},
		{UID: "222", ParentUID: strPtr("22")},
		{UID: "21", ParentUID: strPtr("2")},
		{UID: "2"},
	})

	verify := func(expected []string, visited map[string]bool) {
		assert.Len(t, visited, len(expected))
		for _, e := range expected {
			assert.True(t, visited[e], fmt.Sprintf("did not visit node: %s", e))
		}
	}

	t.Run("should walk all descendants of folder 1", func(t *testing.T) {
		visited := map[string]bool{}
		tree.Walk("1", directionDescendants, func(n folderNode) bool {
			visited[n.UID] = true
			return true
		})

		expected := []string{"1", "11", "111", "1111", "12", "121"}
		verify(expected, visited)
	})

	t.Run("should walk all descendants of folder 2", func(t *testing.T) {
		visited := map[string]bool{}
		tree.Walk("2", directionDescendants, func(n folderNode) bool {
			visited[n.UID] = true
			return true
		})

		expected := []string{"2", "21", "22", "222"}
		verify(expected, visited)
	})

	t.Run("should walk all descendants of folder 111", func(t *testing.T) {
		visited := map[string]bool{}
		tree.Walk("111", directionDescendants, func(n folderNode) bool {
			visited[n.UID] = true
			return true
		})

		expected := []string{"111", "1111"}
		verify(expected, visited)
	})

	t.Run("should walk all acestors of folder 1111", func(t *testing.T) {
		visited := map[string]bool{}
		tree.Walk("1111", directionAncestors, func(n folderNode) bool {
			visited[n.UID] = true
			return true
		})

		expected := []string{"1", "11", "111", "1111"}
		verify(expected, visited)
	})

	t.Run("should walk all acestors of folder 11", func(t *testing.T) {
		visited := map[string]bool{}
		tree.Walk("11", directionAncestors, func(n folderNode) bool {
			visited[n.UID] = true
			return true
		})

		expected := []string{"1", "11"}
		verify(expected, visited)
	})

	t.Run("should walk all acestors of folder 222", func(t *testing.T) {
		visited := map[string]bool{}
		tree.Walk("222", directionAncestors, func(n folderNode) bool {
			visited[n.UID] = true
			return true
		})

		expected := []string{"2", "22", "222"}
		verify(expected, visited)
	})
}
