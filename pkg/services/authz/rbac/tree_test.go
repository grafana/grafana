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
		{UID: "11", ParentUID: new("1")},
		{UID: "12", ParentUID: new("1")},
		{UID: "111", ParentUID: new("11")},
		{UID: "1111", ParentUID: new("111")},
		{UID: "121", ParentUID: new("12")},
		// not ordered insert to make sure patching works correctly
		{UID: "22", ParentUID: new("2")},
		{UID: "222", ParentUID: new("22")},
		{UID: "21", ParentUID: new("2")},
		{UID: "2"},
	})

	verify := func(t *testing.T, expected []string, visited map[string]bool) {
		assert.Len(t, visited, len(expected))
		for _, e := range expected {
			assert.True(t, visited[e], fmt.Sprintf("did not visit node: %s", e))
		}
	}

	t.Run("should iterate all children of folder 1", func(t *testing.T) {
		visited := map[string]bool{}
		for n := range tree.Children("1") {
			visited[n.UID] = true
		}

		expected := []string{"11", "111", "1111", "12", "121"}
		verify(t, expected, visited)
	})

	t.Run("should iterate all children of folder 2", func(t *testing.T) {
		visited := map[string]bool{}

		for n := range tree.Children("2") {
			visited[n.UID] = true
		}

		expected := []string{"21", "22", "222"}
		verify(t, expected, visited)
	})

	t.Run("should iterate all children of folder 111", func(t *testing.T) {
		visited := map[string]bool{}

		for n := range tree.Children("111") {
			visited[n.UID] = true
		}

		expected := []string{"1111"}
		verify(t, expected, visited)
	})

	t.Run("should iterate all children of folder 1111", func(t *testing.T) {
		visited := map[string]bool{}

		for n := range tree.Children("1111") {
			visited[n.UID] = true
		}

		expected := []string{}
		verify(t, expected, visited)
	})

	t.Run("should iterate all acestors of folder 1111", func(t *testing.T) {
		visited := map[string]bool{}

		for n := range tree.Ancestors("1111") {
			visited[n.UID] = true
		}

		expected := []string{"1", "11", "111"}
		verify(t, expected, visited)
	})

	t.Run("should iterate all acestors of folder 11", func(t *testing.T) {
		visited := map[string]bool{}
		for n := range tree.Ancestors("11") {
			visited[n.UID] = true
		}

		expected := []string{"1"}
		verify(t, expected, visited)
	})

	t.Run("should iterate all acestors of folder 222", func(t *testing.T) {
		visited := map[string]bool{}
		for n := range tree.Ancestors("222") {
			visited[n.UID] = true
		}

		expected := []string{"2", "22"}
		verify(t, expected, visited)
	})
}
