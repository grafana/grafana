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

func TestAuthorizeExportJob(t *testing.T) {
	ctx := context.Background()
	cfg := newTestRepo("my-repo", "default")

	t.Run("authorized - reads at root + create on target folder", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
			Push:       &provisioning.ExportJobOptions{},
		}

		err := c.authorizeExportJob(ctx, mockReader, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("unauthorized on dashboards read at root", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Resource == resources.FolderResource.Resource && req.Verb == utils.VerbGet
		}), "").Return(nil)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Resource == resources.DashboardResource.Resource && req.Verb == utils.VerbGet
		}), "").Return(apierrors.NewForbidden(schema.GroupResource{}, "", nil))

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
			Push:       &provisioning.ExportJobOptions{},
		}

		err := c.authorizeExportJob(ctx, mockReader, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("unauthorized on target folder create", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		rootFolder := resources.RootFolder(cfg)

		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbGet
		}), "").Return(nil)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), rootFolder).Return(apierrors.NewForbidden(schema.GroupResource{}, "", nil)).Once()

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
			Push:       &provisioning.ExportJobOptions{},
		}

		err := c.authorizeExportJob(ctx, mockReader, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("nil push options - no error", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
		}

		err := c.authorizeExportJob(ctx, mockReader, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("checks all supported resource types for read and create", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		rootFolder := resources.RootFolder(cfg)

		for _, kind := range resources.SupportedProvisioningResources {
			accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbGet
			}), "").Return(nil).Once()
		}
		for _, kind := range resources.SupportedProvisioningResources {
			accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbCreate
			}), rootFolder).Return(nil).Once()
		}

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
			Push:       &provisioning.ExportJobOptions{},
		}

		err := c.authorizeExportJob(ctx, mockReader, cfg, spec)
		require.NoError(t, err)
		accessMock.AssertExpectations(t)
	})

	t.Run("instance sync target checks create at root", func(t *testing.T) {
		instanceCfg := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-repo",
				Namespace: "default",
			},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{
					Target: provisioning.SyncTargetTypeInstance,
				},
			},
		}
		accessMock := auth.NewMockAccessChecker(t)
		for range resources.SupportedProvisioningResources {
			accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Verb == utils.VerbGet
			}), "").Return(nil).Once()
		}
		for range resources.SupportedProvisioningResources {
			accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Verb == utils.VerbCreate
			}), "").Return(nil).Once()
		}

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
			Push:       &provisioning.ExportJobOptions{},
		}

		err := c.authorizeExportJob(ctx, mockReader, instanceCfg, spec)
		require.NoError(t, err)
		accessMock.AssertExpectations(t)
	})

	t.Run("non-reader repo returns bad request", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockConfigRepository(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: "my-repo",
			Push:       &provisioning.ExportJobOptions{},
		}

		err := c.authorizeExportJob(ctx, mockRepo, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})
}
