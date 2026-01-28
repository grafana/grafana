package resources

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestParser(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.On("ForKind", mock.Anything, dashboardV0.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()
	clients.On("ForKind", mock.Anything, dashboardV1.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV1.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()

	quotaChecker := quotas.NewUnlimitedQuotaChecker()

	parser := &parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      provisioning.LocalRepositoryType,
			Namespace: "xxx",
			Name:      "repo",
		},
		clients:      clients,
		quotaChecker: quotaChecker,
		config: &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "xxx",
				Name:      "repo",
			},
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		},
	}

	t.Run("invalid input", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte("hello"), // not a real resource
		})
		require.Error(t, err)
		// Check that it's a ResourceValidationError
		var resourceErr *ResourceValidationError
		require.ErrorAs(t, err, &resourceErr, "error should be a ResourceValidationError")
		require.Contains(t, err.Error(), "resource validation failed")
	})

	t.Run("dashboard parsing (with and without name)", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-v0
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "test-v0", dash.Obj.GetName())
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)

		// Now try again without a name
		_, err = parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: ` + dashboardV1.APIVERSION + `
kind: Dashboard
spec:
  title: Test dashboard
`),
		})
		require.EqualError(t, err, "name.metadata.name: Required value: missing name in resource")
	})

	t.Run("generate name will generate a name", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  generateName: rand-
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.True(t, strings.HasPrefix(dash.Obj.GetName(), "rand-"), "set name")
	})

	t.Run("dashboard classic format", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`{ "uid": "test", "schemaVersion": 30, "panels": [], "tags": [] }`),
		})
		require.NoError(t, err)
		require.Equal(t, "test", dash.Obj.GetName())
		require.Equal(t, provisioning.ClassicDashboard, dash.Classic)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)
	})

	t.Run("validate proper folder metadata is set", func(t *testing.T) {
		testCases := []struct {
			name           string
			filePath       string
			expectedFolder string
		}{
			{
				name:           "file in subdirectory should use parsed folder ID",
				filePath:       "team-a/testing-valid-dashboard.json",
				expectedFolder: ParseFolder("team-a/", "repo").ID,
			},
			{
				name:           "file in first-level directory should use parent folder id",
				filePath:       "testing-valid-dashboard.json",
				expectedFolder: parser.repo.Name,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				dash, err := parser.Parse(context.Background(), &repository.FileInfo{
					Path: tc.filePath,
					Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Test dashboard
`),
				})
				require.NoError(t, err)
				require.Equal(t, tc.expectedFolder, dash.Meta.GetFolder(), "folder should match expected")
				annotations := dash.Obj.GetAnnotations()
				require.NotNil(t, annotations, "annotations should not be nil")
				require.Equal(t, tc.expectedFolder, annotations["grafana.app/folder"], "folder annotation should match expected")
			})
		}
	})
}

func TestParser_QuotaChecker(t *testing.T) {
	createTestParserAndResource := func(t *testing.T) (*parser, *ParsedResource, *MockDynamicResourceInterface) {
		clients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		clients.On("ForKind", mock.Anything, dashboardV0.DashboardResourceInfo.GroupVersionKind()).
			Return(mockClient, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()

		parser := &parser{
			repo: provisioning.ResourceRepositoryInfo{
				Type:      provisioning.LocalRepositoryType,
				Namespace: "xxx",
				Name:      "repo",
			},
			clients: clients,
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "xxx",
					Name:      "repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			},
		}

		parsed, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)

		// Create a mock dry run response to simulate a create action
		dryRunObj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "test-dashboard",
				},
				"spec": map[string]interface{}{
					"title": "Test dashboard",
				},
			},
		}
		parsed.DryRunResponse = dryRunObj
		parsed.Existing = nil // No existing resource, so it's a create

		return parser, parsed, mockClient
	}

	t.Run("quota check error", func(t *testing.T) {
		_, parsed, mockClient := createTestParserAndResource(t)
		quotaChecker := quotas.NewMockQuotaChecker(t)
		parsed.quotaChecker = quotaChecker

		expectedErr := errors.New("quota check failed")
		// Mock Create call since createFn() will be called in the Run function
		mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(nil, errors.New("create failed")).Maybe()
		quotaChecker.On("GrantResourceCreation", mock.Anything, mock.AnythingOfType("func() error")).
			Return(expectedErr).Once().
			Run(func(args mock.Arguments) {
				createFn := args.Get(1).(func() error)
				_ = createFn() // Call the function to verify it's passed correctly
			})

		err := parsed.Run(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "resource creation")
		require.True(t, errors.Is(err, expectedErr), "error should wrap expectedErr")
		quotaChecker.AssertExpectations(t)
		mockClient.AssertExpectations(t)
	})

	t.Run("quota check success", func(t *testing.T) {
		_, parsed, mockClient := createTestParserAndResource(t)
		quotaChecker := quotas.NewMockQuotaChecker(t)
		parsed.quotaChecker = quotaChecker

		createdObj := parsed.DryRunResponse.DeepCopy()
		createdObj.SetResourceVersion("1")

		quotaChecker.On("GrantResourceCreation", mock.Anything, mock.AnythingOfType("func() error")).
			Return(nil).Once().
			Run(func(args mock.Arguments) {
				createFn := args.Get(1).(func() error)
				_ = createFn() // Call the function to execute the create
			})
		mockClient.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(createdObj, nil).Once()

		err := parsed.Run(context.Background())
		require.NoError(t, err)
		require.NotNil(t, parsed.Upsert)
		quotaChecker.AssertExpectations(t)
		mockClient.AssertExpectations(t)
	})

	t.Run("quota exceeded", func(t *testing.T) {
		_, parsed, _ := createTestParserAndResource(t)
		quotaChecker := quotas.NewMockQuotaChecker(t)
		parsed.quotaChecker = quotaChecker

		quotaChecker.On("GrantResourceCreation", mock.Anything, mock.AnythingOfType("func() error")).
			Return(ErrQuotaExceeded).Once()

		err := parsed.Run(context.Background())
		require.Error(t, err)
		require.True(t, errors.Is(err, ErrQuotaExceeded), "error should wrap ErrQuotaExceeded")
		quotaChecker.AssertExpectations(t)
	})
}
