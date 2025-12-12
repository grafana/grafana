package authorizer

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var configProvider = func(ctx context.Context) (*rest.Config, error) {
	return &rest.Config{}, nil
}

func TestParentProviderImpl_GetParent(t *testing.T) {
	tests := []struct {
		name            string
		gr              schema.GroupResource
		namespace       string
		resourceName    string
		parentFolder    string
		setupFake       func(*fakeDynamicClient, *fakeResourceInterface)
		configProviders map[schema.GroupResource]ConfigProvider
		versions        map[schema.GroupResource]string
		expectedError   string
		expectedParent  string
	}{
		{
			name:         "successfully get parent folder",
			gr:           schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE},
			namespace:    "org-1",
			resourceName: "dash1",
			parentFolder: "fold1",
			setupFake: func(fakeClient *fakeDynamicClient, fakeResource *fakeResourceInterface) {
				fakeClient.resourceInterface = fakeResource
				fakeResource.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
					obj := &unstructured.Unstructured{}
					obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "fold1"})
					return obj, nil
				}
			},
			configProviders: map[schema.GroupResource]ConfigProvider{
				{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}: configProvider,
			},
			versions:       Versions,
			expectedParent: "fold1",
		},
		{
			name:         "resource without parent annotation returns empty",
			gr:           schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE},
			namespace:    "org-1",
			resourceName: "dash1",
			setupFake: func(fakeClient *fakeDynamicClient, fakeResource *fakeResourceInterface) {
				fakeClient.resourceInterface = fakeResource
				fakeResource.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
					obj := &unstructured.Unstructured{}
					obj.SetAnnotations(map[string]string{})
					return obj, nil
				}
			},
			configProviders: map[schema.GroupResource]ConfigProvider{
				{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}: configProvider,
			},
			versions:       Versions,
			expectedParent: "",
		},
		{
			name:            "no config provider returns error",
			gr:              schema.GroupResource{Group: "unknown.group", Resource: "unknown"},
			namespace:       "org-1",
			resourceName:    "resource-1",
			configProviders: map[schema.GroupResource]ConfigProvider{},
			versions:        Versions,
			expectedError:   ErrNoConfigProvider.Error(),
		},
		{
			name:         "config provider returns error",
			gr:           schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE},
			namespace:    "org-1",
			resourceName: "resource-1",
			configProviders: map[schema.GroupResource]ConfigProvider{
				{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}: func(ctx context.Context) (*rest.Config, error) {
					return nil, errors.New("config provider error")
				},
			},
			versions:      Versions,
			expectedError: "config provider error",
		},
		{
			name:         "no version info returns error",
			gr:           schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE},
			namespace:    "org-1",
			resourceName: "resource-1",
			configProviders: map[schema.GroupResource]ConfigProvider{
				{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}: func(ctx context.Context) (*rest.Config, error) {
					return &rest.Config{}, nil
				},
			},
			versions:      map[schema.GroupResource]string{},
			expectedError: ErrNoVersionInfo.Error(),
		},
		{
			name:         "resource get returns error",
			gr:           schema.GroupResource{Group: folderv1.GROUP, Resource: folderv1.RESOURCE},
			namespace:    "org-1",
			resourceName: "resource-1",
			setupFake: func(fakeClient *fakeDynamicClient, fakeResource *fakeResourceInterface) {
				fakeClient.resourceInterface = fakeResource
				fakeResource.getFunc = func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
					return nil, errors.New("resource not found")
				}
			},
			configProviders: map[schema.GroupResource]ConfigProvider{
				{Group: folderv1.GROUP, Resource: folderv1.RESOURCE}: func(ctx context.Context) (*rest.Config, error) {
					return &rest.Config{}, nil
				},
			},
			versions:      Versions,
			expectedError: "resource not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := &fakeDynamicClient{}
			fakeResource := &fakeResourceInterface{}
			if tt.setupFake != nil {
				tt.setupFake(fakeClient, fakeResource)
			}

			provider := &ParentProviderImpl{
				configProviders: tt.configProviders,
				versions:        tt.versions,
				dynamicClientFactory: func(config *rest.Config) (dynamic.Interface, error) {
					return fakeClient, nil
				},
				clients: make(map[schema.GroupResource]dynamic.Interface),
			}

			parent, err := provider.GetParent(context.Background(), tt.gr, tt.namespace, tt.resourceName)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Empty(t, parent)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedParent, parent)
			}
		})
	}
}

// fakeDynamicClient is a fake implementation of dynamic.Interface
type fakeDynamicClient struct {
	resourceInterface dynamic.ResourceInterface
}

func (f *fakeDynamicClient) Resource(resource schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	return &fakeNamespaceableResourceInterface{
		resourceInterface: f.resourceInterface,
	}
}

// fakeNamespaceableResourceInterface is a fake implementation of dynamic.NamespaceableResourceInterface
type fakeNamespaceableResourceInterface struct {
	dynamic.NamespaceableResourceInterface
	resourceInterface dynamic.ResourceInterface
}

func (f *fakeNamespaceableResourceInterface) Namespace(namespace string) dynamic.ResourceInterface {
	if f.resourceInterface != nil {
		return f.resourceInterface
	}
	return &fakeResourceInterface{}
}

// fakeResourceInterface is a fake implementation of dynamic.ResourceInterface
type fakeResourceInterface struct {
	dynamic.ResourceInterface
	getFunc func(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error)
}

func (f *fakeResourceInterface) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, name, opts, subresources...)
	}
	return &unstructured.Unstructured{}, nil
}
