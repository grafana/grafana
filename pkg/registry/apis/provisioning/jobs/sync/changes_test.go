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
		}, changes[0])
		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "other/",
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
			},
			{
				Action: repository.FileActionCreated,
				Path:   "abc/dash.json",
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
		}, changes[0])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder1/",
		}, changes[1])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder2/",
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
		}, changes[0])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder1/",
		}, changes[1])

		require.Equal(t, ResourceFileChange{
			Action: repository.FileActionCreated,
			Path:   "folder2/",
		}, changes[2])
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

			changes, missing, err := Compare(context.Background(), repo, repoResources, "current-ref", true)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
				require.Nil(t, changes)
				require.Nil(t, missing)
			} else {
				require.NoError(t, err, tt.description)
				require.Equal(t, tt.expectedChanges, changes, tt.description)
				require.Equal(t, tt.expectedMissing, missing, tt.description)
			}
		})
	}
}

func TestCompare_FolderMetadataFlagDisabled(t *testing.T) {
	t.Run("augmentChangesForUIDChanges skipped when flag off", func(t *testing.T) {
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

		changes, _, err := Compare(context.Background(), repo, repoResources, "ref", false)
		require.NoError(t, err)

		// No folder update should be emitted — the metadata processing is skipped.
		for _, c := range changes {
			if c.Path == "my-folder/" && c.Action == repository.FileActionUpdated {
				t.Fatal("folder update should not be emitted when flag is off")
			}
		}
	})
}

func TestAugmentChangesForUIDChanges(t *testing.T) {
	t.Run("emits children for UID change", func(t *testing.T) {
		repo := repository.NewMockReader(t)
		// ReadFolderMetadata reads "my-folder/_folder.json" and returns a new UID
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

		result, err := augmentChangesForUIDChanges(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		// Should contain: the original folder update + dashboard + child folder
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
		// ReadFolderMetadata returns the same UID as existing
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

		result, err := augmentChangesForUIDChanges(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Len(t, result, 1, "only the original folder update — no children emitted")
		require.Equal(t, "my-folder/", result[0].Path)
	})

	t.Run("only emits direct children, not grandchildren", func(t *testing.T) {
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
				{Path: "parent/child/", Hash: "def", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group, Name: "child-uid"},
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

		result, err := augmentChangesForUIDChanges(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		paths := make(map[string]bool)
		for _, c := range result {
			paths[c.Path] = true
		}
		require.True(t, paths["parent/"], "folder update present")
		require.True(t, paths["parent/child/"], "direct child folder emitted")
		require.False(t, paths["parent/child/grandchild.json"], "grandchild should NOT be emitted")
	})

	t.Run("does not duplicate already-existing changes", func(t *testing.T) {
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

		result, err := augmentChangesForUIDChanges(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)

		// Count dashboard entries — should be exactly 1 (no duplicate)
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

		result, err := augmentChangesForUIDChanges(context.Background(), repo, "main", source, target, changes)
		require.NoError(t, err)
		require.Equal(t, changes, result, "should return changes unchanged")
	})
}
