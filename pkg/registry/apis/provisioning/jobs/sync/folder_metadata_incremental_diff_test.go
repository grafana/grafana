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
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "dashboards/test.json", Ref: "new-ref"},
			{Action: repository.FileActionDeleted, Path: "dashboards/old.json", PreviousRef: "old-ref"},
		}

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, diff, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("creates folder replay and direct child updates for metadata creation on existing folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}
		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
			Reason: provisioning.ReasonFolderMetadataCreated,
		})
	})

	t.Run("metadata updates with unchanged uid do not mark the folder as replaced", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "new-stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
			Reason: provisioning.ReasonFolderMetadataUpdated,
		}}, replacedFolders)
	})

	t.Run("invalid metadata update on existing folder keeps replay without replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
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
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref",
		})
		require.Empty(t, replacedFolders)
		require.Len(t, invalidFolderMetadata, 1)
		require.ErrorIs(t, invalidFolderMetadata[0], resources.ErrInvalidFolderMetadata)
	})

	t.Run("invalid metadata creation on new folder still emits folder replay", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
		require.Len(t, invalidFolderMetadata, 1)
		require.ErrorIs(t, invalidFolderMetadata[0], resources.ErrInvalidFolderMetadata)
	})

	t.Run("does not duplicate synthetic child updates when the real diff already contains them", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "hash-uid",
			Reason: provisioning.ReasonFolderMetadataCreated,
		}}, replacedFolders)
	})

	t.Run("skips synthetic update for renamed direct child old path", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "myfolder/dashboard-renamed.json", PreviousPath: "myfolder/dashboard.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
			Reason: provisioning.ReasonFolderMetadataCreated,
		})
	})

	t.Run("only emits direct children and not grandchildren for metadata creation", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "parent/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "parent/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
			Reason: provisioning.ReasonFolderMetadataCreated,
		})
	})

	t.Run("creates folder update replay when metadata is added for a brand-new folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "new-folder-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("metadata deletion while folder remains emits folder update, direct child updates, and replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
			Reason: provisioning.ReasonFolderMetadataDeleted,
		}}, replacedFolders)
	})

	t.Run("metadata deletion while folder directory is gone only schedules replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
			},
		})

		require.NoError(t, err)
		require.Empty(t, filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "stable-uid",
			Reason: provisioning.ReasonFolderMetadataDeleted,
		}}, replacedFolders)
	})

	t.Run("metadata deletion with unchanged fallback uid only emits folder update", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		hashUID := resources.ParseFolder("myfolder/", repo.Config().Name).ID
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("renamed metadata file with no existing resources emits folder update for new path", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "renamed/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "renamed/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "renamed/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
		require.Empty(t, invalidFolderMetadata)
	})

	t.Run("renamed metadata file tracks old folder for orphan cleanup when old directory is gone", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
			},
		}
		repo.MockReader.On("Read", mock.Anything, "old/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()
		expectFolderMetadataRead(repo, "new/", "new-ref", "new-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "new/",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{
			Path:   "old/",
			OldUID: "old-uid",
			Reason: provisioning.ReasonFolderMetadataDeleted,
		}}, replacedFolders)
	})

	t.Run("renamed metadata file re-parents children and tracks replacement when old directory still exists", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "old/dashboard.json",
				},
			},
		}
		repo.MockReader.On("Read", mock.Anything, "old/", "new-ref").
			Return(&repository.FileInfo{Path: "old/"}, nil).Once()
		expectFolderMetadataRead(repo, "new/", "new-ref", "new-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "new/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "old/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "old/dashboard.json",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{
			Path:   "old/",
			OldUID: "old-uid",
			Reason: provisioning.ReasonFolderMetadataDeleted,
		}}, replacedFolders)
	})

	t.Run("renamed metadata file skips old path cleanup when directory rename already in diff", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/", PreviousPath: "old/", PreviousRef: "old-ref", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
			},
		}
		expectFolderMetadataRead(repo, "new/", "new-ref", "new-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Empty(t, replacedFolders)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action:       repository.FileActionRenamed,
			Path:         "new/",
			PreviousPath: "old/",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		})
		require.NotContains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "old/",
			Ref:    "new-ref",
		})
	})
	t.Run("nested metadata renames do not emit spurious updates for old child paths", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "new/child/_folder.json", PreviousPath: "old/child/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "parent-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
				{
					Name:     "child-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/child/",
				},
			},
		}
		repo.MockReader.On("Read", mock.Anything, "old/child/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()
		repo.MockReader.On("Read", mock.Anything, "old/", "new-ref").
			Return(&repository.FileInfo{Path: "old/"}, nil).Once()
		expectFolderMetadataRead(repo, "new/child/", "new-ref", "new-child-uid")
		expectFolderMetadataRead(repo, "new/", "new-ref", "new-parent-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "new/", Ref: "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "new/child/", Ref: "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "old/", Ref: "new-ref",
		})
		require.NotContains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "old/child/", Ref: "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{Path: "old/", OldUID: "parent-uid", Reason: provisioning.ReasonFolderMetadataDeleted})
		require.Contains(t, replacedFolders, replacedFolder{Path: "old/child/", OldUID: "child-uid", Reason: provisioning.ReasonFolderMetadataDeleted})
	})

	t.Run("rename from non-metadata file to _folder.json only emits create at new path", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "team/_folder.json", PreviousPath: "team/config.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "team-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "team/",
				},
			},
		}
		expectFolderMetadataRead(repo, "team/", "new-ref", "team-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "team/", Ref: "new-ref",
		})
		require.Empty(t, replacedFolders, "non-metadata previous path should not schedule any cleanup")
	})

	t.Run("identity-preserving rename does not schedule old UID for deletion", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
			},
		}
		repo.MockReader.On("Read", mock.Anything, "old/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()
		expectFolderMetadataRead(repo, "new/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, relocations, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "new/", Ref: "new-ref",
		})
		require.Equal(t, map[string][]string{"new/": {"stable-uid"}}, relocations,
			"relocations maps the target path to the UID moving there for call-scoped conflict bypass")
		require.Empty(t, replacedFolders, "same UID at old and new path means folder is moved, not replaced")
	})

	t.Run("UID theft while source is vacating does not bypass conflict check", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)

		// Real move: src/_folder.json → dst/_folder.json (same UID).
		// Theft: thief/_folder.json updated to claim the same UID.
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "dst/_folder.json", PreviousPath: "src/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "thief/_folder.json", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Name: "moving-uid", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: "src/"},
				{Name: "thief-old-uid", Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: "thief/"},
			},
		}

		// src/ directory is gone after the rename.
		repo.MockReader.On("Read", mock.Anything, "src/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()
		// dst/ gets the same UID as src/ had — real relocation.
		expectFolderMetadataRead(repo, "dst/", "new-ref", "moving-uid")
		// thief/ claims the same UID — theft.
		expectFolderMetadataRead(repo, "thief/", "new-ref", "moving-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		_, relocations, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Equal(t, map[string][]string{"dst/": {"moving-uid"}}, relocations,
			"only the real move target should have a relocation bypass")
		require.Contains(t, replacedFolders, replacedFolder{Path: "thief/", OldUID: "thief-old-uid", Reason: provisioning.ReasonFolderMetadataUpdated},
			"thief's old UID should still be scheduled for replacement")
	})

	t.Run("directory rename plus invalid renamed metadata only records a warning", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/", PreviousPath: "old/", PreviousRef: "old-ref", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "new/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
			},
		})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/", PreviousPath: "old/", PreviousRef: "old-ref", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
		require.Len(t, invalidFolderMetadata, 1)
		require.ErrorIs(t, invalidFolderMetadata[0], resources.ErrInvalidFolderMetadata)
		require.Equal(t, repository.FileActionRenamed, invalidFolderMetadata[0].Action)
	})

	t.Run("nested metadata changes are both expanded deterministically", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "parent/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionCreated, Path: "parent/child/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "parent/child/", "new-ref", "child-stable-uid", 1)
		expectFolderMetadataReadTimes(repo, "parent/", "new-ref", "parent-stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
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
		})

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
			{Path: "parent/child/", OldUID: "child-hash-uid", Reason: provisioning.ReasonFolderMetadataCreated},
			{Path: "parent/", OldUID: "parent-hash-uid", Reason: provisioning.ReasonFolderMetadataCreated},
		}, replacedFolders)
	})

	t.Run("metadata creation with multiple orphans at same path replaces all non-matching UIDs", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "orphan-uid-1",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "orphan-uid-2",
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
		}
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Len(t, replacedFolders, 2)
		require.Contains(t, replacedFolders, replacedFolder{Path: "myfolder/", OldUID: "orphan-uid-1", Reason: provisioning.ReasonFolderMetadataCreated})
		require.Contains(t, replacedFolders, replacedFolder{Path: "myfolder/", OldUID: "orphan-uid-2", Reason: provisioning.ReasonFolderMetadataCreated})
	})

	t.Run("metadata update with multiple orphans keeps the matching UID and replaces others", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "orphan-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
			},
		}
		expectFolderMetadataRead(repo, "myfolder/", "new-ref", "stable-uid")

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{Path: "myfolder/", OldUID: "orphan-uid", Reason: provisioning.ReasonFolderMetadataUpdated}}, replacedFolders)
	})

	t.Run("metadata deletion with multiple orphans when directory still exists replaces non-fallback UIDs", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "orphan-uid-1",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "orphan-uid-2",
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
		}
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").
			Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Len(t, replacedFolders, 2)
		require.Contains(t, replacedFolders, replacedFolder{Path: "myfolder/", OldUID: "orphan-uid-1", Reason: provisioning.ReasonFolderMetadataDeleted})
		require.Contains(t, replacedFolders, replacedFolder{Path: "myfolder/", OldUID: "orphan-uid-2", Reason: provisioning.ReasonFolderMetadataDeleted})
	})

	t.Run("metadata deletion with multiple orphans when directory is gone replaces all", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "orphan-uid-1",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "orphan-uid-2",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
			},
		}
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Empty(t, filteredDiff)
		require.Len(t, replacedFolders, 2)
		require.Contains(t, replacedFolders, replacedFolder{Path: "myfolder/", OldUID: "orphan-uid-1", Reason: provisioning.ReasonFolderMetadataDeleted})
		require.Contains(t, replacedFolders, replacedFolder{Path: "myfolder/", OldUID: "orphan-uid-2", Reason: provisioning.ReasonFolderMetadataDeleted})
	})

	t.Run("metadata deletion with mix of fallback-matching and orphaned UIDs only replaces orphans", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		hashUID := resources.ParseFolder("myfolder/", repo.Config().Name).ID
		resourcesList := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     hashUID,
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "orphan-uid",
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
		}
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").
			Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, resourcesList)

		require.NoError(t, err)
		require.Empty(t, invalidFolderMetadata)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{Path: "myfolder/", OldUID: "orphan-uid", Reason: provisioning.ReasonFolderMetadataDeleted}}, replacedFolders)
	})

	t.Run("file-only invalid renamed metadata emits warning and old-path cleanup", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "new/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "new/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()
		repo.MockReader.On("Read", mock.Anything, "old/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, _, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "old/",
				},
			},
		})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "new/", Ref: "new-ref"},
		}, filteredDiff)
		require.Equal(t, []replacedFolder{{Path: "old/", OldUID: "old-uid", Reason: provisioning.ReasonFolderMetadataDeleted}}, replacedFolders)
		require.Len(t, invalidFolderMetadata, 1)
		require.ErrorIs(t, invalidFolderMetadata[0], resources.ErrInvalidFolderMetadata)
		require.Equal(t, repository.FileActionRenamed, invalidFolderMetadata[0].Action)
	})
}

func expectFolderMetadataReadTimes(repo *compositeRepo, folderPath, ref, uid string, times int) {
	repo.MockReader.On("Read", mock.Anything, folderPath+"_folder.json", ref).Return(&repository.FileInfo{
		Data: []byte(fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":"Title"}}`, uid)),
	}, nil).Times(times)
}

func expectFolderMetadataRead(repo *compositeRepo, folderPath, ref, uid string) {
	expectFolderMetadataReadTimes(repo, folderPath, ref, uid, 1)
}

func TestIsFolderRelocating(t *testing.T) {
	folder := func(name, path string) provisioning.ResourceListItem {
		return provisioning.ResourceListItem{
			Name: name, Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Path: path,
		}
	}
	dash := func(name, path string) provisioning.ResourceListItem {
		return provisioning.ResourceListItem{
			Name: name, Group: "dashboards", Resource: "dashboards", Path: path,
		}
	}

	tests := []struct {
		name       string
		items      []provisioning.ResourceListItem
		diff       []repository.VersionedFileChange
		activeUIDs map[string]struct{}
		queryName  string
		queryPath  string
		want       bool
	}{
		{
			name:      "simple move: metadata rename vacates source",
			items:     []provisioning.ResourceListItem{folder("uid-a", "src")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionRenamed, Path: "dst/_folder.json", PreviousPath: "src/_folder.json"}},
			queryName: "uid-a", queryPath: "dst/",
			want: true,
		},
		{
			name:  "simple move: directory rename vacates source",
			items: []provisioning.ResourceListItem{folder("uid-a", "src")},
			diff: []repository.VersionedFileChange{
				{Action: repository.FileActionRenamed, Path: "dst/", PreviousPath: "src/"},
				{Action: repository.FileActionUpdated, Path: "dst/_folder.json"},
			},
			queryName: "uid-a", queryPath: "dst/",
			want: true,
		},
		{
			name:      "title-only update: same name same path, no move",
			items:     []provisioning.ResourceListItem{folder("uid-a", "folder")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionUpdated, Path: "folder/_folder.json"}},
			queryName: "uid-a", queryPath: "folder/",
			want: false,
		},
		{
			name:      "UID change to unused name: new name not in index",
			items:     []provisioning.ResourceListItem{folder("old-uid", "folder")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionUpdated, Path: "folder/_folder.json"}},
			queryName: "new-uid", queryPath: "folder/",
			want: false,
		},
		{
			name:      "UID theft: claim existing name, owner untouched",
			items:     []provisioning.ResourceListItem{folder("victim-uid", "owner"), folder("thief-uid", "thief")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionUpdated, Path: "thief/_folder.json"}},
			queryName: "victim-uid", queryPath: "thief/",
			want: false,
		},
		{
			name:  "UID theft: owner metadata updated in-place in same diff",
			items: []provisioning.ResourceListItem{folder("victim-uid", "owner"), folder("thief-uid", "thief")},
			diff: []repository.VersionedFileChange{
				{Action: repository.FileActionUpdated, Path: "owner/_folder.json"},
				{Action: repository.FileActionUpdated, Path: "thief/_folder.json"},
			},
			queryName: "victim-uid", queryPath: "thief/",
			want: false,
		},
		{
			name:  "UID theft: owner metadata created in same diff",
			items: []provisioning.ResourceListItem{folder("victim-uid", "owner"), folder("thief-uid", "thief")},
			diff: []repository.VersionedFileChange{
				{Action: repository.FileActionCreated, Path: "owner/_folder.json"},
				{Action: repository.FileActionCreated, Path: "thief/_folder.json"},
			},
			queryName: "victim-uid", queryPath: "thief/",
			want: false,
		},
		{
			name:  "legitimate move: owner metadata deleted in same diff",
			items: []provisioning.ResourceListItem{folder("uid-a", "old"), folder("other-uid", "new")},
			diff: []repository.VersionedFileChange{
				{Action: repository.FileActionDeleted, Path: "old/_folder.json"},
				{Action: repository.FileActionUpdated, Path: "new/_folder.json"},
			},
			queryName: "uid-a", queryPath: "new/",
			want: true,
		},
		{
			name:       "UID theft while owner is moving: already-claimed UID blocks thief",
			items:      []provisioning.ResourceListItem{folder("victim-uid", "owner"), folder("thief-uid", "thief")},
			diff:       []repository.VersionedFileChange{{Action: repository.FileActionUpdated, Path: "thief/_folder.json"}},
			activeUIDs: map[string]struct{}{"victim-uid": {}},
			queryName:  "victim-uid", queryPath: "thief/",
			want: false,
		},
		{
			name:      "move + change UID to unused name: new name not in index",
			items:     []provisioning.ResourceListItem{folder("old-uid", "src")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionRenamed, Path: "dst/_folder.json", PreviousPath: "src/_folder.json"}},
			queryName: "brand-new-uid", queryPath: "dst/",
			want: false,
		},
		{
			name:      "move + steal name, victim untouched: source not vacating",
			items:     []provisioning.ResourceListItem{folder("victim-uid", "victim"), folder("mover-uid", "src")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionRenamed, Path: "dst/_folder.json", PreviousPath: "src/_folder.json"}},
			queryName: "victim-uid", queryPath: "dst/",
			want: false,
		},
		{
			name:      "name matches a non-folder resource: ignored",
			items:     []provisioning.ResourceListItem{dash("shared-name", "path-a/dash.json")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionCreated, Path: "other/_folder.json"}},
			queryName: "shared-name", queryPath: "other/",
			want: false,
		},
		{
			name:      "name does not exist in index",
			items:     []provisioning.ResourceListItem{folder("uid-a", "src")},
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionCreated, Path: "new/_folder.json"}},
			queryName: "unknown", queryPath: "new/",
			want: false,
		},
		{
			name:      "empty index",
			items:     nil,
			diff:      []repository.VersionedFileChange{{Action: repository.FileActionUpdated, Path: "folder/_folder.json"}},
			queryName: "uid-a", queryPath: "folder/",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var list *provisioning.ResourceList
			if tt.items != nil {
				list = &provisioning.ResourceList{Items: tt.items}
			}
			index := newManagedResourceIndex(list)
			input := splitMetadataChanges(tt.diff)
			activeUIDs := tt.activeUIDs
			if activeUIDs == nil {
				activeUIDs = make(map[string]struct{})
			}
			got := isFolderRelocating(index, input, activeUIDs, tt.queryName, tt.queryPath)
			require.Equal(t, tt.want, got)
		})
	}
}
