package controller

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

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
					On("List", context.Background(), "default", "my-repo").
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
					On("Clients", context.Background(), "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", context.Background(), schema.GroupVersionResource{
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
					On("List", context.Background(), "default", "my-repo").
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
					On("Clients", context.Background(), "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", context.Background(), schema.GroupVersionResource{
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
					On("Clients", context.Background(), "default").
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
					On("List", context.Background(), "default", "my-repo").
					Once().
					Return(nil, assert.AnError)

				return resourceLister
			}(),
			clientFactory: func() resources.ClientFactory {
				clientFactory := resources.NewMockClientFactory(t)
				clients := resources.NewMockResourceClients(t)

				clientFactory.
					On("Clients", context.Background(), "default").
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
					On("List", context.Background(), "default", "my-repo").
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
					On("Clients", context.Background(), "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", context.Background(), schema.GroupVersionResource{
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
					On("List", context.Background(), "default", "my-repo").
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
					On("Clients", context.Background(), "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", context.Background(), schema.GroupVersionResource{
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
					On("List", context.Background(), "default", "my-repo").
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
					On("Clients", context.Background(), "default").
					Once().
					Return(clients, nil)

				clients.
					On("ForResource", context.Background(), schema.GroupVersionResource{
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
				lister:        tc.lister,
				clientFactory: tc.clientFactory,
				metrics:       &metrics,
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
			sortResourceListForDeletion(&tc.input)
			assert.Equal(t, tc.expected, tc.input)
		})
	}
}
