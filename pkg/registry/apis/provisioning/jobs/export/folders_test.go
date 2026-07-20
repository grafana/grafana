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

func TestExportFolders(t *testing.T) {
	tests := []struct {
		name           string
		reactorFunc    func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError  string
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		setupResources func(repoResources *resources.MockRepositoryResources)
	}{
		{
			name: "list folders error",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, nil, fmt.Errorf("failed to list folders")
			},
			expectedError: "load folder tree: error executing list: failed to list folders",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, mock.Anything).Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
			},
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
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, mock.Anything).Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
			},
		},
		{
			name: "ensure folder tree error",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				// Return empty list to get past the folder loading
				return true, &metav1.PartialObjectMetadataList{}, nil
			},
			expectedError: "write folders to repository: failed to ensure folder tree",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, mock.Anything).Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.Anything, mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
					return opts.Ref == "feature/branch" && opts.Path == "grafana"
				})).Return(fmt.Errorf("failed to ensure folder tree"))
			},
		},
		{
			name: "successful folder migration",
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
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-1-uid" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-2-uid" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
					require.Equal(t, "feature/branch", opts.Ref)
					require.Equal(t, "grafana", opts.Path)
					require.NoError(t, opts.OnFolder(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, true, nil))
					require.NoError(t, opts.OnFolder(resources.Folder{ID: "folder-2-uid", Path: "grafana/folder-2"}, true, nil))

					return true
				})).Return(nil)
			},
		},
		{
			name: "successful folder migration with resource export errors",
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
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-1-uid" && result.Action() == repository.FileActionCreated && result.Error() != nil && result.Error().Error() == "creating folder folder-1-uid at path grafana/folder-1: didn't work"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "folder-2-uid" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
					require.Equal(t, "feature/branch", opts.Ref)
					require.Equal(t, "grafana", opts.Path)
					require.NoError(t, opts.OnFolder(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, false, errors.New("didn't work")))
					require.NoError(t, opts.OnFolder(resources.Folder{ID: "folder-2-uid", Path: "grafana/folder-2"}, true, nil))

					return true
				})).Return(nil)
			},
		},
		{
			name: "too many errors",
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
					},
				}
				return true, list, nil
			},
			expectedError: "write folders to repository: too many errors encountered",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.Anything).Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors encountered"))
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 1
				}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
					require.Equal(t, "feature/branch", opts.Ref)
					require.Equal(t, "grafana", opts.Path)
					require.Error(t, opts.OnFolder(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, true, nil), "too many errors encountered")
					return true
				})).Return(fmt.Errorf("too many errors encountered"))
			},
		},
		{
			name: "successful nested folder migration",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.DashboardResource {
					// Return empty dashboard list
					return true, &metav1.PartialObjectMetadataList{
						TypeMeta: metav1.TypeMeta{
							APIVersion: resources.DashboardResource.GroupVersion().String(),
							Kind:       "FolderList",
						},
					}, nil
				}

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
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "parent-folder" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name() == "child-folder" && result.Action() == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
					require.Equal(t, "feature/branch", opts.Ref)
					require.Equal(t, "grafana", opts.Path)
					require.NoError(t, opts.OnFolder(resources.Folder{ID: "parent-folder", Path: "grafana/parent-folder"}, true, nil))
					require.NoError(t, opts.OnFolder(resources.Folder{ID: "child-folder", Path: "grafana/parent-folder/child-folder"}, true, nil))

					return true
				})).Return(nil)
			},
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
			tt.setupProgress(mockProgress)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupResources(repoResources)

			err := ExportFolders(context.Background(), "test-repo", v0alpha1.ExportJobOptions{
				Path:   "grafana",
				Branch: "feature/branch",
			}, fakeFolderClient, repoResources, mockProgress)

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

func TestFolderMetaAccessor(t *testing.T) {
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

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
			return tree.Count() == 0 // Should be 0 since folder is managed by other manager
		}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
			return opts.Ref == "feature/branch" && opts.Path == "grafana"
		})).Return(nil)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Twice()
		// No Record calls expected since folder should be skipped
		err = ExportFolders(context.Background(), "test-repo", v0alpha1.ExportJobOptions{
			Path:   "grafana",
			Branch: "feature/branch",
		}, fakeFolderClient, mockRepoResources, progress)

		require.NoError(t, err)

		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
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

		mockRepoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Twice()
		mockRepoResources.On("EnsureFolderTreeExists", mock.Anything, mock.Anything, mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
			return opts.Ref == "feature/branch" && opts.Path == "grafana"
		})).Return(nil)

		err = ExportFolders(context.Background(), "test-repo", v0alpha1.ExportJobOptions{
			Path:   "grafana",
			Branch: "feature/branch",
		}, fakeFolderClient, mockRepoResources, progress)

		require.NoError(t, err)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
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

		mockRepoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Twice()
		err := ExportFolders(context.Background(), "test-repo", v0alpha1.ExportJobOptions{
			Path:   "grafana",
			Branch: "feature/branch",
		}, fakeFolderClient, mockRepoResources, progress)

		require.Error(t, err)
		require.Contains(t, err.Error(), "extract meta accessor")
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
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

		mockRepoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Twice()
		mockRepoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
			return tree.Count() == 0 // Should be empty since folder was skipped
		}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
			return opts.Ref == "feature/branch" && opts.Path == "grafana"
		})).Return(nil)

		err = ExportFolders(context.Background(), "test-repo", v0alpha1.ExportJobOptions{
			Path:   "grafana",
			Branch: "feature/branch",
		}, fakeFolderClient, mockRepoResources, progress)

		require.NoError(t, err)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
	t.Run("should skip classic-managed folder that has no identity", func(t *testing.T) {
		// Classic shim kinds are reported as managed without an identity.
		// Such a folder must still be skipped, since it is owned elsewhere.
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
			Kind: utils.ManagerKindClassicAPI, //nolint:staticcheck
		})
		fakeFolderClient := &mockDynamicInterface{
			items: []unstructured.Unstructured{*obj},
		}

		mockRepoResources := resources.NewMockRepositoryResources(t)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return().Twice()
		mockRepoResources.On("EnsureFolderTreeExists", mock.Anything, mock.MatchedBy(func(tree resources.FolderTree) bool {
			return tree.Count() == 0 // Should be empty since folder was skipped
		}), mock.MatchedBy(func(opts resources.EnsureFolderTreeExistsOptions) bool {
			return opts.Ref == "feature/branch" && opts.Path == "grafana"
		})).Return(nil)

		err = ExportFolders(context.Background(), "test-repo", v0alpha1.ExportJobOptions{
			Path:   "grafana",
			Branch: "feature/branch",
		}, fakeFolderClient, mockRepoResources, progress)

		require.NoError(t, err)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
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

// TestWriteFolderTree_PathCollisionFails verifies that two distinct folders whose
// titles normalize to the same repository path fail the export loudly, instead of
// silently letting one folder's _folder.json represent the wrong UID/title.
func TestWriteFolderTree_PathCollisionFails(t *testing.T) {
	tree := resources.NewEmptyFolderTree()
	// Two distinct root folders whose titles both sanitize to "Reports".
	tree.Add(resources.Folder{ID: "uid-a", Title: "» Reports"}, "")
	tree.Add(resources.Folder{ID: "uid-b", Title: "Reports"}, "")

	// Leaving both mocks without expectations asserts EnsureFolderTreeExists (and
	// therefore any per-folder Record) is never reached once a collision is found.
	repoResources := resources.NewMockRepositoryResources(t)
	progress := jobs.NewMockJobProgressRecorder(t)

	err := writeFolderTree(context.Background(), v0alpha1.ExportJobOptions{}, repoResources, tree, progress)
	require.Error(t, err)
	require.Contains(t, err.Error(), "both export to path")
}

// TestWriteFolderTree_NoCollisionProceeds verifies that folders with distinct
// normalized paths pass the collision check and reach EnsureFolderTreeExists.
func TestWriteFolderTree_NoCollisionProceeds(t *testing.T) {
	tree := resources.NewEmptyFolderTree()
	tree.Add(resources.Folder{ID: "uid-a", Title: "Reports"}, "")
	tree.Add(resources.Folder{ID: "uid-b", Title: "Metrics"}, "")

	repoResources := resources.NewMockRepositoryResources(t)
	repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.Anything, mock.Anything).Return(nil)
	progress := jobs.NewMockJobProgressRecorder(t)

	err := writeFolderTree(context.Background(), v0alpha1.ExportJobOptions{}, repoResources, tree, progress)
	require.NoError(t, err)
}
