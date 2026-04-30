package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestChanges(t *testing.T) {
	t.Run("start the same", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "simplelocal/dashboard.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "simplelocal/dashboard.json", Hash: "xyz"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("create a source file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "muta.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "muta.json",
			Hash:   "xyz",
		}, changes[0])
	})
	t.Run("empty file path", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "", Resource: "dashboard", Group: "dashboard.grafana.app"},
			},
		}
		_, err := Changes(context.Background(), source, target, true)
		require.EqualError(t, err, "empty path on a non folder")
	})

	t.Run("empty path with folder resource", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("create empty folder structure for folders with unsupported file types", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/first.md", Hash: "xyz", Blob: true},
			{Path: "other/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 2)

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "one/two/",
			Hash:   "xyz",
		}, changes[0])
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "other/",
			Hash:   "xyz",
		}, changes[1])
	})

	t.Run("keep empty folders when unsupported file types are present", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/first.md", Hash: "xyz", Blob: true},
			{Path: "other/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "one/two/", Resource: "folders"},
				{Path: "other/", Resource: "folders"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes)
	})
	t.Run("keep common path to unsupported file types", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "common/first.md", Hash: "xyz", Blob: true},
			{Path: "alsocommon/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "common/", Resource: "folders"},
				{Path: "common/not-common/", Resource: "folders", Name: "uncommon-name", Hash: "xyz"},
				{Path: "alsocommon/", Resource: "folders"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionDeleted,
			Path:   "common/not-common/",
			Existing: &provisioning.ResourceListItem{
				Path:     "common/not-common/",
				Resource: "folders",
				Name:     "uncommon-name",
				Hash:     "xyz",
			},
		}, changes[0], "the uncommon path should be deleted")
	})

	t.Run("delete a source file", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "adsl62h.yaml", Hash: "xyz", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionDeleted,
			Path:   "adsl62h.yaml",
			Existing: &provisioning.ResourceListItem{
				Path:     "adsl62h.yaml",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				Hash:     "xyz",
			},
		}, changes[0])
	})

	t.Run("folder deletion order", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "x/y/z/ignored.md", Blob: true}, // ignored
			{Path: "aaa/bbb.yaml", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "a.json"},
				{Path: "x/y/file.json"},
				{Path: "aaa/", Resource: "folders"}, // Folder... no action required
				{Path: "aaa/bbb.yaml", Hash: "xyz"},
				{Path: "zzz/longest/path/here.json"},
				{Path: "short/file.yml"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)

		order := make([]string, len(changes))
		for i := range changes {
			order[i] = changes[i].Path
		}
		require.Equal(t, []string{
			"zzz/longest/path/here.json", // not sorted yet
			"x/y/file.json",
			"x/y/z/",
			"short/file.yml",
			"a.json",
		}, order)
	})

	t.Run("modify a file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "adsl62h.yaml", Hash: "modified", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Path:     "adsl62h.yaml",
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
					Hash:     "original",
				},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 1)
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionUpdated,
			Path:   "adsl62h.yaml",
			Existing: &provisioning.ResourceListItem{
				Path:     "adsl62h.yaml",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "adsl62h-hrw-f-fvlt2dghp-gufrc4lisksgmq-c",
				Hash:     "original",
			},
		}, changes[0])
	})

	t.Run("keep folder with hidden files", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.hidden.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes, "folder should be kept when it contains hidden files")
	})

	t.Run("keep folder with invalid hidden paths", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.invalid/path.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes, "folder should be kept when it contains invalid hidden paths")
	})

	t.Run("keep folder with hidden folders", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.hidden/valid.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes, "folder should be kept when it contains hidden folders")
	})

	t.Run("unhidden path from hidden file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder/.hidden/dashboard.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder/", Resource: "folders"},
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes, "hidden file should not be unhidden")
	})
	t.Run("hidden path to file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/.hidden/dashboard.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}
		expected := []ResourceFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "one/two/",
				Hash:   "xyz",
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Equal(t, expected, changes)
	})
	t.Run("hidden path to folder", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/.hidden/folder/", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}
		expected := []ResourceFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "one/two/",
				Hash:   "xyz",
			},
		}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Equal(t, expected, changes)
	})
	t.Run("hidden at the root", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: ".hidden/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}
		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("nested folder with space is created correctly", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "abc/dash.json", Hash: "abc", Blob: true},
			{Path: "abc/nested folder/nested-dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}

		expected := []ResourceFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "abc/nested folder/nested-dashboard.json",
				Hash:   "xyz",
			},
			{
				Action: repository.FileActionCreated,
				Path:   "abc/dash.json",
				Hash:   "abc",
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Equal(t, expected, changes, "Expected diff to correctly include nested folder contents")
	})

	t.Run("error on empty path for non-folder resource", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "", Resource: "dashboard", Group: "dashboard.grafana.app"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.Error(t, err)
		require.Contains(t, err.Error(), "empty path on a non folder")
		require.Nil(t, changes)
	})

	t.Run("complex nested folder hierarchy with mixed file types", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "root/folder1/dashboard.json", Hash: "abc", Blob: true},
			{Path: "root/folder1/subfolder/.gitkeep", Hash: "def", Blob: true},
			{Path: "root/folder2/alert.json", Hash: "ghi", Blob: true},
			{Path: "root/folder2/README.md", Hash: "jkl", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "root/", Resource: "folders"},
				{Path: "root/folder1/", Resource: "folders"},
				{Path: "root/folder2/", Resource: "folders"},
				{Path: "root/folder1/dashboard.json", Hash: "abc", Resource: "dashboard"},
				{Path: "root/folder2/alert.json", Hash: "old", Resource: "alert"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 2)
		require.Equal(t, "root/folder1/subfolder/", changes[0].Path)
		require.Equal(t, "root/folder2/alert.json", changes[1].Path)
	})

	t.Run("folder path suffix handling", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder1/", Hash: "abc", Blob: false},
			{Path: "folder2/", Hash: "def", Blob: false},
			{Path: "folder3", Hash: "ghi", Blob: false},
			{Path: "folder4/", Hash: "jkl", Blob: false},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder1", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group},
				{Path: "folder2/", Resource: "folders", Group: resources.FolderResource.Group},
				{Path: "folder3", Resource: "folders", Group: resources.FolderResource.Group},
				{Path: "folder4/", Resource: "folders", Group: resources.FolderResource.Group},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Empty(t, changes, "Should handle folder paths with and without trailing slash")
	})

	t.Run("empty source with populated target", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "folder1/", Resource: "folders"},
				{Path: "folder1/dashboard.json", Resource: "dashboard"},
				{Path: "folder2/", Resource: "folders"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 3)

		// Verify deletion order (deepest first)
		require.Equal(t, "folder1/dashboard.json", changes[0].Path)
		require.Equal(t, "folder1/", changes[1].Path)
		require.Equal(t, "folder2/", changes[2].Path)

		for _, change := range changes {
			require.Equal(t, repository.FileActionDeleted, change.Action)
		}
	})

	t.Run("empty target with populated source", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "folder1/", Hash: "abc", Blob: false},
			{Path: "folder1/dashboard.json", Hash: "def", Blob: true},
			{Path: "folder2/", Hash: "ghi", Blob: false},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 3) // Only non-blob entries should create changes

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder1/dashboard.json",
			Hash:   "def",
		}, changes[0])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder1/",
			Hash:   "abc",
		}, changes[1])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder2/",
			Hash:   "ghi",
		}, changes[2])
	})

	t.Run("_folder.json is not treated as a resource change for new folders", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "def", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "ghi", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		// Only the folder and the dashboard — _folder.json must not appear
		require.Len(t, changes, 2)

		paths := make([]string, len(changes))
		for i, c := range changes {
			paths[i] = c.Path
		}
		require.Contains(t, paths, "my-folder/dashboard.json")
		require.Contains(t, paths, "my-folder/")
		require.NotContains(t, paths, "my-folder/_folder.json")
	})

	t.Run("_folder.json hash differs from stored emits folder update", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "new-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "folder-uid"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)

		var folderUpdates []ResourceFileChange
		for _, c := range changes {
			if c.Path == "my-folder/" && c.Action == repository.FileActionUpdated {
				folderUpdates = append(folderUpdates, c)
			}
		}
		require.Len(t, folderUpdates, 1, "expected folder update from _folder.json hash change")
		require.Equal(t, "folder-uid", folderUpdates[0].Existing.Name)
	})

	t.Run("_folder.json hash matches stored emits no update", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "same-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "same-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "folder-uid"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)

		for _, c := range changes {
			if c.Path == "my-folder/" {
				require.NotEqual(t, repository.FileActionUpdated, c.Action, "no update expected when hash matches")
			}
		}
	})

	t.Run("_folder.json exists but folder not in target emits no extra change", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "my-folder/_folder.json", Hash: "def", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "ghi", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)

		for _, c := range changes {
			require.NotEqual(t, repository.FileActionUpdated, c.Action, "no update expected for new folder")
		}
	})

	t.Run("report correct changes with .keep files", func(t *testing.T) {
		// Replicating how `source` is actually being passed in `Changes` function
		source := []repository.FileTreeEntry{
			{Path: "folder1/", Hash: "abc", Blob: false},
			{Path: "folder1/.keep", Hash: "abc", Blob: true},
			{Path: "folder1/dashboard.json", Hash: "def", Blob: true},
			{Path: "folder2/", Hash: "ghi", Blob: false},
			{Path: "folder2/.keep", Hash: "ghi", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		// 2 folders and 1 file, so 3 changes in total
		require.Len(t, changes, 3)

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder1/dashboard.json",
			Hash:   "def",
		}, changes[0])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder1/",
			Hash:   "abc",
		}, changes[1])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder2/",
			Hash:   "ghi",
		}, changes[2])
	})
}

func TestChanges_DuplicatePaths(t *testing.T) {
	t.Run("duplicate path with matching hash keeps primary and deletes orphan", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "dashboard.json", Hash: "current-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "dashboard.json", Hash: "current-hash", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "real-dash"},
				{Path: "dashboard.json", Hash: "old-hash", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "orphan-dash"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 1, "only the orphan should be deleted, primary untouched")
		require.Equal(t, repository.FileActionDeleted, changes[0].Action)
		require.Equal(t, "orphan-dash", changes[0].Existing.Name)
	})

	t.Run("duplicate path with no matching hash deletes orphan and updates primary", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "dashboard.json", Hash: "new-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "dashboard.json", Hash: "hash-a", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a"},
				{Path: "dashboard.json", Hash: "hash-b", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-b"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 2)

		actionsByName := make(map[string]repository.FileAction)
		for _, c := range changes {
			actionsByName[c.Existing.Name] = c.Action
		}
		require.Equal(t, repository.FileActionUpdated, actionsByName["dash-a"], "first item should be updated")
		require.Equal(t, repository.FileActionDeleted, actionsByName["dash-b"], "second item should be deleted as orphan")
	})

	t.Run("duplicate path where source file is deleted removes all items", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "dashboard.json", Hash: "hash-a", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a"},
				{Path: "dashboard.json", Hash: "hash-b", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-b"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 2, "both items should be deleted")
		for _, c := range changes {
			require.Equal(t, repository.FileActionDeleted, c.Action)
		}
	})

	t.Run("three or more items at same path", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "dashboard.json", Hash: "current", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "dashboard.json", Hash: "old-1", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "orphan-1"},
				{Path: "dashboard.json", Hash: "current", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "real"},
				{Path: "dashboard.json", Hash: "old-2", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "orphan-2"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 2, "two orphans should be deleted, primary untouched")

		deletedNames := make([]string, 0, 2)
		for _, c := range changes {
			require.Equal(t, repository.FileActionDeleted, c.Action)
			deletedNames = append(deletedNames, c.Existing.Name)
		}
		require.Contains(t, deletedNames, "orphan-1")
		require.Contains(t, deletedNames, "orphan-2")
	})

	t.Run("duplicate path does not affect other non-duplicate paths", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "dashboard.json", Hash: "current", Blob: true},
			{Path: "other.json", Hash: "other-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "dashboard.json", Hash: "current", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "real"},
				{Path: "dashboard.json", Hash: "stale", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "orphan"},
				{Path: "other.json", Hash: "other-hash", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "other"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		require.Len(t, changes, 1, "only the orphan should be deleted")
		require.Equal(t, "orphan", changes[0].Existing.Name)
		require.Equal(t, repository.FileActionDeleted, changes[0].Action)
	})

	t.Run("duplicate folder paths are not cleaned up by Changes (handled downstream)", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "myfolder", Hash: "tree-hash", Blob: false},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "myfolder/", Hash: "meta-hash-1", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Name: "folder-uid-1"},
				{Path: "myfolder/", Hash: "meta-hash-2", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Name: "folder-uid-2"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)
		for _, c := range changes {
			require.NotEqual(t, repository.FileActionDeleted, c.Action,
				"folder duplicates should not be deleted by Changes(); orphan cleanup is deferred to augmentChangesForFolderMetadata")
		}
	})

	t.Run("_folder.json with multiple parent folders keeps best-match and deletes orphan", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "myfolder", Hash: "tree-hash", Blob: false},
			{Path: "myfolder/_folder.json", Hash: "new-meta-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "myfolder/", Hash: "old-meta-hash", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Name: "orphan-uid"},
				{Path: "myfolder/", Hash: "new-meta-hash", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Name: "current-uid"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)

		// No update for the best-match (hash matches _folder.json).
		for _, c := range changes {
			if c.Path == "myfolder/" && c.Action == repository.FileActionUpdated {
				t.Fatalf("should not emit folder update when best-match hash equals _folder.json hash, got Existing=%s", c.Existing.Name)
			}
		}
		// The orphan should be deleted.
		var deleted []string
		for _, c := range changes {
			if c.Path == "myfolder/" && c.Action == repository.FileActionDeleted {
				deleted = append(deleted, c.Existing.Name)
			}
		}
		require.Equal(t, []string{"orphan-uid"}, deleted, "orphan folder should be deleted")
	})

	t.Run("_folder.json with multiple parent folders emits update and deletes orphan", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "myfolder", Hash: "tree-hash", Blob: false},
			{Path: "myfolder/_folder.json", Hash: "brand-new-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "myfolder/", Hash: "old-hash-a", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Name: "folder-a"},
				{Path: "myfolder/", Hash: "old-hash-b", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Name: "folder-b"},
			},
		}

		changes, err := Changes(context.Background(), source, target, true)
		require.NoError(t, err)

		var folderUpdate *ResourceFileChange
		var deletedNames []string
		for i := range changes {
			if changes[i].Path == "myfolder/" && changes[i].Action == repository.FileActionUpdated {
				folderUpdate = &changes[i]
			}
			if changes[i].Path == "myfolder/" && changes[i].Action == repository.FileActionDeleted {
				deletedNames = append(deletedNames, changes[i].Existing.Name)
			}
		}
		require.NotNil(t, folderUpdate, "should emit folder update when no parent hash matches")
		require.Equal(t, "folder-a", folderUpdate.Existing.Name, "should fall back to first item when no hash matches")
		require.Equal(t, []string{"folder-b"}, deletedNames, "non-primary folder should be deleted as orphan")
	})
}

func TestChanges_FolderMetadataFlagDisabled(t *testing.T) {
	t.Run("_folder.json is kept but not treated as resource or metadata when flag off", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "def", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "ghi", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(context.Background(), source, target, false)
		require.NoError(t, err)

		// With flag off, _folder.json is added to keep trie (prevents parent
		// folder deletion) but NOT emitted as a resource change or metadata update.
		paths := make([]string, len(changes))
		for i, c := range changes {
			paths[i] = c.Path
		}
		require.NotContains(t, paths, "my-folder/_folder.json",
			"_folder.json should not appear as a change when flag is off")
		require.Contains(t, paths, "my-folder/dashboard.json",
			"dashboard should still be created")
		require.Contains(t, paths, "my-folder/",
			"folder should still be created")
	})

	t.Run("_folder.json hash change does not emit folder update when flag off", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "new-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "folder-uid"},
			},
		}

		changes, err := Changes(context.Background(), source, target, false)
		require.NoError(t, err)

		// With flag off, no folder update should be emitted from metadata hash comparison.
		for _, c := range changes {
			if c.Path == "my-folder/" && c.Action == repository.FileActionUpdated {
				t.Fatal("folder update should not be emitted when flag is off")
			}
		}
	})
}

func TestCompare(t *testing.T) {
	tests := []struct {
		name            string
		setupMocks      func(*repository.MockRepository, *resources.MockRepositoryResources)
		expectedError   string
		expectedChanges []ResourceFileChange
		expectedMissing []string
		description     string
	}{
		{
			name:        "error listing current resources",
			description: "Should return error when listing current resources fails",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources) {
				repoResources.On("List", mock.Anything).Return(nil, fmt.Errorf("listing failed"))
			},
			expectedError: "error listing current: listing failed",
		},
		{
			name:        "error reading tree",
			description: "Should return error when reading tree fails",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources) {
				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return(nil, fmt.Errorf("read tree failed"))
			},
			expectedError: "error reading tree: read tree failed",
		},
		{
			name:        "no changes between source and target",
			description: "Should return empty changes when source and target are identical",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources) {
				target := &provisioning.ResourceList{
					Items: []provisioning.ResourceListItem{
						{Path: "dashboard.json", Hash: "xyz"},
					},
				}
				source := []repository.FileTreeEntry{
					{Path: "dashboard.json", Hash: "xyz", Blob: true},
				}

				repoResources.On("List", mock.Anything).Return(target, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return(source, nil)
			},
			expectedChanges: []ResourceFileChange{},
		},
		{
			name:        "compare function error",
			description: "Should return error when comparing fails",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources) {
				target := &provisioning.ResourceList{
					Items: []provisioning.ResourceListItem{
						// Empty path to trigger error
						{Path: "", Hash: "xyz", Resource: "dashboard", Group: "dashboard.grafana.app"},
					},
				}
				source := []repository.FileTreeEntry{
					{Path: "dashboard.json", Hash: "xyz", Blob: true},
				}
				repoResources.On("List", mock.Anything).Return(target, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return(source, nil)
			},
			expectedError: "calculate changes: empty path on a non folder",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repoResources := resources.NewMockRepositoryResources(t)

			tt.setupMocks(repo, repoResources)

			changes, missing, invalid, err := Compare(context.Background(), repo, repoResources, "current-ref", true)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
				require.Nil(t, changes)
				require.Nil(t, missing)
				require.Nil(t, invalid)
			} else {
				require.NoError(t, err, tt.description)
				require.Equal(t, tt.expectedChanges, changes, tt.description)
				require.Equal(t, tt.expectedMissing, missing, tt.description)
				require.Nil(t, invalid, tt.description)
			}
		})
	}
}

func TestCompare_FolderMetadataFlagDisabled(t *testing.T) {
	t.Run("augmentChangesForFolderMetadata skipped when flag off", func(t *testing.T) {
		repo := repository.NewMockRepository(t)
		repoResources := resources.NewMockRepositoryResources(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "new-hash", Blob: true},
		}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-uid"},
			},
		}

		repoResources.On("List", mock.Anything).Return(target, nil)
		repoResources.On("SetTree", mock.Anything).Return().Maybe()
		repo.On("ReadTree", mock.Anything, "ref").Return(source, nil)
		// NOT mocking repo.Read — if augmentChangesForUIDChanges ran,
		// it would call ReadFolderMetadata which calls repo.Read, and
		// the mock would panic on unexpected call.

		changes, _, invalid, err := Compare(context.Background(), repo, repoResources, "ref", false)
		require.NoError(t, err)
		require.Nil(t, invalid)

		// No folder update should be emitted — the metadata processing is skipped.
		for _, c := range changes {
			if c.Path == "my-folder/" && c.Action == repository.FileActionUpdated {
				t.Fatal("folder update should not be emitted when flag is off")
			}
		}
	})
}

func TestCompare_InvalidFolderMetadataWarning(t *testing.T) {
	tests := []struct {
		name         string
		metadataData []byte
	}{
		{
			name:         "malformed json",
			metadataData: []byte("not-json"),
		},
		{
			name:         "missing metadata name",
			metadataData: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"My Folder"}}`),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repoResources := resources.NewMockRepositoryResources(t)

			source := []repository.FileTreeEntry{
				{Path: "my-folder/", Hash: "folder-hash", Blob: false},
				{Path: "my-folder/_folder.json", Hash: "new-metadata-hash", Blob: true},
			}
			target := &provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{
						Path:     "my-folder/",
						Hash:     "old-metadata-hash",
						Resource: resources.FolderResource.Resource,
						Group:    resources.FolderResource.Group,
						Name:     "existing-uid",
					},
				},
			}

			repoResources.On("List", mock.Anything).Return(target, nil)
			repo.On("ReadTree", mock.Anything, "current-ref").Return(source, nil)
			repo.On("Read", mock.Anything, "my-folder/_folder.json", "current-ref").
				Return(&repository.FileInfo{Data: tt.metadataData, Hash: "new-metadata-hash"}, nil)

			changes, missing, invalid, err := Compare(context.Background(), repo, repoResources, "current-ref", true)

			require.NoError(t, err)
			require.Empty(t, changes)
			require.Empty(t, missing)
			require.Len(t, invalid, 1)
			require.ErrorIs(t, invalid[0], resources.ErrInvalidFolderMetadata)
			require.Equal(t, "my-folder/", invalid[0].Path)
			require.Equal(t, repository.FileActionUpdated, invalid[0].Action)
		})
	}
}

func TestCompare_InvalidCreatedFolderMetadataWarningPreservesFolderCreate(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)

	source := []repository.FileTreeEntry{
		{Path: "my-folder/", Hash: "folder-hash", Blob: false},
		{Path: "my-folder/_folder.json", Hash: "new-metadata-hash", Blob: true},
		{Path: "my-folder/dashboard.json", Hash: "dashboard-hash", Blob: true},
	}
	target := &provisioning.ResourceList{}

	repoResources.On("List", mock.Anything).Return(target, nil)
	repoResources.On("SetTree", mock.Anything).Return().Maybe()
	repo.On("ReadTree", mock.Anything, "current-ref").Return(source, nil)
	repo.On("Read", mock.Anything, "my-folder/_folder.json", "current-ref").
		Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken Folder"}}`),
			Hash: "new-metadata-hash",
		}, nil)

	changes, missing, invalid, err := Compare(context.Background(), repo, repoResources, "current-ref", true)

	require.NoError(t, err)
	require.Empty(t, missing)
	require.Len(t, invalid, 1)
	require.ErrorIs(t, invalid[0], resources.ErrInvalidFolderMetadata)
	require.Equal(t, repository.FileActionCreated, invalid[0].Action)

	actionsByPath := make(map[string]repository.FileAction, len(changes))
	for _, change := range changes {
		actionsByPath[change.Path] = change.Action
	}
	require.Equal(t, repository.FileActionCreated, actionsByPath["my-folder/"])
	require.Equal(t, repository.FileActionCreated, actionsByPath["my-folder/dashboard.json"])
}

func TestAugmentChangesForFolderMoves(t *testing.T) {
	existingItem := func(path, uid string) *provisioning.ResourceListItem {
		return &provisioning.ResourceListItem{
			Path:     path,
			Resource: resources.FolderResource.Resource,
			Group:    resources.FolderResource.Group,
			Name:     uid,
		}
	}

	folderMetaJSON := func(uid string) []byte {
		return []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"` + uid + `"},"spec":{"title":"My Folder"}}`)
	}

	t.Run("no-op when no deleted folders", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		input := []ResourceFileChange{
			{Action: repository.FileActionCreated, Path: "new-folder/"},
			{Action: repository.FileActionCreated, Path: "file.json"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Equal(t, input, result)
	})

	t.Run("no-op when no created folders", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: existingItem("old-folder/", "folder-uid")},
			{Action: repository.FileActionDeleted, Path: "file.json"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Equal(t, input, result)
	})

	t.Run("no-op when deleted folder has no Existing item", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		// deletedFolders stays empty because nil Existing is not tracked,
		// so the early-return fires and repo.Read is never called.

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: nil},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Equal(t, input, result)
	})

	t.Run("simple folder move merges delete into update", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-folder/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("folder-uid")}, nil)

		oldExisting := existingItem("old-folder/", "folder-uid")
		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: oldExisting},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		// DELETE is removed, CREATE becomes UPDATE
		require.Len(t, result, 1)
		require.Equal(t, "new-folder/", result[0].Path)
		require.Equal(t, repository.FileActionUpdated, result[0].Action)
		require.Equal(t, oldExisting, result[0].Existing)
	})

	t.Run("non-matching UIDs produce no merge", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-folder/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("different-uid")}, nil)

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: existingItem("old-folder/", "folder-uid")},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Len(t, result, 2)

		paths := map[string]repository.FileAction{}
		for _, c := range result {
			paths[c.Path] = c.Action
		}
		require.Equal(t, repository.FileActionDeleted, paths["old-folder/"])
		require.Equal(t, repository.FileActionCreated, paths["new-folder/"])
	})

	t.Run("metadata read error is propagated", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-folder/_folder.json", "main").
			Return(nil, fmt.Errorf("storage unavailable"))

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: existingItem("old-folder/", "folder-uid")},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.Error(t, err)
		require.Contains(t, err.Error(), "read folder metadata for new-folder/")
		require.Nil(t, result)
	})

	t.Run("metadata file not found is skipped", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-folder/_folder.json", "main").
			Return(nil, repository.ErrFileNotFound)

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: existingItem("old-folder/", "folder-uid")},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Len(t, result, 2)
	})

	t.Run("invalid metadata leaves folder move as delete plus create", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-folder/_folder.json", "main").
			Return(&repository.FileInfo{Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"No UID"}}`)}, nil)

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: existingItem("old-folder/", "folder-uid")},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Len(t, result, 2)

		paths := map[string]repository.FileAction{}
		for _, c := range result {
			paths[c.Path] = c.Action
		}
		require.Equal(t, repository.FileActionDeleted, paths["old-folder/"])
		require.Equal(t, repository.FileActionCreated, paths["new-folder/"])
	})

	t.Run("non-folder paths are ignored", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-folder/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("folder-uid")}, nil)

		oldExisting := existingItem("old-folder/", "folder-uid")
		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "dashboard.json"},
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: oldExisting},
			{Action: repository.FileActionCreated, Path: "new-file.json"},
			{Action: repository.FileActionCreated, Path: "new-folder/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)

		// Only old-folder/ DELETE was merged into new-folder/ UPDATE;
		// non-folder paths pass through unchanged.
		paths := map[string]repository.FileAction{}
		for _, c := range result {
			paths[c.Path] = c.Action
		}
		require.Equal(t, repository.FileActionDeleted, paths["dashboard.json"])
		require.Equal(t, repository.FileActionCreated, paths["new-file.json"])
		require.Equal(t, repository.FileActionUpdated, paths["new-folder/"])
		require.NotContains(t, paths, "old-folder/")
	})

	t.Run("multiple independent folder moves", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-a/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("uid-a")}, nil)
		repo.On("Read", mock.Anything, "new-b/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("uid-b")}, nil)

		existingA := existingItem("old-a/", "uid-a")
		existingB := existingItem("old-b/", "uid-b")
		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-a/", Existing: existingA},
			{Action: repository.FileActionDeleted, Path: "old-b/", Existing: existingB},
			{Action: repository.FileActionCreated, Path: "new-a/"},
			{Action: repository.FileActionCreated, Path: "new-b/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Len(t, result, 2)

		byPath := map[string]ResourceFileChange{}
		for _, c := range result {
			byPath[c.Path] = c
		}
		require.Equal(t, repository.FileActionUpdated, byPath["new-a/"].Action)
		require.Equal(t, existingA, byPath["new-a/"].Existing)
		require.Equal(t, repository.FileActionUpdated, byPath["new-b/"].Action)
		require.Equal(t, existingB, byPath["new-b/"].Existing)
	})

	t.Run("result is sorted deepest path first", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "new-top/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("uid-top")}, nil)
		repo.On("Read", mock.Anything, "a/new-nested/_folder.json", "main").
			Return(&repository.FileInfo{Data: folderMetaJSON("uid-nested")}, nil)

		input := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-top/", Existing: existingItem("old-top/", "uid-top")},
			{Action: repository.FileActionDeleted, Path: "a/old-nested/", Existing: existingItem("a/old-nested/", "uid-nested")},
			{Action: repository.FileActionCreated, Path: "new-top/"},
			{Action: repository.FileActionCreated, Path: "a/new-nested/"},
		}

		result, err := augmentChangesForFolderMoves(context.Background(), repo, "main", input)
		require.NoError(t, err)
		require.Len(t, result, 2)
		// SortByDepth(false) = descending depth, deepest first
		require.Equal(t, "a/new-nested/", result[0].Path)
		require.Equal(t, "new-top/", result[1].Path)
	})
}

func TestAugmentChangesForFolderMetadata(t *testing.T) {
	// --- UID change subtests ---

	t.Run("emits children for UID change", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "my-folder/_folder.json", "main").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"new-uid"},"spec":{"title":"My Folder"}}`),
			}, nil)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "new-hash", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
			{Path: "my-folder/child-folder", Hash: "def", Blob: false},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "my-folder/dashboard.json", Hash: "xyz", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
				{Path: "my-folder/child-folder", Hash: "def", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "child-folder-uid"},
			},
		}

		changes := []ResourceFileChange{
			{
				Action:   repository.FileActionUpdated,
				Path:     "my-folder/",
				Existing: &provisioning.ResourceListItem{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-uid"},
			},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		paths := make(map[string]bool)
		for _, c := range result {
			paths[c.Path] = true
		}
		require.True(t, paths["my-folder/"], "folder update should be present")
		require.True(t, paths["my-folder/dashboard.json"], "direct child dashboard should be emitted")
		require.True(t, paths["my-folder/child-folder/"], "direct child folder should be emitted")
	})

	t.Run("skips children for title-only change (UID same)", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "my-folder/_folder.json", "main").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"same-uid"},"spec":{"title":"New Title"}}`),
			}, nil)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "new-hash", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "same-uid"},
				{Path: "my-folder/dashboard.json", Hash: "xyz", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
			},
		}

		changes := []ResourceFileChange{
			{
				Action:   repository.FileActionUpdated,
				Path:     "my-folder/",
				Existing: &provisioning.ResourceListItem{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "same-uid"},
			},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Len(t, result, 1, "only the original folder update — no children emitted")
		require.Equal(t, "my-folder/", result[0].Path)
	})

	t.Run("only emits direct children not grandchildren for UID change", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "parent/_folder.json", "main").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"new-parent-uid"},"spec":{"title":"Parent"}}`),
			}, nil)

		source := []repository.FileTreeEntry{
			{Path: "parent/", Hash: "abc", Blob: false},
			{Path: "parent/_folder.json", Hash: "new-hash", Blob: true},
			{Path: "parent/child/", Hash: "def", Blob: false},
			{Path: "parent/child/grandchild.json", Hash: "ghi", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "parent/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-parent-uid"},
				// Hash empty: child never had _folder.json metadata
				{Path: "parent/child/", Hash: "", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "child-uid"},
				{Path: "parent/child/grandchild.json", Hash: "ghi", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "gc-1"},
			},
		}

		changes := []ResourceFileChange{
			{
				Action:   repository.FileActionUpdated,
				Path:     "parent/",
				Existing: &provisioning.ResourceListItem{Path: "parent/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-parent-uid"},
			},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		paths := make(map[string]bool)
		for _, c := range result {
			paths[c.Path] = true
		}
		require.True(t, paths["parent/"], "folder update present")
		require.True(t, paths["parent/child/"], "direct child folder emitted")
		require.False(t, paths["parent/child/grandchild.json"], "grandchild should NOT be emitted")
	})

	t.Run("does not duplicate already-existing changes for UID change", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		repo.On("Read", mock.Anything, "my-folder/_folder.json", "main").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"new-uid"},"spec":{"title":"My Folder"}}`),
			}, nil)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "new-hash", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "changed", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-uid"},
				{Path: "my-folder/dashboard.json", Hash: "original", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
			},
		}

		// dashboard.json is already in changes (hash changed independently)
		changes := []ResourceFileChange{
			{
				Action:   repository.FileActionUpdated,
				Path:     "my-folder/",
				Existing: &provisioning.ResourceListItem{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "old-uid"},
			},
			{
				Action:   repository.FileActionUpdated,
				Path:     "my-folder/dashboard.json",
				Existing: &provisioning.ResourceListItem{Path: "my-folder/dashboard.json", Hash: "original", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
			},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		count := 0
		for _, c := range result {
			if c.Path == "my-folder/dashboard.json" {
				count++
			}
		}
		require.Equal(t, 1, count, "dashboard should appear only once, not duplicated")
	})

	t.Run("no-op when no folder updates", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Hash: "abc", Blob: false},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}

		changes := []ResourceFileChange{
			{Action: repository.FileActionCreated, Path: "my-folder/"},
			{Action: repository.FileActionCreated, Path: "my-folder/dashboard.json"},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Equal(t, changes, result, "should return changes unchanged")
	})

	// --- Deleted metadata subtests ---

	t.Run("emits folder update with FolderRenamed when _folder.json deleted", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Blob: false},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
			// No _folder.json — it was deleted
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}

		changes := []ResourceFileChange{} // no changes from Changes()

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		require.Len(t, result, 1)
		require.Equal(t, repository.FileActionUpdated, result[0].Action)
		require.Equal(t, "my-folder/", result[0].Path)
		require.True(t, result[0].FolderRenamed, "should mark FolderRenamed")
		require.Equal(t, "stable-uid", result[0].Existing.Name)
	})

	t.Run("emits direct children of affected folder for deleted metadata", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Blob: false},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
			{Path: "my-folder/child/", Blob: false},
			// No _folder.json
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid"},
				{Path: "my-folder/dashboard.json", Hash: "xyz", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
				{Path: "my-folder/child/", Hash: "def", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "child-uid"},
			},
		}

		changes := []ResourceFileChange{} // empty

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		require.Len(t, result, 3, "folder update + dashboard + child folder")
		paths := make(map[string]bool)
		for _, c := range result {
			paths[c.Path] = true
			require.Equal(t, repository.FileActionUpdated, c.Action)
		}
		require.True(t, paths["my-folder/"], "folder itself should be updated")
		require.True(t, paths["my-folder/dashboard.json"], "direct child dashboard should be emitted")
		require.True(t, paths["my-folder/child/"], "direct child folder should be emitted")
	})

	t.Run("normalizes source and target directory paths before emitting children", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder", Blob: false},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
			{Path: "my-folder/child", Blob: false},
			// No _folder.json - metadata was deleted.
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid"},
				{Path: "my-folder/dashboard.json", Hash: "xyz", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
				{Path: "my-folder/child", Hash: "def", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "child-uid"},
			},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, nil)
		require.NoError(t, err)

		paths := make(map[string]bool)
		for _, c := range result {
			paths[c.Path] = true
		}
		require.True(t, paths["my-folder/"], "folder update should be emitted with normalized path")
		require.True(t, paths["my-folder/dashboard.json"], "direct child dashboard should be emitted")
		require.True(t, paths["my-folder/child/"], "direct child folder should be emitted with normalized path")
	})

	t.Run("no-op when folder never had metadata (Hash empty)", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Blob: false},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "hash-uid"},
			},
		}

		changes := []ResourceFileChange{}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Empty(t, result, "no changes expected when folder never had metadata")
	})

	t.Run("no-op when _folder.json still exists", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Blob: false},
			{Path: "my-folder/_folder.json", Hash: "some-hash", Blob: true},
			{Path: "my-folder/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "some-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}

		changes := []ResourceFileChange{}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Empty(t, result, "no changes expected when _folder.json still exists")
	})

	t.Run("no-op when folder directory gone from source", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			// Folder entirely removed from source
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid"},
			},
		}

		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "my-folder/", Existing: &provisioning.ResourceListItem{
				Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid",
			}},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Equal(t, changes, result, "no additional changes expected when folder is entirely deleted")
	})

	t.Run("does not duplicate already-existing changes for deleted metadata", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "my-folder/", Blob: false},
			{Path: "my-folder/dashboard.json", Hash: "changed", Blob: true},
			// No _folder.json — deleted
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "my-folder/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "stable-uid"},
				{Path: "my-folder/dashboard.json", Hash: "original", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
			},
		}

		// dashboard.json already appears in changes (hash changed)
		changes := []ResourceFileChange{
			{
				Action:   repository.FileActionUpdated,
				Path:     "my-folder/dashboard.json",
				Existing: &provisioning.ResourceListItem{Path: "my-folder/dashboard.json", Hash: "original", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "dash-1"},
			},
		}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		folderCount := 0
		dashCount := 0
		for _, c := range result {
			if c.Path == "my-folder/" {
				folderCount++
				require.True(t, c.FolderRenamed, "folder change should be marked FolderRenamed")
			}
			if c.Path == "my-folder/dashboard.json" {
				dashCount++
			}
		}
		require.Equal(t, 1, folderCount, "folder update should be added")
		require.Equal(t, 1, dashCount, "dashboard should appear only once, not duplicated")
	})

	t.Run("only emits direct children not grandchildren for deleted metadata", func(t *testing.T) {
		repo := repository.NewMockReader(t)

		source := []repository.FileTreeEntry{
			{Path: "parent/", Blob: false},
			{Path: "parent/child/", Blob: false},
			{Path: "parent/child/_folder.json", Hash: "child-meta", Blob: true}, // child still has metadata
			{Path: "parent/child/gc.json", Hash: "ghi", Blob: true},
			// No _folder.json in parent/ — metadata was deleted
		}

		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "parent/", Hash: "old-hash", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "parent-uid"},
				{Path: "parent/child/", Hash: "child-meta", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "child-uid"},
				{Path: "parent/child/gc.json", Hash: "ghi", Resource: "dashboards", Group: "dashboard.grafana.app", Name: "gc-1"},
			},
		}

		changes := []ResourceFileChange{}

		result, _, err := augmentChangesForFolderMetadata(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		paths := make(map[string]bool)
		for _, c := range result {
			paths[c.Path] = true
		}
		require.True(t, paths["parent/"], "parent folder update should be present")
		require.True(t, paths["parent/child/"], "direct child folder should be emitted")
		require.False(t, paths["parent/child/gc.json"], "grandchild should NOT be emitted")
	})
}

func TestDetectRenames(t *testing.T) {
	t.Run("matching hash collapses delete+create into rename", func(t *testing.T) {
		existing := &provisioning.ResourceListItem{
			Path: "old-path/dashboard.json", Name: "my-dashboard",
			Group: "dashboard.grafana.app", Resource: "dashboards", Hash: "abc123",
		}
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-path/dashboard.json", Existing: existing},
			{Action: repository.FileActionCreated, Path: "new-path/dashboard.json", Hash: "abc123"},
		}

		result := DetectRenames(changes)

		require.Len(t, result, 1)
		require.Equal(t, repository.FileActionRenamed, result[0].Action)
		require.Equal(t, "new-path/dashboard.json", result[0].Path)
		require.Equal(t, existing, result[0].Existing)
	})

	t.Run("different hash keeps separate delete and create", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old.json", Existing: &provisioning.ResourceListItem{
				Hash: "aaa",
			}},
			{Action: repository.FileActionCreated, Path: "new.json", Hash: "bbb"},
		}

		result := DetectRenames(changes)

		require.Len(t, result, 2)
		require.Equal(t, repository.FileActionDeleted, result[0].Action)
		require.Equal(t, repository.FileActionCreated, result[1].Action)
	})

	t.Run("no deletions returns changes unchanged", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionCreated, Path: "a.json", Hash: "abc"},
			{Action: repository.FileActionUpdated, Path: "b.json"},
		}

		result := DetectRenames(changes)
		require.Equal(t, changes, result)
	})

	t.Run("no creations returns changes unchanged", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "a.json", Existing: &provisioning.ResourceListItem{Hash: "abc"}},
		}

		result := DetectRenames(changes)
		require.Equal(t, changes, result)
	})

	t.Run("empty hash on deletion is skipped", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old.json", Existing: &provisioning.ResourceListItem{Hash: ""}},
			{Action: repository.FileActionCreated, Path: "new.json", Hash: "abc"},
		}

		result := DetectRenames(changes)
		require.Len(t, result, 2)
	})

	t.Run("empty hash on creation is skipped", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old.json", Existing: &provisioning.ResourceListItem{Hash: "abc"}},
			{Action: repository.FileActionCreated, Path: "new.json", Hash: ""},
		}

		result := DetectRenames(changes)
		require.Len(t, result, 2)
	})

	t.Run("multiple rename pairs in one batch", func(t *testing.T) {
		existingA := &provisioning.ResourceListItem{Path: "old-a/d1.json", Hash: "hash-1"}
		existingB := &provisioning.ResourceListItem{Path: "old-b/d2.json", Hash: "hash-2"}
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-a/d1.json", Existing: existingA},
			{Action: repository.FileActionDeleted, Path: "old-b/d2.json", Existing: existingB},
			{Action: repository.FileActionCreated, Path: "new-a/d1.json", Hash: "hash-1"},
			{Action: repository.FileActionCreated, Path: "new-b/d2.json", Hash: "hash-2"},
		}

		result := DetectRenames(changes)

		require.Len(t, result, 2)
		for _, c := range result {
			require.Equal(t, repository.FileActionRenamed, c.Action, "path %s should be renamed", c.Path)
			require.NotNil(t, c.Existing)
		}
	})

	t.Run("mixed renames and genuine deletes/creates", func(t *testing.T) {
		movedExisting := &provisioning.ResourceListItem{Path: "original/dashboard.json", Hash: "same-hash"}
		deletedExisting := &provisioning.ResourceListItem{Path: "gone.json", Hash: "other-hash"}

		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "original/dashboard.json", Existing: movedExisting},
			{Action: repository.FileActionDeleted, Path: "gone.json", Existing: deletedExisting},
			{Action: repository.FileActionCreated, Path: "moved/dashboard.json", Hash: "same-hash"},
			{Action: repository.FileActionCreated, Path: "brand-new.json", Hash: "brand-new-hash"},
			{Action: repository.FileActionUpdated, Path: "unchanged/other.json"},
		}

		result := DetectRenames(changes)

		require.Len(t, result, 4, "one deletion removed, one rename converted")

		actionsByPath := make(map[string]repository.FileAction)
		for _, c := range result {
			actionsByPath[c.Path] = c.Action
		}

		require.Equal(t, repository.FileActionRenamed, actionsByPath["moved/dashboard.json"])
		require.Equal(t, repository.FileActionDeleted, actionsByPath["gone.json"])
		require.Equal(t, repository.FileActionCreated, actionsByPath["brand-new.json"])
		require.Equal(t, repository.FileActionUpdated, actionsByPath["unchanged/other.json"])
	})

	t.Run("folder deletions are not matched", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "old-folder/", Existing: &provisioning.ResourceListItem{
				Path: "old-folder/", Hash: "folder-hash",
			}},
			{Action: repository.FileActionCreated, Path: "new-folder/", Hash: "folder-hash"},
		}

		result := DetectRenames(changes)
		require.Len(t, result, 2)
		require.Equal(t, repository.FileActionDeleted, result[0].Action)
		require.Equal(t, repository.FileActionCreated, result[1].Action)
	})

	t.Run("duplicate hashes across deletions are not matched", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "a.json", Existing: &provisioning.ResourceListItem{Hash: "same"}},
			{Action: repository.FileActionDeleted, Path: "b.json", Existing: &provisioning.ResourceListItem{Hash: "same"}},
			{Action: repository.FileActionCreated, Path: "c.json", Hash: "same"},
		}

		result := DetectRenames(changes)
		require.Len(t, result, 3, "ambiguous hash should not be matched")
		require.Equal(t, repository.FileActionDeleted, result[0].Action)
		require.Equal(t, repository.FileActionDeleted, result[1].Action)
		require.Equal(t, repository.FileActionCreated, result[2].Action)
	})

	t.Run("orphan cleanup deletions are excluded from rename detection", func(t *testing.T) {
		changes := []ResourceFileChange{
			{Action: repository.FileActionDeleted, Path: "dashboard.json",
				Existing:      &provisioning.ResourceListItem{Hash: "abc123"},
				OrphanCleanup: true},
			{Action: repository.FileActionCreated, Path: "new-location/dashboard.json", Hash: "abc123"},
		}

		result := DetectRenames(changes)
		require.Len(t, result, 2, "orphan delete should not be consumed as rename")
		require.Equal(t, repository.FileActionDeleted, result[0].Action)
		require.True(t, result[0].OrphanCleanup)
		require.Equal(t, repository.FileActionCreated, result[1].Action)
	})
}
