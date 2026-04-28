package controller

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var (
	_ dynamic.ResourceInterface = (*mockDynamicClient)(nil)
	_ repository.Repository     = (*mockRepo)(nil)
	_ repository.Hooks          = (*mockRepo)(nil)
)

type mockDynamicClient struct {
	deleteFunc func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error
	patchFunc  func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error)
}

func (m mockDynamicClient) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, name, options, subresources...)
	}
	return nil
}

func (m mockDynamicClient) DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	panic("not needed for testing")
}

func (m mockDynamicClient) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if m.patchFunc != nil {
		return m.patchFunc(ctx, name, pt, data, options, subresources...)
	}
	return nil, nil
}

func (m mockDynamicClient) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	panic("not needed for testing")
}

func (m mockDynamicClient) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("not needed for testing")
}

type mockRepo struct {
	name         string
	namespace    string
	onDeleteFunc func(ctx context.Context) error
}

func (m mockRepo) OnCreate(ctx context.Context) ([]map[string]interface{}, error) {
	panic("not needed for testing")
}

func (m mockRepo) OnUpdate(ctx context.Context) ([]map[string]interface{}, error) {
	panic("not needed for testing")
}

func (m mockRepo) OnDelete(ctx context.Context) error {
	if m.onDeleteFunc != nil {
		return m.onDeleteFunc(ctx)
	}
	return nil
}

func (m mockRepo) Config() *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      m.name,
			Namespace: m.namespace,
		},
	}
}

func (m mockRepo) Validate() field.ErrorList {
	panic("not needed for testing")
}

func (m mockRepo) Test(ctx context.Context) (*provisioning.TestResults, error) {
	panic("not needed for testing")
}

func TestFinalizer_process(t *testing.T) {
	testCases := []struct {
		name          string
		lister        resources.ResourceLister
		clientFactory resources.ClientFactory
		repo          repository.Repository
		finalizers    []string
		expectedErr   string
	}{
		{
			name:          "No finalizers",
			lister:        nil,
			clientFactory: nil,
			repo:          nil,
			finalizers:    []string{},
		},
		{
			name: "Successfully releases resources and cleanup hooks",
			lister: func() resources.ResourceLister {
				resourceLister := resources.NewMockResourceLister(t)

				resourceLister.
					On("List", mock.Anything, "default", "my-repo").
					Once().
					Return(&provisioning.ResourceList{
						Items: []provisioning.ResourceListItem{
							{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "my-dashboard",
							},
						},
					}, nil)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)
				client := &mockDynamicClient{
					patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
						return &unstructured.Unstructured{}, nil
					},
				}

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", mock.Anything, schema.GroupVersionResource{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					}).
					Once().
					Return(client, schema.GroupVersionKind{}, nil)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
				onDeleteFunc: func(ctx context.Context) error {
					return nil
				},
			},
			finalizers: []string{
				repository.ReleaseOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
		},
		{
			name: "Successfully removes resources and cleanup hooks",
			lister: func() resources.ResourceLister {
				resourceLister := resources.NewMockResourceLister(t)

				resourceLister.
					On("List", mock.Anything, "default", "my-repo").
					Once().
					Return(&provisioning.ResourceList{
						Items: []provisioning.ResourceListItem{
							{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "my-dashboard",
							},
						},
					}, nil)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)
				client := &mockDynamicClient{
					deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
						return nil
					},
				}

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", mock.Anything, schema.GroupVersionResource{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					}).
					Once().
					Return(client, schema.GroupVersionKind{}, nil)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
				onDeleteFunc: func(ctx context.Context) error {
					return nil
				},
			},
			finalizers: []string{
				repository.RemoveOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
		},
		{
			name:   "Issue getting the namespace clients",
			lister: nil,
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(nil, assert.AnError)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
			},
			finalizers: []string{
				repository.RemoveOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
			expectedErr: "remove resources: " + assert.AnError.Error(),
		},
		{
			name: "Issue listing items",
			lister: func() resources.ResourceLister {
				resourceLister := resources.NewMockResourceLister(t)

				resourceLister.
					On("List", mock.Anything, "default", "my-repo").
					Once().
					Return(nil, assert.AnError)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(clients, nil)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
			},
			finalizers: []string{
				repository.RemoveOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
			expectedErr: "remove resources: " + assert.AnError.Error(),
		},
		{
			name: "Issue getting client for resource",
			lister: func() resources.ResourceLister {
				resourceLister := resources.NewMockResourceLister(t)

				resourceLister.
					On("List", mock.Anything, "default", "my-repo").
					Once().
					Return(&provisioning.ResourceList{
						Items: []provisioning.ResourceListItem{
							{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "my-dashboard",
							},
						},
					}, nil)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", mock.Anything, schema.GroupVersionResource{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					}).
					Once().
					Return(nil, schema.GroupVersionKind{}, assert.AnError)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
			},
			finalizers: []string{
				repository.RemoveOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
			expectedErr: "remove resources: " + assert.AnError.Error(),
		},
		{
			name: "Error deleting items",
			lister: func() resources.ResourceLister {
				resourceLister := resources.NewMockResourceLister(t)

				resourceLister.
					On("List", mock.Anything, "default", "my-repo").
					Once().
					Return(&provisioning.ResourceList{
						Items: []provisioning.ResourceListItem{
							{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "my-dashboard",
							},
						},
					}, nil)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)
				client := &mockDynamicClient{
					deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
						return assert.AnError
					},
				}

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", mock.Anything, schema.GroupVersionResource{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					}).
					Once().
					Return(client, schema.GroupVersionKind{}, nil)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
				onDeleteFunc: func(ctx context.Context) error {
					return nil
				},
			},
			finalizers: []string{
				repository.RemoveOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
			expectedErr: "remove resources",
		},
		{
			name: "Error releasing items",
			lister: func() resources.ResourceLister {
				resourceLister := resources.NewMockResourceLister(t)

				resourceLister.
					On("List", mock.Anything, "default", "my-repo").
					Once().
					Return(&provisioning.ResourceList{
						Items: []provisioning.ResourceListItem{
							{
								Group:    "dashboard.grafana.app",
								Resource: "dashboards",
								Name:     "my-dashboard",
							},
						},
					}, nil)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)
				client := &mockDynamicClient{
					patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
						return nil, assert.AnError
					},
				}

				clientFactory.
					On("Clients", mock.Anything, "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", mock.Anything, schema.GroupVersionResource{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
					}).
					Once().
					Return(client, schema.GroupVersionKind{}, nil)

				return clientFactory
			}(),
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
				onDeleteFunc: func(ctx context.Context) error {
					return nil
				},
			},
			finalizers: []string{
				repository.ReleaseOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
			expectedErr: "release resources",
		},
		{
			name:          "Error deleting hooks",
			lister:        nil,
			clientFactory: nil,
			repo: mockRepo{
				name:      "my-repo",
				namespace: "default",
				onDeleteFunc: func(ctx context.Context) error {
					return assert.AnError
				},
			},
			finalizers: []string{
				repository.RemoveOrphanResourcesFinalizer,
				repository.CleanFinalizer,
			},
			expectedErr: "execute deletion hooks: " + assert.AnError.Error(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			metrics := registerFinalizerMetrics(prometheus.NewRegistry())
			f := &finalizer{
				lister:           tc.lister,
				clientFactory:    tc.clientFactory,
				metrics:          &metrics,
				folderAPIVersion: "v1",
			}
			err := f.process(context.Background(), tc.repo, tc.finalizers)
			if tc.expectedErr == "" {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectedErr)
			}
		})
	}
}

func TestSortResourceListForDeletion(t *testing.T) {
	testCases := []struct {
		name     string
		input    provisioning.ResourceList
		expected provisioning.ResourceList
	}{
		{
			name: "Non-folder items first, folders sorted by depth",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
					{Group: "dashboard.grafana.app", Path: "dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder2"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "dashboard.grafana.app", Path: "dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2"},
				},
			},
		},
		{
			name: "Folders without parent should be last",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"}, // if a repo is created with a folder in grafana (here folder1), the path will not have /, but the folder will be set
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1"},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resources.SortResourceListForDeletion(&tc.input)
			assert.Equal(t, tc.expected, tc.input)
		})
	}
}

func TestSortResourceListForRelease(t *testing.T) {
	testCases := []struct {
		name     string
		input    provisioning.ResourceList
		expected provisioning.ResourceList
	}{
		{
			name: "Top-down by depth, folders before resources at same depth",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
					{Group: "dashboard.grafana.app", Path: "folder1/dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder2"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2"},
					{Group: "dashboard.grafana.app", Path: "dashboard1.json"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1", Folder: "folder1"},
					{Group: "dashboard.grafana.app", Path: "folder1/dashboard2.json"},
					{Group: "folder.grafana.app", Path: "folder1/subfolder1/subfolder2", Folder: "subfolder1"},
				},
			},
		},
		{
			name: "Root folders come before nested folders",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "folder.grafana.app", Path: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder3", Folder: "folder1"},
					{Group: "folder.grafana.app", Path: "folder2/subfolder1", Folder: "folder2"},
				},
			},
		},
		{
			name: "Only non-folder items preserves relative order",
			input: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "b.json"},
					{Group: "dashboard.grafana.app", Path: "a.json"},
				},
			},
			expected: provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{
					{Group: "dashboard.grafana.app", Path: "b.json"},
					{Group: "dashboard.grafana.app", Path: "a.json"},
				},
			},
		},
		{
			name:     "Empty list",
			input:    provisioning.ResourceList{Items: []provisioning.ResourceListItem{}},
			expected: provisioning.ResourceList{Items: []provisioning.ResourceListItem{}},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resources.SortResourceListForRelease(&tc.input)
			assert.Equal(t, tc.expected, tc.input)
		})
	}
}

func TestDeleteExistingItems_ResourcesBeforeFolders(t *testing.T) {
	var order []string
	var mu sync.Mutex

	items := provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-root", Path: "root"},
			{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-1", Path: "root/dash.json"},
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-nested", Path: "root/nested", Folder: "folder-root"},
			{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-2", Path: "other.json"},
		},
	}

	resourceLister := resources.NewMockResourceLister(t)
	resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

	clientFactory := resources.NewMockClientFactory(t)
	clients := resources.NewMockResourceClients(t)
	clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

	client := &mockDynamicClient{
		deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
			mu.Lock()
			order = append(order, name)
			mu.Unlock()
			return nil
		},
	}
	clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Resource: "dashboards",
	}).Return(client, schema.GroupVersionKind{}, nil).Twice()
	clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Resource: "folders",
		Version:  "v1",
	}).Return(client, schema.GroupVersionKind{}, nil).Twice()

	f := &finalizer{
		lister:           resourceLister,
		clientFactory:    clientFactory,
		metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
		maxWorkers:       1,
		folderAPIVersion: "v1",
	}

	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
	count, err := f.deleteExistingItems(context.Background(), repo)
	assert.NoError(t, err)
	assert.Equal(t, 4, count)

	// With maxWorkers=1, resources are processed sequentially but still before
	// folders. The two dashboards should come first, then folders deepest-first.
	assert.Equal(t, []string{"dash-1", "dash-2"}, order[:2], "non-folder resources should be deleted first")
	assert.Equal(t, []string{"folder-nested", "folder-root"}, order[2:], "folders should be deleted deepest first")
}

func TestReleaseExistingItems_FoldersBeforeResources(t *testing.T) {
	var order []string
	var mu sync.Mutex

	items := provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-1", Path: "root/dash.json"},
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-root", Path: "root"},
			{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-2", Path: "other.json"},
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-nested", Path: "root/nested", Folder: "folder-root"},
		},
	}

	resourceLister := resources.NewMockResourceLister(t)
	resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

	clientFactory := resources.NewMockClientFactory(t)
	clients := resources.NewMockResourceClients(t)
	clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

	client := &mockDynamicClient{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
			mu.Lock()
			order = append(order, name)
			mu.Unlock()
			return nil, nil
		},
	}
	clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Resource: "dashboards",
	}).Return(client, schema.GroupVersionKind{}, nil).Twice()
	clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Resource: "folders",
		Version:  "v1",
	}).Return(client, schema.GroupVersionKind{}, nil).Twice()

	f := &finalizer{
		lister:           resourceLister,
		clientFactory:    clientFactory,
		metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
		maxWorkers:       1,
		folderAPIVersion: "v1",
	}

	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
	count, err := f.releaseExistingItems(context.Background(), repo)
	assert.NoError(t, err)
	assert.Equal(t, 4, count)

	// Folders should be released shallowest-first, before any non-folder resources.
	assert.Equal(t, []string{"folder-root", "folder-nested"}, order[:2], "folders should be released shallowest first")
	assert.Equal(t, []string{"dash-2", "dash-1"}, order[2:], "non-folder resources should be released after folders")
}

func TestFinalizer_FolderAPIVersion_RoutesFolderItemsToFolderClient(t *testing.T) {
	testCases := []struct {
		name             string
		folderAPIVersion string
	}{
		{name: "v1beta1 folder client (cloud default)", folderAPIVersion: "v1beta1"},
		{name: "v1 folder client (on-prem default)", folderAPIVersion: "v1"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Run("release path", func(t *testing.T) {
				items := provisioning.ResourceList{
					Items: []provisioning.ResourceListItem{
						{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-a", Path: "a"},
						{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a", Path: "dash.json"},
					},
				}

				resourceLister := resources.NewMockResourceLister(t)
				resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)
				clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

				folderClient := &mockDynamicClient{
					patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
						return nil, nil
					},
				}
				dashboardClient := &mockDynamicClient{
					patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
						return nil, nil
					},
				}

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "folder.grafana.app",
					Resource: "folders",
					Version:  tc.folderAPIVersion,
				}).Return(folderClient, schema.GroupVersionKind{}, nil).Once()
				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
				}).Return(dashboardClient, schema.GroupVersionKind{}, nil).Once()

				f := &finalizer{
					lister:           resourceLister,
					clientFactory:    clientFactory,
					metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
					maxWorkers:       1,
					folderAPIVersion: tc.folderAPIVersion,
				}

				repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
				count, err := f.releaseExistingItems(context.Background(), repo)
				assert.NoError(t, err)
				assert.Equal(t, 2, count)
				clients.AssertExpectations(t)
			})

			t.Run("delete path", func(t *testing.T) {
				items := provisioning.ResourceList{
					Items: []provisioning.ResourceListItem{
						{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-a", Path: "a"},
						{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a", Path: "dash.json"},
					},
				}

				resourceLister := resources.NewMockResourceLister(t)
				resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)
				clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

				folderClient := &mockDynamicClient{
					deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
						return nil
					},
				}
				dashboardClient := &mockDynamicClient{
					deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
						return nil
					},
				}

				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "folder.grafana.app",
					Resource: "folders",
					Version:  tc.folderAPIVersion,
				}).Return(folderClient, schema.GroupVersionKind{}, nil).Once()
				clients.On("ForResource", mock.Anything, schema.GroupVersionResource{
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
				}).Return(dashboardClient, schema.GroupVersionKind{}, nil).Once()

				f := &finalizer{
					lister:           resourceLister,
					clientFactory:    clientFactory,
					metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
					maxWorkers:       1,
					folderAPIVersion: tc.folderAPIVersion,
				}

				repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
				count, err := f.deleteExistingItems(context.Background(), repo)
				assert.NoError(t, err)
				assert.Equal(t, 2, count)
				clients.AssertExpectations(t)
			})
		})
	}
}

func TestReleaseExistingItems_ResourcesConcurrent(t *testing.T) {
	var (
		concurrentCount int64
		maxConcurrent   int64
		mu              sync.Mutex
	)

	items := provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}
	for i := range 10 {
		items.Items = append(items.Items, provisioning.ResourceListItem{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
			Name:     fmt.Sprintf("dashboard-%d", i),
			Path:     fmt.Sprintf("dash-%d.json", i),
		})
	}

	resourceLister := resources.NewMockResourceLister(t)
	resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

	clientFactory := resources.NewMockClientFactory(t)
	clients := resources.NewMockResourceClients(t)
	clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

	client := &mockDynamicClient{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
			current := atomic.AddInt64(&concurrentCount, 1)
			defer atomic.AddInt64(&concurrentCount, -1)
			mu.Lock()
			if current > maxConcurrent {
				maxConcurrent = current
			}
			mu.Unlock()
			time.Sleep(1 * time.Second)
			return nil, nil
		},
	}
	clients.On("ForResource", mock.Anything, mock.Anything).Return(client, schema.GroupVersionKind{}, nil)

	f := &finalizer{
		lister:           resourceLister,
		clientFactory:    clientFactory,
		metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
		maxWorkers:       5,
		folderAPIVersion: "v1",
	}

	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
	count, err := f.releaseExistingItems(context.Background(), repo)
	assert.NoError(t, err)
	assert.Equal(t, 10, count)
	assert.Greater(t, maxConcurrent, int64(1), "resources should be released concurrently")
	assert.LessOrEqual(t, maxConcurrent, int64(5), "should not exceed maxWorkers")
}

func TestFinalizer_processExistingItems_Concurrency(t *testing.T) {
	testCases := []struct {
		name                string
		dashboardCount      int
		folderCount         int
		maxWorkers          int
		expectedConcurrency bool
	}{
		{
			name:                "Multiple dashboards processed concurrently",
			dashboardCount:      10,
			folderCount:         0,
			maxWorkers:          5,
			expectedConcurrency: true,
		},
		{
			name:                "Single worker processes dashboards sequentially",
			dashboardCount:      5,
			folderCount:         0,
			maxWorkers:          1,
			expectedConcurrency: false,
		},
		{
			name:                "Folders processed sequentially regardless of maxWorkers",
			dashboardCount:      0,
			folderCount:         5,
			maxWorkers:          10,
			expectedConcurrency: false,
		},
		{
			name:                "Mixed dashboards and folders - dashboards concurrent, folders sequential",
			dashboardCount:      10,
			folderCount:         3,
			maxWorkers:          5,
			expectedConcurrency: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Will be used to track concurrent executions
			var (
				concurrentCount int64
				maxConcurrent   int64
				mu              sync.Mutex
			)

			items := provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}

			for i := range tc.dashboardCount {
				items.Items = append(items.Items, provisioning.ResourceListItem{
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     fmt.Sprintf("dashboard-%d", i),
				})
			}

			for i := range tc.folderCount {
				items.Items = append(items.Items, provisioning.ResourceListItem{
					Group:    folders.GroupVersion.Group,
					Resource: "folders",
					Name:     fmt.Sprintf("folder-%d", i),
				})
			}

			resourceLister := resources.NewMockResourceLister(t)
			resourceLister.
				On("List", mock.Anything, "default", "my-repo").
				Return(&items, nil)

			clientFactory := resources.NewMockClientFactory(t)
			clients := resources.NewMockResourceClients(t)

			client := &mockDynamicClient{
				deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
					// Track concurrent executions
					current := atomic.AddInt64(&concurrentCount, 1)
					defer atomic.AddInt64(&concurrentCount, -1)

					mu.Lock()
					if current > maxConcurrent {
						maxConcurrent = current
					}
					mu.Unlock()

					// Simulate slow client to allow concurrency to build up
					time.Sleep(1 * time.Second)

					return nil
				},
			}

			clientFactory.
				On("Clients", mock.Anything, "default").
				Return(clients, nil)

			clients.
				On("ForResource", mock.Anything, mock.Anything).
				Return(client, schema.GroupVersionKind{}, nil).
				Maybe()
			clients.
				On("Folder", mock.Anything, "v1").
				Return(client, schema.GroupVersionKind{}, nil).
				Maybe()

			metrics := registerFinalizerMetrics(prometheus.NewRegistry())
			f := &finalizer{
				lister:           resourceLister,
				clientFactory:    clientFactory,
				metrics:          &metrics,
				maxWorkers:       tc.maxWorkers,
				folderAPIVersion: "v1",
			}

			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "my-repo",
					Namespace: "default",
				},
			}

			count, err := f.deleteExistingItems(
				context.Background(),
				repo,
			)

			assert.NoError(t, err)
			assert.Equal(t, tc.dashboardCount+tc.folderCount, count)

			if tc.expectedConcurrency {
				// When concurrent, max concurrent should be > 1
				assert.Greater(t, maxConcurrent, int64(1),
					"Expected concurrent execution but maxConcurrent was %d", maxConcurrent)
				// Should not exceed maxWorkers
				assert.LessOrEqual(t, maxConcurrent, int64(tc.maxWorkers))
			} else {
				// When sequential, max concurrent should be 1
				assert.Equal(t, int64(1), maxConcurrent,
					"Expected sequential execution but maxConcurrent was %d", maxConcurrent)
			}
		})
	}
}

// TestReleaseExistingItems_RetriesOnConflict verifies that a transient
// ResourceVersion conflict from the storage backend is retried rather than
// failing the finalizer run.
func TestReleaseExistingItems_RetriesOnConflict(t *testing.T) {
	items := provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-a", Path: "a"},
		},
	}

	resourceLister := resources.NewMockResourceLister(t)
	resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

	clientFactory := resources.NewMockClientFactory(t)
	clients := resources.NewMockResourceClients(t)
	clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

	var calls int32
	client := &mockDynamicClient{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
			n := atomic.AddInt32(&calls, 1)
			if n == 1 {
				// Mirror the error returned by the unified storage backend when
				// a Write is rejected because of RV mismatch.
				return nil, apierrors.NewConflict(
					schema.GroupResource{Group: folders.GroupVersion.Group, Resource: "folders"},
					name,
					fmt.Errorf("requested RV does not match current RV"),
				)
			}
			return nil, nil
		},
	}
	clients.On("ForResource", mock.Anything, mock.Anything).Return(client, schema.GroupVersionKind{}, nil)

	f := &finalizer{
		lister:           resourceLister,
		clientFactory:    clientFactory,
		metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
		maxWorkers:       1,
		folderAPIVersion: "v1",
	}

	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
	count, err := f.releaseExistingItems(context.Background(), repo)
	assert.NoError(t, err)
	assert.Equal(t, 1, count)
	assert.Equal(t, int32(2), atomic.LoadInt32(&calls), "patch should have been retried once after the initial conflict")
}

// TestDeleteExistingItems_RetriesOnConflict mirrors the release-path test for
// the delete path so both cb invocations are covered by retry.
func TestDeleteExistingItems_RetriesOnConflict(t *testing.T) {
	items := provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-a", Path: "a"},
		},
	}

	resourceLister := resources.NewMockResourceLister(t)
	resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

	clientFactory := resources.NewMockClientFactory(t)
	clients := resources.NewMockResourceClients(t)
	clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

	var calls int32
	client := &mockDynamicClient{
		deleteFunc: func(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
			n := atomic.AddInt32(&calls, 1)
			if n == 1 {
				return apierrors.NewConflict(
					schema.GroupResource{Group: folders.GroupVersion.Group, Resource: "folders"},
					name,
					fmt.Errorf("requested RV does not match current RV"),
				)
			}
			return nil
		},
	}
	clients.On("ForResource", mock.Anything, mock.Anything).Return(client, schema.GroupVersionKind{}, nil)

	f := &finalizer{
		lister:           resourceLister,
		clientFactory:    clientFactory,
		metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
		maxWorkers:       1,
		folderAPIVersion: "v1",
	}

	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
	count, err := f.deleteExistingItems(context.Background(), repo)
	assert.NoError(t, err)
	assert.Equal(t, 1, count)
	assert.Equal(t, int32(2), atomic.LoadInt32(&calls), "delete should have been retried once after the initial conflict")
}

// TestReleaseExistingItems_ReturnsErrorWhenConflictPersists ensures the retry
// budget is bounded: if every attempt returns Conflict, the finalizer surfaces
// the error rather than looping forever.
func TestReleaseExistingItems_ReturnsErrorWhenConflictPersists(t *testing.T) {
	items := provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{Group: folders.GroupVersion.Group, Resource: "folders", Name: "folder-a", Path: "a"},
		},
	}

	resourceLister := resources.NewMockResourceLister(t)
	resourceLister.On("List", mock.Anything, "default", "my-repo").Return(&items, nil)

	clientFactory := resources.NewMockClientFactory(t)
	clients := resources.NewMockResourceClients(t)
	clientFactory.On("Clients", mock.Anything, "default").Return(clients, nil)

	var calls int32
	client := &mockDynamicClient{
		patchFunc: func(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
			atomic.AddInt32(&calls, 1)
			return nil, apierrors.NewConflict(
				schema.GroupResource{Group: folders.GroupVersion.Group, Resource: "folders"},
				name,
				fmt.Errorf("requested RV does not match current RV"),
			)
		},
	}
	clients.On("ForResource", mock.Anything, mock.Anything).Return(client, schema.GroupVersionKind{}, nil)

	f := &finalizer{
		lister:           resourceLister,
		clientFactory:    clientFactory,
		metrics:          func() *finalizerMetrics { m := registerFinalizerMetrics(prometheus.NewRegistry()); return &m }(),
		maxWorkers:       1,
		folderAPIVersion: "v1",
	}

	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "my-repo", Namespace: "default"}}
	_, err := f.releaseExistingItems(context.Background(), repo)
	assert.Error(t, err)
	assert.Greater(t, atomic.LoadInt32(&calls), int32(1), "finalizer should have retried at least once before giving up")
}
