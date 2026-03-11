package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

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
