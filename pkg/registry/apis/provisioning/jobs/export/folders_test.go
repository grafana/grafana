package export

import (
	"context"
	"errors"
	"fmt"
	"testing"

	v0alpha1 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.Anything, mock.Anything).Return(fmt.Errorf("failed to ensure folder tree"))
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
					return result.Name == "folder-1-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "folder-2-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, true, nil))
					require.NoError(t, fn(resources.Folder{ID: "folder-2-uid", Path: "grafana/folder-2"}, true, nil))

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
					return result.Name == "folder-1-uid" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "didn't work"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "folder-2-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, false, errors.New("didn't work")))
					require.NoError(t, fn(resources.Folder{ID: "folder-2-uid", Path: "grafana/folder-2"}, true, nil))

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
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 1
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.Error(t, fn(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, true, nil), "too many errors encountered")
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
					return result.Name == "parent-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "child-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "feature/branch", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					expectedFolders := []resources.Folder{
						{ID: "parent-folder", Path: "parent-folder"},
						{ID: "child-folder", Path: "parent-folder/child-folder"},
					}

					if tree.Count() != len(expectedFolders) {
						return false
					}

					for _, folder := range expectedFolders {
						dir, ok := tree.DirPath(folder.ID, "")
						if !ok || dir.Path != folder.Path {
							return false
						}
					}

					return true
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					// Parent folder should be processed first
					require.NoError(t, fn(resources.Folder{ID: "parent-uid", Path: "grafana/parent-folder"}, true, nil))
					// Then child folder with nested path
					require.NoError(t, fn(resources.Folder{ID: "child-uid", Path: "grafana/parent-folder/child-folder"}, true, nil))
					return true
				})).Return(nil)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := runtime.NewScheme()
			require.NoError(t, metav1.AddMetaToScheme(scheme))
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
