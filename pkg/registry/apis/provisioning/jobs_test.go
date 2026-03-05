package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// readOnlyRepo implements only repository.Repository (not ReaderWriter)
type readOnlyRepo struct {
	cfg *provisioning.Repository
}

func (r *readOnlyRepo) Config() *provisioning.Repository {
	return r.cfg
}

func (r *readOnlyRepo) Test(_ context.Context) (*provisioning.TestResults, error) {
	return nil, nil
}

func newTestRepo(name, namespace string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: provisioning.RepositorySpec{
			Sync: provisioning.SyncOptions{
				Target: provisioning.SyncTargetTypeFolder,
			},
		},
	}
}

func TestAuthorizeJobTargets(t *testing.T) {
	ctx := context.Background()
	cfg := newTestRepo("my-repo", "default")

	t.Run("delete with paths - authorized", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard.json"},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("delete with paths - unauthorized", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).
			Return(apierrors.NewForbidden(schema.GroupResource{}, "", nil))

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard.json"},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("delete directory path - checks folder permission", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)

		folderUID := resources.ParseFolder("team-a/", cfg.Name).ID
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == resources.FolderResource.Group &&
				req.Resource == resources.FolderResource.Resource &&
				req.Name == folderUID &&
				req.Verb == utils.VerbDelete
		}), folderUID).Return(nil)

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/"},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("delete file path - checks dashboard permission in folder", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)

		folderUID := resources.ParentFolder("team-a/dashboard.json", cfg)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == resources.DashboardResource.Group &&
				req.Resource == resources.DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), folderUID).Return(nil)

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard.json"},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("delete deduplicates folder checks", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)

		folderUID := resources.ParentFolder("team-a/dash1.json", cfg)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, folderUID).Return(nil).Once()

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dash1.json", "team-a/dash2.json"},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("delete with resource refs - authorized", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.EXPECT().FindResourcePath(mock.Anything, "dash-uid", mock.Anything).
			Return("team-a/dashboard.json", nil)

		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockFactory.EXPECT().Client(mock.Anything, mock.Anything).Return(mockRepoResources, nil)

		mockRepo := repository.NewMockReaderWriter(t)

		c := &jobsConnector{
			access:           accessMock,
			resourcesFactory: mockFactory,
		}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{Name: "dash-uid", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("delete with resource refs - unauthorized", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).
			Return(apierrors.NewForbidden(schema.GroupResource{}, "", nil))

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.EXPECT().FindResourcePath(mock.Anything, "dash-uid", mock.Anything).
			Return("team-a/dashboard.json", nil)

		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockFactory.EXPECT().Client(mock.Anything, mock.Anything).Return(mockRepoResources, nil)

		mockRepo := repository.NewMockReaderWriter(t)

		c := &jobsConnector{
			access:           accessMock,
			resourcesFactory: mockFactory,
		}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{Name: "dash-uid", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("move job - checks source delete and target create", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)

		sourceFolderUID := resources.ParseFolder("team-a/", cfg.Name).ID
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbDelete && req.Name == sourceFolderUID
		}), sourceFolderUID).Return(nil)

		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), mock.Anything).Return(nil)

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionMove,
			Repository: "my-repo",
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"team-a/"},
				TargetPath: "team-b/",
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("move job - unauthorized on target folder", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)

		sourceFolderUID := resources.ParseFolder("team-a/", cfg.Name).ID
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbDelete
		}), sourceFolderUID).Return(nil)

		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), mock.Anything).Return(apierrors.NewForbidden(schema.GroupResource{}, "", nil))

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionMove,
			Repository: "my-repo",
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"team-a/"},
				TargetPath: "team-b/",
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("no targets - no error", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete:     &provisioning.DeleteJobOptions{},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("nil options - no error", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("non-delete/move action - skipped", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPull,
			Repository: "my-repo",
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("resource refs with non-readwriter repo returns error", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		roRepo := &readOnlyRepo{cfg: cfg}
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{Name: "dash-uid", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				},
			},
		}

		err := c.authorizeJobTargets(ctx, roRepo, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("multiple paths across different folders - checks each folder", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)

		folderA := resources.ParentFolder("team-a/dash.json", cfg)
		folderB := resources.ParentFolder("team-b/dash.json", cfg)

		accessMock.EXPECT().Check(mock.Anything, mock.Anything, folderA).Return(nil).Once()
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, folderB).Return(nil).Once()

		mockRepo := repository.NewMockRepository(t)
		c := &jobsConnector{access: accessMock}

		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionDelete,
			Repository: "my-repo",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dash.json", "team-b/dash.json"},
			},
		}

		err := c.authorizeJobTargets(ctx, mockRepo, cfg, spec)
		require.NoError(t, err)
	})
}

func TestFolderUIDForPath(t *testing.T) {
	cfg := newTestRepo("my-repo", "default")

	t.Run("directory path returns folder ID", func(t *testing.T) {
		uid := folderUIDForPath(cfg, "team-a/")
		expected := resources.ParseFolder("team-a/", cfg.Name).ID
		assert.Equal(t, expected, uid)
	})

	t.Run("file path returns parent folder ID", func(t *testing.T) {
		uid := folderUIDForPath(cfg, "team-a/dashboard.json")
		expected := resources.ParentFolder("team-a/dashboard.json", cfg)
		assert.Equal(t, expected, uid)
	})

	t.Run("root file returns root folder", func(t *testing.T) {
		uid := folderUIDForPath(cfg, "dashboard.json")
		expected := resources.RootFolder(cfg)
		assert.Equal(t, expected, uid)
	})
}

func TestGvkToResource(t *testing.T) {
	assert.Equal(t, "dashboards", gvkToResource(schema.GroupVersionKind{Kind: "Dashboard"}))
	assert.Equal(t, "folders", gvkToResource(schema.GroupVersionKind{Kind: "Folder"}))
}
