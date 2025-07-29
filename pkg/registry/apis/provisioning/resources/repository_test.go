package resources

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestRepositoryResources_FindResourcePath(t *testing.T) {
	tests := []struct {
		name          string
		resourceName  string
		gvk           schema.GroupVersionKind
		expectedGVR   schema.GroupVersionResource
		forKindError  error
		getError      error
		resourceObj   *unstructured.Unstructured
		expectedPath  string
		expectedError string
	}{
		{
			name:         "dashboard found successfully",
			resourceName: "test-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			resourceObj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "test-dashboard",
						"namespace": "test-namespace",
						"annotations": map[string]interface{}{
							utils.AnnoKeySourcePath: "dashboards/test-dashboard.json",
						},
					},
				},
			},
			expectedPath: "dashboards/test-dashboard.json",
		},
		{
			name:         "folder found successfully",
			resourceName: "test-folder",
			gvk: schema.GroupVersionKind{
				Group: "folder.grafana.app",
				Kind:  "Folder",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "folder.grafana.app",
				Version:  "v0alpha1",
				Resource: "folders",
			},
			resourceObj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "test-folder",
						"namespace": "test-namespace",
						"annotations": map[string]interface{}{
							utils.AnnoKeySourcePath: "folders/test-folder.json",
						},
					},
				},
			},
			expectedPath: "folders/test-folder.json",
		},
		{
			name:         "ForKind fails",
			resourceName: "test-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			forKindError:  errors.New("kind not found"),
			expectedError: "get client for kind Dashboard: kind not found",
		},
		{
			name:         "resource not found",
			resourceName: "nonexistent-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			getError:      apierrors.NewNotFound(schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, "nonexistent-dashboard"),
			expectedError: "resource not found: dashboard.grafana.app/dashboards/nonexistent-dashboard",
		},
		{
			name:         "Get operation fails with other error",
			resourceName: "test-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			getError:      errors.New("internal server error"),
			expectedError: "failed to get resource dashboard.grafana.app/dashboards/test-dashboard: internal server error",
		},
		{
			name:         "resource has no annotations",
			resourceName: "test-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			resourceObj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "test-dashboard",
						"namespace": "test-namespace",
						// No annotations
					},
				},
			},
			expectedError: "resource dashboard.grafana.app/dashboards/test-dashboard has no annotations",
		},
		{
			name:         "resource has empty annotations",
			resourceName: "test-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			resourceObj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":        "test-dashboard",
						"namespace":   "test-namespace",
						"annotations": map[string]interface{}{},
					},
				},
			},
			expectedError: "resource dashboard.grafana.app/dashboards/test-dashboard has no source path annotation",
		},
		{
			name:         "resource has empty source path annotation",
			resourceName: "test-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			resourceObj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "test-dashboard",
						"namespace": "test-namespace",
						"annotations": map[string]interface{}{
							utils.AnnoKeySourcePath: "", // Empty path
						},
					},
				},
			},
			expectedError: "resource dashboard.grafana.app/dashboards/test-dashboard has no source path annotation",
		},
		{
			name:         "resource with nested folder path",
			resourceName: "nested-dashboard",
			gvk: schema.GroupVersionKind{
				Group: "dashboard.grafana.app",
				Kind:  "Dashboard",
			},
			expectedGVR: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			resourceObj: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "nested-dashboard",
						"namespace": "test-namespace",
						"annotations": map[string]interface{}{
							utils.AnnoKeySourcePath: "team-a/subfolder/nested-dashboard.json",
						},
					},
				},
			},
			expectedPath: "team-a/subfolder/nested-dashboard.json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mocks
			mockClients := NewMockResourceClients(t)
			mockClient := &MockDynamicResourceInterface{}

			// Create repository resources with mocked dependencies
			resourcesManager := &ResourcesManager{
				clients: mockClients,
			}

			repositoryResources := &repositoryResources{
				ResourcesManager: resourcesManager,
				namespace:        "test-namespace",
				repoName:         "test-repo",
			}

			// Mock ForKind call
			if tt.forKindError != nil {
				mockClients.On("ForKind", tt.gvk).Return(nil, schema.GroupVersionResource{}, tt.forKindError)
			} else {
				mockClients.On("ForKind", tt.gvk).Return(mockClient, tt.expectedGVR, nil)

				// Mock Get call if ForKind succeeds
				if tt.getError != nil {
					mockClient.On("Get", mock.Anything, tt.resourceName, metav1.GetOptions{}, mock.Anything).Return(nil, tt.getError)
				} else {
					mockClient.On("Get", mock.Anything, tt.resourceName, metav1.GetOptions{}, mock.Anything).Return(tt.resourceObj, nil)
				}
			}

			// Execute the method
			result, err := repositoryResources.FindResourcePath(context.Background(), tt.resourceName, tt.gvk)

			// Assert results
			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
				require.Empty(t, result)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedPath, result)
			}

			// Verify all mocks were called as expected
			mockClients.AssertExpectations(t)
			if tt.forKindError == nil {
				mockClient.AssertExpectations(t)
			}
		})
	}
}

// MockDynamicResourceInterface is a mock for dynamic.ResourceInterface
type MockDynamicResourceInterface struct {
	mock.Mock
}

func (m *MockDynamicResourceInterface) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockDynamicResourceInterface) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockDynamicResourceInterface) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, obj, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockDynamicResourceInterface) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	args := m.Called(ctx, name, options, subresources)
	return args.Error(0)
}

func (m *MockDynamicResourceInterface) DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	args := m.Called(ctx, options, listOptions)
	return args.Error(0)
}

func (m *MockDynamicResourceInterface) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockDynamicResourceInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.UnstructuredList), args.Error(1)
}

func (m *MockDynamicResourceInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	args := m.Called(ctx, opts)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(watch.Interface), args.Error(1)
}

func (m *MockDynamicResourceInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, pt, data, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockDynamicResourceInterface) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, obj, options, subresources)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

func (m *MockDynamicResourceInterface) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	args := m.Called(ctx, name, obj, options)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*unstructured.Unstructured), args.Error(1)
}

// Ensure MockDynamicResourceInterface implements dynamic.ResourceInterface
var _ dynamic.ResourceInterface = (*MockDynamicResourceInterface)(nil)
