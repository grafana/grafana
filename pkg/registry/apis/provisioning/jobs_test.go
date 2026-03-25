package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// testDashboardFileInfo returns a FileInfo containing a classic dashboard JSON
// that ParseFileResource recognises as a dashboard resource.
func testDashboardFileInfo() *repository.FileInfo {
	return &repository.FileInfo{
		Data: []byte(`{"uid":"test","schemaVersion":7,"panels":[],"tags":[]}`),
	}
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

func TestPullRequestJobRejected(t *testing.T) {
	cfg := newTestRepo("my-repo", "default")
	c := &jobsConnector{}

	t.Run("PullRequest action returns bad request", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
		}

		err := c.authorizeJob(context.Background(), nil, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
		assert.Contains(t, err.Error(), "pull request jobs cannot be created via the API")
	})

	t.Run("Pull action is not rejected", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		}

		err := c.authorizeJob(context.Background(), nil, cfg, spec)
		require.NoError(t, err)
	})
}

func TestFixFolderMetadataFeatureGate(t *testing.T) {
	cfg := newTestRepo("my-repo", "default")

	t.Run("rejected when flag is disabled", func(t *testing.T) {
		c := &jobsConnector{folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}

		err := c.authorizeJob(context.Background(), nil, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
		assert.Contains(t, err.Error(), "provisioningFolderMetadata feature flag")
	})

	t.Run("allowed when flag is enabled", func(t *testing.T) {
		c := &jobsConnector{folderMetadataEnabled: true}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}

		err := c.authorizeJob(context.Background(), nil, cfg, spec)
		require.NoError(t, err)
	})
}

func TestValidateWriteAccess_FixFolderMetadata(t *testing.T) {
	c := &jobsConnector{}

	t.Run("allowed with write workflow and no ref", func(t *testing.T) {
		cfg := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
		}
		spec := provisioning.JobSpec{
			Action:            provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
		}
		err := c.validateWriteAccess(cfg, spec)
		require.NoError(t, err)
	})

	t.Run("allowed with branch workflow and feature branch ref", func(t *testing.T) {
		cfg := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type:      provisioning.GitHubRepositoryType,
				Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				GitHub:    &provisioning.GitHubRepositoryConfig{Branch: "main"},
			},
		}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
				Ref: "add-folder-metadata",
			},
		}
		err := c.validateWriteAccess(cfg, spec)
		require.NoError(t, err)
	})

	t.Run("rejected with branch-only workflow and no ref", func(t *testing.T) {
		cfg := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type:      provisioning.GitHubRepositoryType,
				Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				GitHub:    &provisioning.GitHubRepositoryConfig{Branch: "main"},
			},
		}
		spec := provisioning.JobSpec{
			Action:            provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
		}
		err := c.validateWriteAccess(cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("rejected with no workflows", func(t *testing.T) {
		cfg := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{},
			},
		}
		spec := provisioning.JobSpec{
			Action:            provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
		}
		err := c.validateWriteAccess(cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("rejected with branch-only workflow and ref matching configured branch", func(t *testing.T) {
		cfg := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type:      provisioning.GitHubRepositoryType,
				Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				GitHub:    &provisioning.GitHubRepositoryConfig{Branch: "main"},
			},
		}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
				Ref: "main",
			},
		}
		err := c.validateWriteAccess(cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("nil options treated as empty ref", func(t *testing.T) {
		cfg := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			},
		}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionFixFolderMetadata,
		}
		err := c.validateWriteAccess(cfg, spec)
		require.NoError(t, err)
	})
}

func TestAuthorizeResourceJob(t *testing.T) {
	ctx := context.Background()
	cfg := newTestRepo("my-repo", "default")

	t.Run("export - authorized", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockReader, cfg, spec)
		require.NoError(t, err)
	})

	t.Run("migrate - authorized", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action:  provisioning.JobActionMigrate,
			Migrate: &provisioning.MigrateJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockReader, cfg, spec)
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
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockReader, cfg, spec)
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
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockReader, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})

	t.Run("nil options - no error", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPush,
		}

		err := c.authorizeResourceJob(ctx, mockReader, cfg, spec)
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
			Action:  provisioning.JobActionMigrate,
			Migrate: &provisioning.MigrateJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockReader, cfg, spec)
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
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockReader, instanceCfg, spec)
		require.NoError(t, err)
		accessMock.AssertExpectations(t)
	})

	t.Run("non-reader repo returns bad request", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockConfigRepository(t)

		c := &jobsConnector{access: accessMock, folderMetadataEnabled: false}
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		}

		err := c.authorizeResourceJob(ctx, mockRepo, cfg, spec)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})
}

func TestAuthorizeDeleteJob(t *testing.T) {
	ctx := context.Background()
	cfg := newTestRepo("my-repo", "default")
	dashGVR := resources.DashboardResource
	forbidden := apierrors.NewForbidden(schema.GroupResource{Group: "test", Resource: "test"}, "test", fmt.Errorf("forbidden"))

	t.Run("empty targets succeeds", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{})
		require.NoError(t, err)
	})

	t.Run("authorized file path", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == dashGVR.Group && req.Resource == dashGVR.Resource && req.Verb == utils.VerbDelete
		}), mock.AnythingOfType("string")).Return(nil)

		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(cfg).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "").Return(testDashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, repository.ErrFileNotFound).Maybe()
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{
			Paths: []string{"team-a/dashboard.json"},
		})
		require.NoError(t, err)
	})

	t.Run("unauthorized file path returns forbidden", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(forbidden)

		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(cfg).Maybe()
		mockReader.On("Read", mock.Anything, "restricted/dashboard.json", "").Return(testDashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, repository.ErrFileNotFound).Maybe()
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{
			Paths: []string{"restricted/dashboard.json"},
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "authorize delete")
	})

	t.Run("authorized directory path checks folder delete", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == resources.FolderResource.Group &&
				req.Resource == resources.FolderResource.Resource &&
				req.Verb == utils.VerbDelete
		}), mock.AnythingOfType("string")).Return(nil)

		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(cfg).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, repository.ErrFileNotFound).Maybe()
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{
			Paths: []string{"team-a/"},
		})
		require.NoError(t, err)
	})

	t.Run("authorized ResourceRef", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == dashGVR.Group && req.Resource == dashGVR.Resource && req.Verb == utils.VerbDelete
		}), "folder-abc").Return(nil)

		mockReader := repository.NewMockReader(t)
		clientsMock := resources.NewMockClientFactory(t)

		dynClient := &mockDynamic{}
		dynClient.On("Get", mock.Anything, "my-dash", metav1.GetOptions{}, []string(nil)).
			Return(makeUnstructured("my-dash", "folder-abc"), nil)

		clients := resources.NewMockResourceClients(t)
		clients.EXPECT().ForKind(mock.Anything, schema.GroupVersionKind{
			Group: "dashboard.grafana.app", Kind: "Dashboard",
		}).Return(dynClient, dashGVR, nil)
		clientsMock.EXPECT().Clients(mock.Anything, "default").Return(clients, nil)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: "my-dash", Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		})
		require.NoError(t, err)
	})

	t.Run("ResourceRef not found is skipped", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		clientsMock := resources.NewMockClientFactory(t)

		notFound := apierrors.NewNotFound(schema.GroupResource{}, "missing-dash")
		dynClient := &mockDynamic{}
		dynClient.On("Get", mock.Anything, "missing-dash", metav1.GetOptions{}, []string(nil)).Return(nil, notFound)

		clients := resources.NewMockResourceClients(t)
		clients.EXPECT().ForKind(mock.Anything, mock.Anything).Return(dynClient, dashGVR, nil)
		clientsMock.EXPECT().Clients(mock.Anything, "default").Return(clients, nil)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: "missing-dash", Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		})
		require.NoError(t, err)
	})

	t.Run("fails fast on first unauthorized path", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(forbidden).Once()

		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(cfg).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dash1.json", "").Return(testDashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, "team-b/dash2.json", "").Return(testDashboardFileInfo(), nil).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, repository.ErrFileNotFound).Maybe()
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockReader, cfg, &provisioning.DeleteJobOptions{
			Paths: []string{"team-a/dash1.json", "team-b/dash2.json"},
		})
		require.Error(t, err)
	})

	t.Run("non-reader repo returns bad request", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockConfigRepository(t)
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeDeleteJob(ctx, mockRepo, cfg, &provisioning.DeleteJobOptions{
			Paths: []string{"dashboard.json"},
		})
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})
}

func TestAuthorizeMoveJob(t *testing.T) {
	ctx := context.Background()
	cfg := newTestRepo("my-repo", "default")
	dashGVR := resources.DashboardResource
	forbidden := apierrors.NewForbidden(schema.GroupResource{Group: "test", Resource: "test"}, "test", fmt.Errorf("forbidden"))

	t.Run("empty targets succeeds", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeMoveJob(ctx, mockReader, cfg, &provisioning.MoveJobOptions{
			TargetPath: "dest/",
		})
		require.NoError(t, err)
	})

	t.Run("authorized file path", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), mock.AnythingOfType("string")).Return(nil).Once()
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), mock.AnythingOfType("string")).Return(nil).Once()

		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(cfg).Maybe()
		mockReader.On("Read", mock.Anything, "src/dashboard.json", "").Return(testDashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, repository.ErrFileNotFound).Maybe()
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeMoveJob(ctx, mockReader, cfg, &provisioning.MoveJobOptions{
			Paths:      []string{"src/dashboard.json"},
			TargetPath: "dest/",
		})
		require.NoError(t, err)
	})

	t.Run("unauthorized source returns error", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.Anything, mock.Anything).Return(forbidden).Once()

		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(cfg).Maybe()
		mockReader.On("Read", mock.Anything, "restricted/dashboard.json", "").Return(testDashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).Return(nil, repository.ErrFileNotFound).Maybe()
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeMoveJob(ctx, mockReader, cfg, &provisioning.MoveJobOptions{
			Paths:      []string{"restricted/dashboard.json"},
			TargetPath: "dest/",
		})
		require.Error(t, err)
		require.ErrorContains(t, err, "authorize move")
	})

	t.Run("authorized ResourceRef checks update", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == dashGVR.Group && req.Resource == dashGVR.Resource && req.Verb == utils.VerbUpdate
		}), "folder-abc").Return(nil)

		mockReader := repository.NewMockReader(t)
		clientsMock := resources.NewMockClientFactory(t)

		dynClient := &mockDynamic{}
		dynClient.On("Get", mock.Anything, "my-dash", metav1.GetOptions{}, []string(nil)).
			Return(makeUnstructured("my-dash", "folder-abc"), nil)

		clients := resources.NewMockResourceClients(t)
		clients.EXPECT().ForKind(mock.Anything, schema.GroupVersionKind{
			Group: "dashboard.grafana.app", Kind: "Dashboard",
		}).Return(dynClient, dashGVR, nil)
		clientsMock.EXPECT().Clients(mock.Anything, "default").Return(clients, nil)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeMoveJob(ctx, mockReader, cfg, &provisioning.MoveJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: "my-dash", Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
			TargetPath: "dest/",
		})
		require.NoError(t, err)
	})

	t.Run("non-reader repo returns bad request", func(t *testing.T) {
		accessMock := auth.NewMockAccessChecker(t)
		mockRepo := repository.NewMockConfigRepository(t)
		clientsMock := resources.NewMockClientFactory(t)

		c := &jobsConnector{access: accessMock, clients: clientsMock}
		err := c.authorizeMoveJob(ctx, mockRepo, cfg, &provisioning.MoveJobOptions{
			Paths:      []string{"dashboard.json"},
			TargetPath: "dest/",
		})
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})
}

func makeUnstructured(name, folder string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
		},
	}
	if folder != "" {
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folder})
	}
	return obj
}

type mockDynamic struct{ mock.Mock }

var _ dynamic.ResourceInterface = (*mockDynamic)(nil)

func (m *mockDynamic) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *mockDynamic) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockDynamic) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockDynamic) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockDynamic) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	return nil
}
func (m *mockDynamic) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	return nil
}
func (m *mockDynamic) List(context.Context, metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return nil, nil
}
func (m *mockDynamic) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	return nil, nil
}
func (m *mockDynamic) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockDynamic) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *mockDynamic) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}

// --- handleOrphanCleanupJob tests ---

// fakeResponder captures the result of rest.Responder calls.
type fakeResponder struct {
	statusCode int
	object     runtime.Object
	err        error
}

func (r *fakeResponder) Object(statusCode int, obj runtime.Object) {
	r.statusCode = statusCode
	r.object = obj
}

func (r *fakeResponder) Error(err error) {
	r.err = err
}

// fakeRepoGetter implements the provisioning-level RepoGetter interface.
type fakeRepoGetter struct {
	repo repository.Repository
	err  error
}

func (f *fakeRepoGetter) GetRepository(_ context.Context, _ string) (repository.Repository, error) {
	return f.repo, f.err
}

func (f *fakeRepoGetter) GetHealthyRepository(_ context.Context, _ string) (repository.Repository, error) {
	return f.repo, f.err
}

// fakeJobQueueGetter wraps a jobs.Queue to satisfy JobQueueGetter.
type fakeJobQueueGetter struct {
	queue jobs.Queue
}

func (f *fakeJobQueueGetter) GetJobQueue() jobs.Queue {
	return f.queue
}

func TestHandleOrphanCleanupJob_RepoNotFound_AdminAllowed(t *testing.T) {
	for _, action := range []provisioning.JobAction{
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
	} {
		t.Run(string(action), func(t *testing.T) {
			ctx := request.WithNamespace(context.Background(), "default")

			notFound := apierrors.NewNotFound(
				schema.GroupResource{Group: provisioning.GROUP, Resource: "repositories"},
				"gone-repo",
			)
			repoGetter := &fakeRepoGetter{err: notFound}

			adminChecker := auth.NewMockAccessChecker(t)
			adminChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(nil)
			accessMock := auth.NewMockAccessChecker(t)
			accessMock.EXPECT().WithFallbackRole(identity.RoleAdmin).Return(adminChecker)

			queueMock := &jobs.MockQueue{}
			createdJob := &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "job-1", Namespace: "default"},
				Spec:       provisioning.JobSpec{Action: action, Repository: "gone-repo"},
			}
			queueMock.EXPECT().Insert(mock.Anything, "default", mock.Anything).Return(createdJob, nil)

			c := &jobsConnector{
				repoGetter: repoGetter,
				access:     accessMock,
				jobs:       &fakeJobQueueGetter{queue: queueMock},
			}

			responder := &fakeResponder{}
			r, _ := http.NewRequest(http.MethodPost, "/", nil)
			r = r.WithContext(ctx)

			spec := provisioning.JobSpec{Action: action, Repository: "gone-repo"}
			c.handleOrphanCleanupJob(ctx, r, "gone-repo", spec, responder)

			require.NoError(t, responder.err)
			assert.Equal(t, http.StatusAccepted, responder.statusCode)
			assert.Equal(t, createdJob, responder.object)
		})
	}
}

func TestHandleOrphanCleanupJob_RepoTerminating_Allowed(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	now := metav1.Now()
	repoCfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "dying-repo",
			Namespace:         "default",
			DeletionTimestamp: &now,
		},
	}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)
	repoGetter := &fakeRepoGetter{repo: mockRepo}

	adminChecker := auth.NewMockAccessChecker(t)
	adminChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(nil)
	accessMock := auth.NewMockAccessChecker(t)
	accessMock.EXPECT().WithFallbackRole(identity.RoleAdmin).Return(adminChecker)

	queueMock := &jobs.MockQueue{}
	createdJob := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "job-1", Namespace: "default"},
		Spec:       provisioning.JobSpec{Action: provisioning.JobActionReleaseResources, Repository: "dying-repo"},
	}
	queueMock.EXPECT().Insert(mock.Anything, "default", mock.Anything).Return(createdJob, nil)

	c := &jobsConnector{
		repoGetter: repoGetter,
		access:     accessMock,
		jobs:       &fakeJobQueueGetter{queue: queueMock},
	}

	responder := &fakeResponder{}
	r, _ := http.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(ctx)

	spec := provisioning.JobSpec{Action: provisioning.JobActionReleaseResources, Repository: "dying-repo"}
	c.handleOrphanCleanupJob(ctx, r, "dying-repo", spec, responder)

	require.NoError(t, responder.err)
	assert.Equal(t, http.StatusAccepted, responder.statusCode)
}

func TestHandleOrphanCleanupJob_HealthyRepo_Rejected(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	repoCfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "healthy-repo",
			Namespace: "default",
		},
	}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)
	repoGetter := &fakeRepoGetter{repo: mockRepo}

	c := &jobsConnector{repoGetter: repoGetter}

	responder := &fakeResponder{}
	r, _ := http.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(ctx)

	spec := provisioning.JobSpec{Action: provisioning.JobActionReleaseResources, Repository: "healthy-repo"}
	c.handleOrphanCleanupJob(ctx, r, "healthy-repo", spec, responder)

	require.Error(t, responder.err)
	assert.True(t, apierrors.IsConflict(responder.err))
	assert.Contains(t, responder.err.Error(), "repository exists and is not being deleted")
}

func TestHandleOrphanCleanupJob_NonAdminForbidden(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	notFound := apierrors.NewNotFound(
		schema.GroupResource{Group: provisioning.GROUP, Resource: "repositories"},
		"gone-repo",
	)
	repoGetter := &fakeRepoGetter{err: notFound}

	forbidden := apierrors.NewForbidden(schema.GroupResource{}, "", fmt.Errorf("admin role is required"))
	adminChecker := auth.NewMockAccessChecker(t)
	adminChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(forbidden)
	accessMock := auth.NewMockAccessChecker(t)
	accessMock.EXPECT().WithFallbackRole(identity.RoleAdmin).Return(adminChecker)

	c := &jobsConnector{
		repoGetter: repoGetter,
		access:     accessMock,
	}

	responder := &fakeResponder{}
	r, _ := http.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(ctx)

	spec := provisioning.JobSpec{Action: provisioning.JobActionReleaseResources, Repository: "gone-repo"}
	c.handleOrphanCleanupJob(ctx, r, "gone-repo", spec, responder)

	require.Error(t, responder.err)
	assert.True(t, apierrors.IsForbidden(responder.err))
}

func TestHandleOrphanCleanupJob_MissingNamespace(t *testing.T) {
	ctx := context.Background() // no namespace

	c := &jobsConnector{}

	responder := &fakeResponder{}
	r, _ := http.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(ctx)

	spec := provisioning.JobSpec{Action: provisioning.JobActionReleaseResources}
	c.handleOrphanCleanupJob(ctx, r, "some-repo", spec, responder)

	require.Error(t, responder.err)
	assert.True(t, apierrors.IsBadRequest(responder.err))
	assert.Contains(t, responder.err.Error(), "missing namespace")
}

func TestHandleOrphanCleanupJob_GetRepoUnexpectedError(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	repoGetter := &fakeRepoGetter{err: fmt.Errorf("database connection lost")}

	c := &jobsConnector{repoGetter: repoGetter}

	responder := &fakeResponder{}
	r, _ := http.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(ctx)

	spec := provisioning.JobSpec{Action: provisioning.JobActionDeleteResources}
	c.handleOrphanCleanupJob(ctx, r, "some-repo", spec, responder)

	require.Error(t, responder.err)
	assert.Contains(t, responder.err.Error(), "database connection lost")
}

func TestHandleOrphanCleanupJob_InsertError(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	notFound := apierrors.NewNotFound(
		schema.GroupResource{Group: provisioning.GROUP, Resource: "repositories"},
		"gone-repo",
	)
	repoGetter := &fakeRepoGetter{err: notFound}

	adminChecker := auth.NewMockAccessChecker(t)
	adminChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(nil)
	accessMock := auth.NewMockAccessChecker(t)
	accessMock.EXPECT().WithFallbackRole(identity.RoleAdmin).Return(adminChecker)

	queueMock := &jobs.MockQueue{}
	queueMock.EXPECT().Insert(mock.Anything, "default", mock.Anything).
		Return(nil, fmt.Errorf("queue full"))

	c := &jobsConnector{
		repoGetter: repoGetter,
		access:     accessMock,
		jobs:       &fakeJobQueueGetter{queue: queueMock},
	}

	responder := &fakeResponder{}
	r, _ := http.NewRequest(http.MethodPost, "/", nil)
	r = r.WithContext(ctx)

	spec := provisioning.JobSpec{Action: provisioning.JobActionReleaseResources, Repository: "gone-repo"}
	c.handleOrphanCleanupJob(ctx, r, "gone-repo", spec, responder)

	require.Error(t, responder.err)
	assert.Contains(t, responder.err.Error(), "queue full")
}

func TestAuthorizeAdminJob(t *testing.T) {
	ctx := context.Background()
	cfg := newTestRepo("my-repo", "default")

	t.Run("admin is authorized", func(t *testing.T) {
		adminChecker := auth.NewMockAccessChecker(t)
		adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == "create" &&
				req.Group == provisioning.GROUP &&
				req.Resource == provisioning.JobResourceInfo.GetName() &&
				req.Namespace == cfg.Namespace
		}), "").Return(nil)

		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().WithFallbackRole(identity.RoleAdmin).Return(adminChecker)

		c := &jobsConnector{access: accessMock}
		err := c.authorizeAdminJob(ctx, cfg)
		require.NoError(t, err)
	})

	t.Run("non-admin is forbidden", func(t *testing.T) {
		adminChecker := auth.NewMockAccessChecker(t)
		adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == "create" &&
				req.Group == provisioning.GROUP &&
				req.Resource == provisioning.JobResourceInfo.GetName()
		}), "").Return(apierrors.NewForbidden(schema.GroupResource{}, "", fmt.Errorf("admin role is required")))

		accessMock := auth.NewMockAccessChecker(t)
		accessMock.EXPECT().WithFallbackRole(identity.RoleAdmin).Return(adminChecker)

		c := &jobsConnector{access: accessMock}
		err := c.authorizeAdminJob(ctx, cfg)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})
}
