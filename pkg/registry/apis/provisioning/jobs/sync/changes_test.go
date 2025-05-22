package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
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

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("create a source file", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "muta.json", Hash: "xyz", Blob: true},
		}
		target := &provisioning.ResourceList{}

		changes, err := Changes(source, target)
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
		_, err := Changes(source, target)
		require.EqualError(t, err, "empty path on a non folder")
	})

	t.Run("empty path with folder resource", func(t *testing.T) {
		source := []repository.FileTreeEntry{}
		target := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Path: "", Resource: resources.FolderResource.Resource, Group: resources.FolderResource.Group},
			},
		}

		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Empty(t, changes)
	})

	t.Run("create empty folder structure for folders with unsupported file types", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: "one/two/first.md", Hash: "xyz", Blob: true},
			{Path: "other/second.md", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
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
		changes, err := Changes(source, target)
		require.NoError(t, err)
		require.Equal(t, expected, changes)
	})
	t.Run("hidden at the root", func(t *testing.T) {
		source := []repository.FileTreeEntry{
			{Path: ".hidden/dashboard.json", Hash: "xyz", Blob: true},
		}

		target := &provisioning.ResourceList{}
		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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

		changes, err := Changes(source, target)
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
}

func TestCompare(t *testing.T) {
	tests := []struct {
		name            string
		setupMocks      func(*repository.MockRepository, *resources.MockRepositoryResources)
		expectedError   string
		expectedChanges []ResourceFileChange
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

			changes, err := Compare(context.Background(), repo, repoResources, "current-ref")

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
				require.Nil(t, changes)
			} else {
				require.NoError(t, err, tt.description)
				require.Equal(t, tt.expectedChanges, changes, tt.description)
			}
		})
	}
}
