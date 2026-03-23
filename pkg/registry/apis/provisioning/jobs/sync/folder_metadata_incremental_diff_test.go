package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestFolderMetadataIncrementalDiffBuilder_BuildIncrementalDiff(t *testing.T) {
	t.Run("returns unchanged diff when no folder metadata changes exist", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "dashboards/test.json", Ref: "new-ref"},
			{Action: repository.FileActionDeleted, Path: "dashboards/old.json", PreviousRef: "old-ref"},
		}

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Equal(t, diff, filteredDiff)
		require.Empty(t, replacedFolders)
		repoResources.AssertNotCalled(t, "List", mock.Anything)
	})

	t.Run("returns an error when listing managed resources fails", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(nil, fmt.Errorf("list failed")).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.Error(t, err)
		require.Nil(t, filteredDiff)
		require.Nil(t, replacedFolders)
		require.Contains(t, err.Error(), "list managed resources: list failed")
	})

	t.Run("creates folder replay and direct child updates for metadata creation on existing folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		})
	})

	t.Run("metadata updates with unchanged uid do not mark the folder as replaced", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Empty(t, replacedFolders)
	})

	t.Run("metadata updates with changed uid mark the folder as replaced", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "new-stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "old-stable-uid",
		}}, replacedFolders)
	})

	t.Run("does not duplicate synthetic child updates when the real diff already contains them", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		}}, replacedFolders)
	})

	t.Run("skips synthetic update for renamed direct child old path", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "myfolder/dashboard-renamed.json", PreviousPath: "myfolder/dashboard.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action:       repository.FileActionRenamed,
			Path:         "myfolder/dashboard-renamed.json",
			PreviousPath: "myfolder/dashboard.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		})
		require.NotContains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		})
	})

	t.Run("only emits direct children and not grandchildren for metadata creation", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "parent/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/child/",
				},
				{
					Name:     "grandchild-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/child/dash.json",
				},
				{
					Name:     "sibling-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "parent/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/dashboard.json",
			Ref:    "new-ref",
		})
		require.NotContains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/dash.json",
			Ref:    "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{
			Path:   "parent/",
			OldUID: "hash-uid",
		})
	})

	t.Run("creates folder update replay when metadata is added for a brand-new folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("metadata deletion while folder remains emits folder update, direct child updates, and replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "stable-uid",
		}}, replacedFolders)
	})

	t.Run("metadata deletion while folder directory is gone only schedules replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
			},
		}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Empty(t, filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "stable-uid",
		}}, replacedFolders)
	})

	t.Run("metadata deletion with unchanged fallback uid only emits folder update", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		hashUID := resources.ParseFolder("myfolder/", repo.Config().Name).ID
		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     hashUID,
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("leaves unsupported metadata rename actions in diff", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "renamed/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Equal(t, diff, filteredDiff)
		require.Empty(t, replacedFolders)
	})
	t.Run("nested metadata changes are both expanded deterministically", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		repoResources := resources.NewMockRepositoryResources(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "parent/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionCreated, Path: "parent/child/_folder.json", Ref: "new-ref"},
		}

		repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "parent-hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/",
				},
				{
					Name:     "child-hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/child/",
				},
				{
					Name:     "parent-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/dashboard.json",
				},
				{
					Name:     "child-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/child/dashboard.json",
				},
			},
		}, nil).Once()
		expectFolderMetadataRead(repo, "parent/child/", "new-ref", "child-stable-uid")
		expectFolderMetadataRead(repo, "parent/", "new-ref", "parent-stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo, repoResources)
		filteredDiff, replacedFolders, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff)

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/dashboard.json",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/dashboard.json",
			Ref:    "new-ref",
		})
		childFolderReplayCount := 0
		for _, change := range filteredDiff {
			if change.Action == repository.FileActionUpdated && change.Path == "parent/child/" && change.Ref == "new-ref" {
				childFolderReplayCount++
			}
		}
		require.Equal(t, 1, childFolderReplayCount)
		require.Equal(t, []replacedFolder{
			{Path: "parent/child/", OldUID: "child-hash-uid"},
			{Path: "parent/", OldUID: "parent-hash-uid"},
		}, replacedFolders)
	})
}

func expectFolderMetadataRead(repo *compositeRepo, folderPath, ref, uid string) {
	repo.MockReader.On("Read", mock.Anything, folderPath+"_folder.json", ref).Return(&repository.FileInfo{
		Data: []byte(fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":"Title"}}`, uid)),
	}, nil).Once()
}
