package cleanup

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCleanUpTmpFiles(t *testing.T) {
	cfg := setting.Cfg{}
	cfg.TempDataLifetime, _ = time.ParseDuration("24h")
	service := CleanUpService{
		Cfg: &cfg,
	}
	now := time.Now()
	secondAgo := now.Add(-time.Second)
	twoDaysAgo := now.Add(-time.Second * 3600 * 24 * 2)
	weekAgo := now.Add(-time.Second * 3600 * 24 * 7)
	t.Run("Should not cleanup recent files", func(t *testing.T) {
		require.False(t, service.shouldCleanupTempFile(secondAgo, now))
	})
	t.Run("Should cleanup older files", func(t *testing.T) {
		require.True(t, service.shouldCleanupTempFile(twoDaysAgo, now))
	})

	t.Run("After increasing temporary files lifetime, older files should be kept", func(t *testing.T) {
		cfg.TempDataLifetime, _ = time.ParseDuration("1000h")
		require.False(t, service.shouldCleanupTempFile(weekAgo, now))
	})

	t.Run("If lifetime is 0, files should never be cleaned up", func(t *testing.T) {
		cfg.TempDataLifetime = 0
		require.False(t, service.shouldCleanupTempFile(weekAgo, now))
	})
}

func TestDeleteExpiredSnapshots_LegacyMode(t *testing.T) {
	t.Run("calls DeleteExpiredSnapshots on success", func(t *testing.T) {
		mockSnapService := dashboardsnapshots.NewMockService(t)
		mockSnapService.On("DeleteExpiredSnapshots", mock.Anything, mock.Anything).Return(nil)

		service := &CleanUpService{
			log:                      log.New("cleanup"),
			Features:                 featuremgmt.WithFeatures(),
			dashboardSnapshotService: mockSnapService,
		}

		service.deleteExpiredSnapshots(context.Background())

		mockSnapService.AssertCalled(t, "DeleteExpiredSnapshots", mock.Anything, mock.Anything)
	})

	t.Run("handles error gracefully", func(t *testing.T) {
		mockSnapService := dashboardsnapshots.NewMockService(t)
		mockSnapService.On("DeleteExpiredSnapshots", mock.Anything, mock.Anything).Return(errors.New("db error"))

		service := &CleanUpService{
			log:                      log.New("cleanup"),
			Features:                 featuremgmt.WithFeatures(),
			dashboardSnapshotService: mockSnapService,
		}

		// Should not panic
		service.deleteExpiredSnapshots(context.Background())
	})
}

func TestDeleteExpiredSnapshots_KubernetesMode(t *testing.T) {
	t.Run("deletes expired snapshots across multiple orgs", func(t *testing.T) {
		// Create expired snapshots - one per org
		expiredTime := time.Now().Add(-time.Hour).UnixMilli()
		expiredSnapshot1 := createUnstructuredSnapshot("expired-snap-1", "org-1", expiredTime)
		expiredSnapshot2 := createUnstructuredSnapshot("expired-snap-2", "org-2", expiredTime)

		// Track which namespaces were queried
		namespacesQueried := make(map[string]bool)

		mockResource := new(mockResourceInterface)
		mockResource.On("Namespace", mock.Anything).Run(func(args mock.Arguments) {
			ns := args.Get(0).(string)
			namespacesQueried[ns] = true
		}).Return(mockResource)
		mockResource.On("List", mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*expiredSnapshot1, *expiredSnapshot2},
		}, nil)
		mockResource.On("Delete", mock.Anything, "expired-snap-1", mock.Anything, mock.Anything).Return(nil)
		mockResource.On("Delete", mock.Anything, "expired-snap-2", mock.Anything, mock.Anything).Return(nil)

		mockDynClient := new(mockDynamicClient)
		mockDynClient.On("Resource", mock.Anything).Return(mockResource)

		service := createK8sCleanupService(t, mockDynClient)
		service.deleteExpiredSnapshots(context.Background())

		// Verify multiple namespaces were queried (one per org)
		require.GreaterOrEqual(t, len(namespacesQueried), 2, "expected at least 2 namespaces to be queried")
		// Verify both snapshots were deleted
		mockResource.AssertCalled(t, "Delete", mock.Anything, "expired-snap-1", mock.Anything, mock.Anything)
		mockResource.AssertCalled(t, "Delete", mock.Anything, "expired-snap-2", mock.Anything, mock.Anything)
	})

	t.Run("skips non-expired snapshots", func(t *testing.T) {
		// Setup with future timestamp
		futureTime := time.Now().Add(time.Hour).UnixMilli()
		futureSnapshot := createUnstructuredSnapshot("future-snap", "org-1", futureTime)

		mockResource := new(mockResourceInterface)
		mockResource.On("Namespace", mock.Anything).Return(mockResource)
		mockResource.On("List", mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*futureSnapshot},
		}, nil)

		mockDynClient := new(mockDynamicClient)
		mockDynClient.On("Resource", mock.Anything).Return(mockResource)

		service := createK8sCleanupService(t, mockDynClient)
		service.deleteExpiredSnapshots(context.Background())

		mockResource.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("handles REST config error", func(t *testing.T) {
		service := &CleanUpService{
			log:                  log.New("cleanup"),
			Cfg:                  &setting.Cfg{},
			Features:             featuremgmt.WithFeatures(featuremgmt.FlagKubernetesSnapshots),
			clientConfigProvider: apiserver.WithoutRestConfig,
		}

		// Should not panic
		service.deleteExpiredSnapshots(context.Background())
	})

	t.Run("handles not found error gracefully", func(t *testing.T) {
		expiredTime := time.Now().Add(-time.Hour).UnixMilli()
		expiredSnapshot := createUnstructuredSnapshot("expired-snap", "org-1", expiredTime)

		notFoundErr := k8serrors.NewNotFound(schema.GroupResource{}, "expired-snap")

		mockResource := new(mockResourceInterface)
		mockResource.On("Namespace", mock.Anything).Return(mockResource)
		mockResource.On("List", mock.Anything, mock.Anything).Return(&unstructured.UnstructuredList{
			Items: []unstructured.Unstructured{*expiredSnapshot},
		}, nil)
		mockResource.On("Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(notFoundErr)

		mockDynClient := new(mockDynamicClient)
		mockDynClient.On("Resource", mock.Anything).Return(mockResource)

		service := createK8sCleanupService(t, mockDynClient)

		// Should not panic - not found is expected
		service.deleteExpiredSnapshots(context.Background())
		mockResource.AssertExpectations(t)
	})
}

// Helper function to create unstructured snapshots for testing
func createUnstructuredSnapshot(name, namespace string, expiresMillis int64) *unstructured.Unstructured {
	snapshot := &v0alpha1.Snapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: v0alpha1.SnapshotSpec{
			Expires: &expiresMillis,
		},
	}
	obj, _ := runtime.DefaultUnstructuredConverter.ToUnstructured(snapshot)
	return &unstructured.Unstructured{Object: obj}
}

// Helper to create CleanUpService configured for Kubernetes mode with standard two-org setup
func createK8sCleanupService(t *testing.T, mockDynClient *mockDynamicClient) *CleanUpService {
	mockOrgSvc := orgtest.NewMockService(t)
	mockOrgSvc.On("Search", mock.Anything, mock.Anything).Return([]*org.OrgDTO{
		{ID: 1, Name: "org1"},
		{ID: 2, Name: "org2"},
	}, nil)

	return &CleanUpService{
		log:      log.New("cleanup"),
		Cfg:      &setting.Cfg{},
		Features: featuremgmt.WithFeatures(featuremgmt.FlagKubernetesSnapshots),
		clientConfigProvider: apiserver.RestConfigProviderFunc(func(ctx context.Context) (*rest.Config, error) {
			return &rest.Config{}, nil
		}),
		orgService: mockOrgSvc,
		dynamicClientFactory: func(cfg *rest.Config) (dynamic.Interface, error) {
			return mockDynClient, nil
		},
	}
}

// mockDynamicClient is a minimal mock for dynamic.Interface
type mockDynamicClient struct {
	mock.Mock
}

func (m *mockDynamicClient) Resource(resource schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	args := m.Called(resource)
	return args.Get(0).(dynamic.NamespaceableResourceInterface)
}

// mockResourceInterface is a minimal mock for dynamic.ResourceInterface
type mockResourceInterface struct {
	mock.Mock
}

func (m *mockResourceInterface) Namespace(ns string) dynamic.ResourceInterface {
	args := m.Called(ns)
	return args.Get(0).(dynamic.ResourceInterface)
}

func (m *mockResourceInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.UnstructuredList), args.Error(1)
}

func (m *mockResourceInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions, subresources ...string) error {
	args := m.Called(ctx, name, opts, subresources)
	return args.Error(0)
}

// Unused methods - panic if called unexpectedly
func (m *mockResourceInterface) Create(ctx context.Context, obj *unstructured.Unstructured, opts metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) Update(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) DeleteCollection(ctx context.Context, opts metav1.DeleteOptions, listOpts metav1.ListOptions) error {
	panic("not implemented")
}
func (m *mockResourceInterface) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, opts metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
func (m *mockResourceInterface) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, opts metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("not implemented")
}
