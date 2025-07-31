package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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

func TestNewEmptyFolderWithRoot(t *testing.T) {
	t.Run("creates folder tree with root folder", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Verify it's a folderTree with the correct root folder
		ft, ok := tree.(*folderTree)
		require.True(t, ok, "should return a folderTree instance")
		assert.Equal(t, rootFolder, ft.rootFolder, "should set the root folder")
		assert.Equal(t, 0, tree.Count(), "should start with zero folders")
	})

	t.Run("creates folder tree without root folder when empty string", func(t *testing.T) {
		tree := NewEmptyFolderWithRoot("")
		
		ft, ok := tree.(*folderTree)
		require.True(t, ok, "should return a folderTree instance")
		assert.Equal(t, "", ft.rootFolder, "should have empty root folder")
	})
}

func TestAddUnstructuredWithRootFolder(t *testing.T) {
	t.Run("uses root folder for resources with empty parent", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Create a folder resource without a parent folder
		folderResource := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "test-folder",
				},
				"spec": map[string]interface{}{
					"title": "Test Folder",
				},
			},
		}
		
		err := tree.AddUnstructured(folderResource)
		require.NoError(t, err, "should add folder without error")
		
		// Verify the folder was added with the root folder as parent
		ft := tree.(*folderTree)
		assert.Equal(t, rootFolder, ft.tree["test-folder"], "should use root folder as parent")
		assert.Equal(t, 1, tree.Count(), "should have one folder")
		assert.True(t, tree.In("test-folder"), "should contain the added folder")
	})

	t.Run("preserves existing parent folder when not empty", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Create a folder resource with an existing parent folder
		folderResource := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "test-folder",
					"annotations": map[string]interface{}{
						"grafana.app/folder": "existing-parent",
					},
				},
				"spec": map[string]interface{}{
					"title": "Test Folder",
				},
			},
		}
		
		err := tree.AddUnstructured(folderResource)
		require.NoError(t, err, "should add folder without error")
		
		// Verify the folder was added with the existing parent, not the root folder
		ft := tree.(*folderTree)
		assert.Equal(t, "existing-parent", ft.tree["test-folder"], "should preserve existing parent folder")
		assert.Equal(t, 1, tree.Count(), "should have one folder")
	})

	t.Run("works without root folder set", func(t *testing.T) {
		tree := NewEmptyFolderTree()
		
		// Create a folder resource without a parent folder
		folderResource := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "test-folder",
				},
				"spec": map[string]interface{}{
					"title": "Test Folder",
				},
			},
		}
		
		err := tree.AddUnstructured(folderResource)
		require.NoError(t, err, "should add folder without error")
		
		// Verify the folder was added with empty parent (original behavior)
		ft := tree.(*folderTree)
		assert.Equal(t, "", ft.tree["test-folder"], "should have empty parent folder")
		assert.Equal(t, 1, tree.Count(), "should have one folder")
	})

	t.Run("handles multiple resources with root folder", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Add folder without parent
		folder1 := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "folder1",
				},
				"spec": map[string]interface{}{
					"title": "Folder 1",
				},
			},
		}
		
		// Add folder with existing parent
		folder2 := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "folder2",
					"annotations": map[string]interface{}{
						"grafana.app/folder": "folder1",
					},
				},
				"spec": map[string]interface{}{
					"title": "Folder 2",
				},
			},
		}
		
		err := tree.AddUnstructured(folder1)
		require.NoError(t, err)
		err = tree.AddUnstructured(folder2)
		require.NoError(t, err)
		
		ft := tree.(*folderTree)
		assert.Equal(t, rootFolder, ft.tree["folder1"], "folder1 should use root folder as parent")
		assert.Equal(t, "folder1", ft.tree["folder2"], "folder2 should use folder1 as parent")
		assert.Equal(t, 2, tree.Count(), "should have two folders")
	})
}

func TestRootFolderInTreeOperations(t *testing.T) {
	t.Run("In method recognizes root folder", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Root folder should be recognized as being in the tree
		assert.True(t, tree.In(rootFolder), "root folder should be in tree")
		assert.True(t, tree.In(""), "empty string should still be in tree")
		assert.False(t, tree.In("non-existent"), "non-existent folder should not be in tree")
	})

	t.Run("DirPath works with root folder as base", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Add a folder that uses the root folder as parent
		folderResource := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "child-folder",
				},
				"spec": map[string]interface{}{
					"title": "Child Folder",
				},
			},
		}
		
		err := tree.AddUnstructured(folderResource)
		require.NoError(t, err)
		
		// Test DirPath with root folder as base
		fid, ok := tree.DirPath("child-folder", rootFolder)
		assert.True(t, ok, "should be able to get DirPath with root folder as base")
		assert.Equal(t, "child-folder", fid.ID, "should have correct ID")
		assert.Equal(t, "Child Folder", fid.Title, "should have correct title")
		assert.Equal(t, "Child Folder", fid.Path, "should have correct path")
	})

	t.Run("DirPath works with root folder as target", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Test DirPath for the root folder itself
		fid, ok := tree.DirPath(rootFolder, rootFolder)
		assert.True(t, ok, "should be able to get DirPath for root folder itself")
		assert.Equal(t, rootFolder, fid.ID, "should have correct ID")
		assert.Equal(t, rootFolder, fid.Title, "should have correct title")
		assert.Equal(t, "", fid.Path, "should have empty path when folder equals base")
	})

	t.Run("DirPath handles nested folders with root folder", func(t *testing.T) {
		rootFolder := "test-root"
		tree := NewEmptyFolderWithRoot(rootFolder)
		
		// Add nested folders: root -> child1 -> child2
		child1 := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "child1",
				},
				"spec": map[string]interface{}{
					"title": "Child 1",
				},
			},
		}
		
		child2 := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "child2",
					"annotations": map[string]interface{}{
						"grafana.app/folder": "child1",
					},
				},
				"spec": map[string]interface{}{
					"title": "Child 2",
				},
			},
		}
		
		err := tree.AddUnstructured(child1)
		require.NoError(t, err)
		err = tree.AddUnstructured(child2)
		require.NoError(t, err)
		
		// Test DirPath from deepest child to root
		fid, ok := tree.DirPath("child2", rootFolder)
		assert.True(t, ok, "should be able to get DirPath from child2 to root")
		assert.Equal(t, "child2", fid.ID, "should have correct ID")
		assert.Equal(t, "Child 2", fid.Title, "should have correct title")
		assert.Equal(t, "Child 1/Child 2", fid.Path, "should have correct nested path")
	})

	t.Run("empty root folder works as before", func(t *testing.T) {
		tree := NewEmptyFolderWithRoot("")
		
		// Should behave exactly like NewEmptyFolderTree
		folderResource := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "test-folder",
				},
				"spec": map[string]interface{}{
					"title": "Test Folder",
				},
			},
		}
		
		err := tree.AddUnstructured(folderResource)
		require.NoError(t, err)
		
		ft := tree.(*folderTree)
		assert.Equal(t, "", ft.tree["test-folder"], "should have empty parent")
		assert.True(t, tree.In("test-folder"), "should be in tree")
		assert.True(t, tree.In(""), "empty string should be in tree")
		assert.False(t, tree.In("non-existent"), "non-existent should not be in tree")
	})
}
