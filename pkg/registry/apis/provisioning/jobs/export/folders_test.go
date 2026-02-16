package export

import (
	"context"
	"errors"
	"fmt"
	"testing"

	v0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"
)

func TestLoadExportableFolderTree(t *testing.T) {
	tests := []struct {
		name          string
		reactorFunc   func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError string
		expectedCount int
	}{
		{
			name: "list folders error",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, nil, fmt.Errorf("failed to list folders")
			},
			expectedError: "load folder tree: error executing list: failed to list folders",
		},
		{
			name: "too many folders",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				list := &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.FolderResource.GroupVersion().String(),
						Kind:       "FolderList",
					},
					Items: make([]metav1.PartialObjectMetadata, resources.MaxNumberOfFolders+1),
				}
				for i := 0; i <= resources.MaxNumberOfFolders; i++ {
					list.Items[i] = metav1.PartialObjectMetadata{
						TypeMeta: metav1.TypeMeta{
							APIVersion: resources.FolderResource.GroupVersion().String(),
							Kind:       "Folder",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name: fmt.Sprintf("folder-%d", i),
						},
					}
				}
				return true, list, nil
			},
			expectedError: "load folder tree: too many folders",
		},
		{
			name: "successful loading with two folders",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				list := &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.FolderResource.GroupVersion().String(),
						Kind:       "FolderList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.FolderResource.GroupVersion().String(),
								Kind:       "Folder",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "folder-1",
								Annotations: map[string]string{
									"folder.grafana.app/uid": "folder-1-uid",
								},
							},
						},
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.FolderResource.GroupVersion().String(),
								Kind:       "Folder",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "folder-2",
								Annotations: map[string]string{
									"folder.grafana.app/uid": "folder-2-uid",
								},
							},
						},
					},
				}
				return true, list, nil
			},
			expectedCount: 2,
		},
		{
			name: "successful nested folder loading",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				list := &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.FolderResource.GroupVersion().String(),
						Kind:       "FolderList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.FolderResource.GroupVersion().String(),
								Kind:       "Folder",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "parent-folder",
							},
						},
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.FolderResource.GroupVersion().String(),
								Kind:       "Folder",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "child-folder",
								Annotations: map[string]string{
									"grafana.app/folder": "parent-folder",
								},
							},
						},
					},
				}
				return true, list, nil
			},
			expectedCount: 2,
		},
		{
			name: "empty list returns empty tree",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, &metav1.PartialObjectMetadataList{}, nil
			},
			expectedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := runtime.NewScheme()
			listGVK := schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    "FolderList",
			}
			scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    resources.FolderResource.Resource,
			}, &metav1.PartialObjectMetadata{})

			fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
				resources.FolderResource: listGVK.Kind,
			})
			fakeFolderClient := fakeDynamicClient.Resource(resources.FolderResource)
			fakeDynamicClient.PrependReactor("list", "folders", tt.reactorFunc)

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			mockProgress.On("SetMessage", mock.Anything, "loading exportable folder tree").Return()

			tree, err := LoadExportableFolderTree(context.Background(), fakeFolderClient, mockProgress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
				require.Nil(t, tree)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedCount, tree.Count())
			}
		})
	}

	t.Run("should skip folders from another manager", func(t *testing.T) {
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-folder",
					"annotations": map[string]interface{}{
						"folder.grafana.app/uid": "test-folder-uid",
					},
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindRepo,
			Identity:    "other-manager",
			AllowsEdits: true,
			Suspended:   false,
		})
		fakeFolderClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{*obj},
		}

		mockProgress := jobs.NewMockJobProgressRecorder(t)
		mockProgress.On("SetMessage", mock.Anything, "loading exportable folder tree").Return()

		tree, err := LoadExportableFolderTree(context.Background(), fakeFolderClient, mockProgress)
		require.NoError(t, err)
		require.Equal(t, 0, tree.Count())
	})

	t.Run("should skip if current repo is the manager", func(t *testing.T) {
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-folder",
					"annotations": map[string]interface{}{
						"folder.grafana.app/uid": "test-folder-uid",
					},
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindRepo,
			Identity:    "test-repo",
			AllowsEdits: true,
			Suspended:   false,
		})
		fakeFolderClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{*obj},
		}

		mockProgress := jobs.NewMockJobProgressRecorder(t)
		mockProgress.On("SetMessage", mock.Anything, "loading exportable folder tree").Return()

		tree, err := LoadExportableFolderTree(context.Background(), fakeFolderClient, mockProgress)
		require.NoError(t, err)
		require.Equal(t, 0, tree.Count())
	})

	t.Run("should fail with invalid meta accessor", func(t *testing.T) {
		t.Skip("skipping this test for now as we cannot make it invalid")

		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				// make it invalid
			},
		}
		fakeFolderClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{*obj},
		}

		mockProgress := jobs.NewMockJobProgressRecorder(t)
		mockProgress.On("SetMessage", mock.Anything, "loading exportable folder tree").Return()

		tree, err := LoadExportableFolderTree(context.Background(), fakeFolderClient, mockProgress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "extract meta accessor")
		require.Nil(t, tree)
	})

	t.Run("should skip if managed by any other manager", func(t *testing.T) {
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name": "test-folder",
					"annotations": map[string]interface{}{
						"folder.grafana.app/uid": "test-folder-uid",
					},
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindTerraform,
			Identity:    "terraform-provisioning",
			AllowsEdits: false,
			Suspended:   false,
		})
		fakeFolderClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{*obj},
		}

		mockProgress := jobs.NewMockJobProgressRecorder(t)
		mockProgress.On("SetMessage", mock.Anything, "loading exportable folder tree").Return()

		tree, err := LoadExportableFolderTree(context.Background(), fakeFolderClient, mockProgress)
		require.NoError(t, err)
		require.Equal(t, 0, tree.Count())
	})
}

func TestExportFoldersFromTree(t *testing.T) {
	buildTree := func(t *testing.T, items ...*unstructured.Unstructured) resources.FolderTree {
		t.Helper()
		tree := resources.NewEmptyFolderTree()
		for _, item := range items {
			require.NoError(t, tree.AddUnstructured(item))
		}
		return tree
	}

	newFolder := func(name string, annotations map[string]string) *unstructured.Unstructured {
		obj := map[string]interface{}{
			"metadata": map[string]interface{}{
				"name": name,
			},
		}
		if annotations != nil {
			obj["metadata"].(map[string]interface{})["annotations"] = func() map[string]interface{} {
				m := make(map[string]interface{}, len(annotations))
				for k, v := range annotations {
					m[k] = v
				}
				return m
			}()
		}
		return &unstructured.Unstructured{Object: obj}
	}

	tests := []struct {
		name           string
		tree           func(t *testing.T) resources.FolderTree
		expectedError  string
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		setupResources func(repoResources *resources.MockRepositoryResources)
	}{
		{
			name: "ensure folder tree error",
			tree: func(t *testing.T) resources.FolderTree {
				return resources.NewEmptyFolderTree()
			},
			expectedError: "write folders to repository: failed to ensure folder tree",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.Anything, mock.Anything).Return(fmt.Errorf("failed to ensure folder tree"))
			},
		},
		{
			name: "successful folder export",
			tree: func(t *testing.T) resources.FolderTree {
				return buildTree(t,
					newFolder("folder-1", map[string]string{"folder.grafana.app/uid": "folder-1-uid"}),
					newFolder("folder-2", map[string]string{"folder.grafana.app/uid": "folder-2-uid"}),
				)
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-1" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-2" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "folder-1", Path: "grafana/folder-1"}, true, nil))
					require.NoError(t, fn(resources.Folder{ID: "folder-2", Path: "grafana/folder-2"}, true, nil))
					return true
				})).Return(nil)
			},
		},
		{
			name: "successful folder export with resource export errors",
			tree: func(t *testing.T) resources.FolderTree {
				return buildTree(t,
					newFolder("folder-1", map[string]string{"folder.grafana.app/uid": "folder-1-uid"}),
					newFolder("folder-2", map[string]string{"folder.grafana.app/uid": "folder-2-uid"}),
				)
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-1" && result.Action() == repository.FileActionIgnored && result.Error() != nil && result.Error().Error() == "creating folder folder-1 at path grafana/folder-1: didn't work"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-2" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "folder-1", Path: "grafana/folder-1"}, false, errors.New("didn't work")))
					require.NoError(t, fn(resources.Folder{ID: "folder-2", Path: "grafana/folder-2"}, true, nil))
					return true
				})).Return(nil)
			},
		},
		{
			name: "too many errors",
			tree: func(t *testing.T) resources.FolderTree {
				return buildTree(t,
					newFolder("folder-1", map[string]string{"folder.grafana.app/uid": "folder-1-uid"}),
				)
			},
			expectedError: "write folders to repository: too many errors encountered",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.Anything).Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors encountered"))
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 1
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.Error(t, fn(resources.Folder{ID: "folder-1", Path: "grafana/folder-1"}, true, nil), "too many errors encountered")
					return true
				})).Return(fmt.Errorf("too many errors encountered"))
			},
		},
		{
			name: "successful nested folder export",
			tree: func(t *testing.T) resources.FolderTree {
				return buildTree(t,
					newFolder("parent-folder", nil),
					newFolder("child-folder", map[string]string{"grafana.app/folder": "parent-folder"}),
				)
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "parent-folder" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "child-folder" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "parent-folder", Path: "grafana/parent-folder"}, true, nil))
					require.NoError(t, fn(resources.Folder{ID: "child-folder", Path: "grafana/parent-folder/child-folder"}, true, nil))
					return true
				})).Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tree := tt.tree(t)
			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupResources(repoResources)

			err := ExportFoldersFromTree(context.Background(), v0alpha1.ExportJobOptions{
				Path:   "grafana",
				Branch: "feature/branch",
			}, tree, repoResources, mockProgress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			repoResources.AssertExpectations(t)
			mockProgress.AssertExpectations(t)
		})
	}
}

// mockDynamicInterface implements a simplified version of the dynamic.ResourceInterface
type mockDynamicInterface struct {
	dynamic.ResourceInterface
	items       []unstructured.Unstructured
	deleteError error
}

func (m *mockDynamicInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return &unstructured.UnstructuredList{
		Items: m.items,
	}, nil
}

func (m *mockDynamicInterface) Delete(ctx context.Context, name string, opts metav1.DeleteOptions, subresources ...string) error {
	return m.deleteError
}

func (m *mockDynamicInterface) Get(ctx context.Context, name string, opts metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	if len(m.items) == 0 {
		return nil, fmt.Errorf("no items found")
	}
	return &m.items[0], nil
}
