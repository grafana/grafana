package folder

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFoldersSortByPostorder(t *testing.T) {
	t.Run("empty list returns empty list", func(t *testing.T) {
		var folders []*Folder
		result := SortByPostorder(folders)
		require.Empty(t, result)
	})

	t.Run("single folder returns single folder", func(t *testing.T) {
		folders := []*Folder{
			{UID: "a", ParentUID: "root"},
		}
		result := SortByPostorder(folders)
		require.Len(t, result, 1)
		require.Equal(t, "a", result[0].UID)
	})

	t.Run("linear hierarchy orders children before parents", func(t *testing.T) {
		// Structure: root -> a -> b -> c
		folders := []*Folder{
			{UID: "a", ParentUID: "root"},
			{UID: "c", ParentUID: "b"},
			{UID: "b", ParentUID: "a"},
		}
		result := SortByPostorder(folders)
		require.Len(t, result, 3)
		// Postorder: c, b, a (children before parents)
		require.Equal(t, "c", result[0].UID)
		require.Equal(t, "b", result[1].UID)
		require.Equal(t, "a", result[2].UID)
	})

	t.Run("branching hierarchy orders all children before their parent", func(t *testing.T) {
		// Structure:
		//     root
		//      |
		//      a
		//    / | \
		//   b  c  d
		folders := []*Folder{
			{UID: "a", ParentUID: "root"},
			{UID: "b", ParentUID: "a"},
			{UID: "c", ParentUID: "a"},
			{UID: "d", ParentUID: "a"},
		}
		result := SortByPostorder(folders)
		require.Len(t, result, 4)
		// 'a' must come after all its children (b, c, d)
		aIndex := -1
		for i, f := range result {
			if f.UID == "a" {
				aIndex = i
				break
			}
		}
		require.Equal(t, 3, aIndex, "parent 'a' should be last")
		// All children should come before parent
		for i := 0; i < 3; i++ {
			require.Contains(t, []string{"b", "c", "d"}, result[i].UID)
		}
	})

	t.Run("deep hierarchy orders by depth", func(t *testing.T) {
		// Structure:
		//     root
		//      |
		//      a
		//      |
		//      b
		//     / \
		//    c   d
		//    |
		//    e
		folders := []*Folder{
			{UID: "a", ParentUID: "root"},
			{UID: "b", ParentUID: "a"},
			{UID: "c", ParentUID: "b"},
			{UID: "d", ParentUID: "b"},
			{UID: "e", ParentUID: "c"},
		}
		result := SortByPostorder(folders)
		require.Len(t, result, 5)
		// e should come before c
		eIndex := -1
		cIndex := -1
		for i, f := range result {
			if f.UID == "e" {
				eIndex = i
			}
			if f.UID == "c" {
				cIndex = i
			}
		}
		require.Less(t, eIndex, cIndex, "e should come before c")
		// c and d should come before b
		bIndex := -1
		dIndex := -1
		for i, f := range result {
			if f.UID == "b" {
				bIndex = i
			}
			if f.UID == "d" {
				dIndex = i
			}
		}
		require.Less(t, cIndex, bIndex, "c should come before b")
		require.Less(t, dIndex, bIndex, "d should come before b")
		// b should come before a
		aIndex := -1
		for i, f := range result {
			if f.UID == "a" {
				aIndex = i
			}
		}
		require.Less(t, bIndex, aIndex, "b should come before a")
	})

	t.Run("multiple subtrees maintains postorder per subtree", func(t *testing.T) {
		// Structure:
		//   root1      root2
		//    / \        |
		//   a   b       c
		//       |       |
		//       d       e
		folders := []*Folder{
			{UID: "a", ParentUID: "root1"},
			{UID: "b", ParentUID: "root1"},
			{UID: "d", ParentUID: "b"},
			{UID: "c", ParentUID: "root2"},
			{UID: "e", ParentUID: "c"},
		}
		result := SortByPostorder(folders)
		require.Len(t, result, 5)

		// Find indices
		indices := make(map[string]int)
		for i, f := range result {
			indices[f.UID] = i
		}

		// Check postorder for first subtree: d before b, both before root1
		require.Less(t, indices["d"], indices["b"], "d should come before b")
		// Check postorder for second subtree: e before c, both before root2
		require.Less(t, indices["e"], indices["c"], "e should come before c")
	})
}
