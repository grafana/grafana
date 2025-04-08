package export

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	v0alpha1 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"
)

func TestExportWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name string
		job  v0alpha1.Job
		want bool
	}{
		{
			name: "push job",
			job: v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPush,
				},
			},
			want: true,
		},
		{
			name: "pull job",
			job: v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPull,
				},
			},
			want: false,
		},
		{
			name: "migrate job",
			job: v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionMigrate,
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewExportWorker(nil, nil)
			got := r.IsSupported(context.Background(), tt.job)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestExportWorker_ProcessNoExportSettings(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
		},
	}

	r := NewExportWorker(nil, nil)
	err := r.Process(context.Background(), nil, job, nil)
	require.EqualError(t, err, "missing export settings")
}

func TestExportWorker_ProcessWriteNotAllowed(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch: "main",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			// no write permissions
			Workflows: []v0alpha1.Workflow{},
		},
	})

	r := NewExportWorker(nil, nil)
	err := r.Process(context.Background(), mockRepo, job, nil)
	require.EqualError(t, err, "this repository is read only")
}
func TestExportWorker_ProcessBranchNotAllowedForLocal(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch: "somebranch",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			Type: v0alpha1.LocalRepositoryType,
			// try to override the branch workflow
			Workflows: []v0alpha1.Workflow{v0alpha1.BranchWorkflow},
		},
	})

	r := NewExportWorker(nil, nil)
	err := r.Process(context.Background(), mockRepo, job, nil)
	require.EqualError(t, err, "this repository does not support the branch workflow")
}

func TestExportWorker_ProcessFailedToCreateClients(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(nil, errors.New("failed to create clients"))
	r := NewExportWorker(mockClients, nil)

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create clients: failed to create clients")
}

func TestExportWorker_ProcessNotReaderWriter(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockReader(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	resourceClients := resources.NewMockResourceClients(t)
	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)
	resourceClients.On("Folder").Return(nil, nil)
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	r := NewExportWorker(mockClients, nil)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "export job submitted targeting repository that is not a ReaderWriter")
}

func TestExportWorker_ProcessFolderClientError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	resourceClients := resources.NewMockResourceClients(t)
	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)
	resourceClients.On("Folder").Return(nil, fmt.Errorf("failed to create folder client"))

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	r := NewExportWorker(mockClients, nil)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create folder client: failed to create folder client")
}

func TestExportWorker_ProcessRepositoryResourcesError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("Folder").Return(nil, nil)
	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResources.On("Client", context.Background(), mockRepo).Return(nil, fmt.Errorf("failed to create repository resources client"))

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	r := NewExportWorker(mockClients, mockRepoResources)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create repository resource client: failed to create repository resources client")
}

func TestExportWorker_ProcessFolders(t *testing.T) {
	tests := []struct {
		name           string
		reactorFunc    func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError  string
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		setupResources func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind)
		verifyMocks    func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources)
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
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
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
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
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
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.Anything, mock.Anything).Return(fmt.Errorf("failed to ensure folder tree"))
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
		{
			name: "successful folder migration",
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
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "folder-1-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "folder-2-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, true, nil))
					require.NoError(t, fn(resources.Folder{ID: "folder-2-uid", Path: "grafana/folder-2"}, true, nil))

					return true
				})).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
		{
			name: "successful folder migration with resource export errors",
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
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "folder-1-uid" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "didn't work"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "folder-2-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 2
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.NoError(t, fn(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, false, errors.New("didn't work")))
					require.NoError(t, fn(resources.Folder{ID: "folder-2-uid", Path: "grafana/folder-2"}, true, nil))

					return true
				})).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
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
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 1
				}), mock.MatchedBy(func(fn func(folder resources.Folder, created bool, err error) error) bool {
					require.Error(t, fn(resources.Folder{ID: "folder-1-uid", Path: "grafana/folder-1"}, true, nil), "too many errors encountered")
					return true
				})).Return(fmt.Errorf("too many errors encountered"))
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
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
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "parent-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "child-uid" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
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
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPush,
					Push: &v0alpha1.ExportJobOptions{
						Path: "grafana",
					},
				},
			}

			mockRepo := repository.NewMockRepository(t)
			mockRepo.On("Config").Return(&v0alpha1.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "test-namespace",
				},
				Spec: v0alpha1.RepositorySpec{
					Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
				},
			})

			scheme := runtime.NewScheme()
			require.NoError(t, metav1.AddMetaToScheme(scheme))
			listGVK := schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    "FolderList",
			}
			listGVKDashboard := schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    "DashboardList",
			}

			scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(listGVKDashboard, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    resources.FolderResource.Resource,
			}, &metav1.PartialObjectMetadata{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    resources.DashboardResource.Resource,
			}, &metav1.PartialObjectMetadata{})

			fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
				resources.FolderResource:    listGVK.Kind,
				resources.DashboardResource: listGVKDashboard.Kind,
			})
			fakeFolderClient := fakeDynamicClient.Resource(resources.FolderResource)

			resourceClients := resources.NewMockResourceClients(t)
			resourceClients.On("Folder").Return(fakeFolderClient, nil)

			mockClientFactory := resources.NewMockClientFactory(t)
			mockClientFactory.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)

			fakeDynamicClient.PrependReactor("list", "folders", tt.reactorFunc)
			fakeDynamicClient.PrependReactor("list", "dashboards", tt.reactorFunc)

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupResources(repoResources, resourceClients, fakeDynamicClient, listGVKDashboard)
			mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
			mockRepoResources.On("Client", mock.Anything, mockRepo).Return(repoResources, nil)

			r := NewExportWorker(mockClientFactory, mockRepoResources)
			err := r.Process(context.Background(), mockRepo, job, mockProgress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			tt.verifyMocks(t, mockProgress, repoResources)
		})
	}
}

func TestExportWorker_ProcessDashboards(t *testing.T) {
	tests := []struct {
		name           string
		reactorFunc    func(action k8testing.Action) (bool, runtime.Object, error)
		expectedError  string
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		setupResources func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind)
		verifyMocks    func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources)
	}{
		{
			name: "successful dashboard export",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.FolderResource {
					// Return empty folder list
					return true, &metav1.PartialObjectMetadataList{
						TypeMeta: metav1.TypeMeta{
							APIVersion: resources.FolderResource.GroupVersion().String(),
							Kind:       "FolderList",
						},
					}, nil
				}
				// Return dashboard list
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-1",
							},
						},
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-2",
							},
						},
					},
				}, nil
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 0
				}), mock.Anything).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)

				options := resources.WriteOptions{
					Path: "grafana",
					// TODO: add tests for branch
					Ref: "",
				}

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("dashboard-1.json", nil)

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-2"
				}), options).Return("dashboard-2.json", nil)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
		{
			name: "dashboard list error",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.FolderResource {
					// Return empty folder list
					return true, &metav1.PartialObjectMetadataList{}, nil
				}
				// Return error for dashboard list
				return true, nil, fmt.Errorf("failed to list dashboards")
			},
			expectedError: "export dashboards: error executing list: failed to list dashboards",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 0
				}), mock.Anything).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
		{
			name: "dashboard export with errors",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.FolderResource {
					return true, &metav1.PartialObjectMetadataList{}, nil
				}
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-1",
							},
						},
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-2",
							},
						},
					},
				}, nil
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
				})).Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-2" && result.Action == repository.FileActionCreated
				})).Return()
				progress.On("TooManyErrors").Return(nil)
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 0
				}), mock.Anything).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)

				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "",
				}

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("", fmt.Errorf("failed to export dashboard"))

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-2"
				}), options).Return("dashboard-2.json", nil)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
		{
			name: "dashboard export too many errors",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.FolderResource {
					return true, &metav1.PartialObjectMetadataList{}, nil
				}
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "dashboard-1",
							},
						},
					},
				}, nil
			},
			expectedError: "export dashboards: too many errors encountered",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "dashboard-1" && result.Action == repository.FileActionIgnored && result.Error != nil && result.Error.Error() == "failed to export dashboard"
				})).Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors encountered"))
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 0
				}), mock.Anything).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)

				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "",
				}

				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "dashboard-1"
				}), options).Return("", fmt.Errorf("failed to export dashboard"))
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
		{
			name: "ignores existing dashboards",
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.FolderResource {
					return true, &metav1.PartialObjectMetadataList{}, nil
				}
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
					Items: []metav1.PartialObjectMetadata{
						{
							TypeMeta: metav1.TypeMeta{
								APIVersion: resources.DashboardResource.GroupVersion().String(),
								Kind:       "Dashboard",
							},
							ObjectMeta: metav1.ObjectMeta{
								Name: "existing-dashboard",
							},
						},
					},
				}, nil
			},
			expectedError: "",
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
					return result.Name == "existing-dashboard" && result.Action == repository.FileActionIgnored
				})).Return()
				progress.On("TooManyErrors").Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 0
				}), mock.Anything).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)

				options := resources.WriteOptions{
					Path: "grafana",
					Ref:  "",
				}

				// Return true to indicate the file already exists, and provide the updated path
				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
					return obj.GetName() == "existing-dashboard"
				}), options).Return("", resources.ErrAlreadyInRepository)
			},
			verifyMocks: func(t *testing.T, progress *jobs.MockJobProgressRecorder, repoResources *resources.MockRepositoryResources) {
				progress.AssertExpectations(t)
				repoResources.AssertExpectations(t)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPush,
					Push: &v0alpha1.ExportJobOptions{
						Path: "grafana",
					},
				},
			}

			mockRepo := repository.NewMockRepository(t)
			mockRepo.On("Config").Return(&v0alpha1.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "test-namespace",
				},
				Spec: v0alpha1.RepositorySpec{
					Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
				},
			})

			scheme := runtime.NewScheme()
			require.NoError(t, metav1.AddMetaToScheme(scheme))
			listGVK := schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    "FolderList",
			}
			listGVKDashboard := schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    "DashboardList",
			}

			scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(listGVKDashboard, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    resources.FolderResource.Resource,
			}, &metav1.PartialObjectMetadata{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    resources.DashboardResource.Resource,
			}, &metav1.PartialObjectMetadata{})

			fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
				resources.FolderResource:    listGVK.Kind,
				resources.DashboardResource: listGVKDashboard.Kind,
			})
			fakeFolderClient := fakeDynamicClient.Resource(resources.FolderResource)

			resourceClients := resources.NewMockResourceClients(t)
			resourceClients.On("Folder").Return(fakeFolderClient, nil)

			mockClientFactory := resources.NewMockClientFactory(t)
			mockClientFactory.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)

			fakeDynamicClient.PrependReactor("list", "folders", tt.reactorFunc)
			fakeDynamicClient.PrependReactor("list", "dashboards", tt.reactorFunc)

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupResources(repoResources, resourceClients, fakeDynamicClient, listGVKDashboard)
			mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
			mockRepoResources.On("Client", mock.Anything, mockRepo).Return(repoResources, nil)

			r := NewExportWorker(mockClientFactory, mockRepoResources)
			err := r.Process(context.Background(), mockRepo, job, mockProgress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			tt.verifyMocks(t, mockProgress, repoResources)
		})
	}
}

type MockClonableRepository struct {
	*repository.MockClonableRepository
	*repository.MockClonedRepository
}

func TestExportWorker_ClonableRepository(t *testing.T) {
	tests := []struct {
		name           string
		createRepo     func(t *testing.T) *MockClonableRepository
		reactorFunc    func(action k8testing.Action) (bool, runtime.Object, error)
		setupRepo      func(repo *repository.MockClonedRepository)
		setupResources func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind)
		setupProgress  func(progress *jobs.MockJobProgressRecorder)
		expectedError  string
	}{
		{
			name: "successful clone and push",
			createRepo: func(t *testing.T) *MockClonableRepository {
				cloned := repository.NewMockClonedRepository(t)
				clonable := repository.NewMockClonableRepository(t)
				clonable.On("Clone", mock.Anything, mock.MatchedBy(func(opts repository.CloneOptions) bool {
					if opts.PushOnWrites || opts.Timeout != 10*time.Minute {
						return false
					}

					if opts.BeforeFn != nil {
						require.NoError(t, opts.BeforeFn())
					}

					return true
				})).Return(cloned, nil)

				return &MockClonableRepository{
					MockClonedRepository:   cloned,
					MockClonableRepository: clonable,
				}
			},
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				if action.GetResource() == resources.FolderResource {
					// Return empty folder list
					return true, &metav1.PartialObjectMetadataList{
						TypeMeta: metav1.TypeMeta{
							APIVersion: resources.FolderResource.GroupVersion().String(),
							Kind:       "FolderList",
						},
					}, nil
				}
				// Return empty dashboard list
				return true, &metav1.PartialObjectMetadataList{
					TypeMeta: metav1.TypeMeta{
						APIVersion: resources.DashboardResource.GroupVersion().String(),
						Kind:       "DashboardList",
					},
				}, nil
			},
			setupRepo: func(repo *repository.MockClonedRepository) {
				repo.On("Config").Return(&v0alpha1.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: v0alpha1.RepositorySpec{
						Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
					},
				})
				repo.On("Push", mock.Anything, mock.MatchedBy(func(opts repository.PushOptions) bool {
					if opts.Timeout != 10*time.Minute {
						return false
					}

					if opts.BeforeFn != nil {
						require.NoError(t, opts.BeforeFn())
					}

					return true
				})).Return(nil)
				repo.On("Remove", mock.Anything).Return(nil)
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				repoResources.On("EnsureFolderTreeExists", mock.Anything, "", "grafana", mock.MatchedBy(func(tree resources.FolderTree) bool {
					return tree.Count() == 0
				}), mock.Anything).Return(nil)
				resourceClients.On("ForResource", resources.DashboardResource).Return(dynamicClient.Resource(resources.DashboardResource), gvk, nil)
			},
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "clone target").Return()
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
				progress.On("SetMessage", mock.Anything, "write folders to repository").Return()
				progress.On("SetMessage", mock.Anything, "start resource export").Return()
				progress.On("SetMessage", mock.Anything, "export dashboards").Return()
				progress.On("SetMessage", mock.Anything, "push changes").Return()
			},
			expectedError: "",
		},
		{
			name: "clone failure",
			createRepo: func(t *testing.T) *MockClonableRepository {
				cloned := repository.NewMockClonedRepository(t)
				clonable := repository.NewMockClonableRepository(t)
				clonable.On("Clone", mock.Anything, mock.MatchedBy(func(opts repository.CloneOptions) bool {
					if opts.BeforeFn != nil {
						require.NoError(t, opts.BeforeFn())
					}

					return true
				})).Return(nil, fmt.Errorf("failed to clone repository"))

				return &MockClonableRepository{
					MockClonedRepository:   cloned,
					MockClonableRepository: clonable,
				}
			},
			setupRepo: func(repo *repository.MockClonedRepository) {
				repo.On("Config").Return(&v0alpha1.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: v0alpha1.RepositorySpec{
						Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
					},
				})
			},
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "clone target").Return()
			},
			expectedError: "clone repository: failed to clone repository",
		},
		{
			name: "any other failure cleans up the cloned repository",
			createRepo: func(t *testing.T) *MockClonableRepository {
				cloned := repository.NewMockClonedRepository(t)
				clonable := repository.NewMockClonableRepository(t)
				clonable.On("Clone", mock.Anything, mock.MatchedBy(func(opts repository.CloneOptions) bool {
					if opts.BeforeFn != nil {
						require.NoError(t, opts.BeforeFn())
					}

					return true
				})).Return(cloned, nil)

				return &MockClonableRepository{
					MockClonedRepository:   cloned,
					MockClonableRepository: clonable,
				}
			},
			reactorFunc: func(action k8testing.Action) (bool, runtime.Object, error) {
				return true, nil, fmt.Errorf("some error")
			},
			setupResources: func(repoResources *resources.MockRepositoryResources, resourceClients *resources.MockResourceClients, dynamicClient *dynamicfake.FakeDynamicClient, gvk schema.GroupVersionKind) {
				// nothing special to do here
			},
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "clone target").Return()
				progress.On("SetMessage", mock.Anything, "read folder tree from API server").Return()
			},
			setupRepo: func(repo *repository.MockClonedRepository) {
				repo.On("Config").Return(&v0alpha1.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: v0alpha1.RepositorySpec{
						Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
					},
				})
				repo.On("Remove", mock.Anything).Maybe().Return(nil)
			},
			expectedError: "load folder tree: error executing list: some error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPush,
					Push: &v0alpha1.ExportJobOptions{
						Path: "grafana",
					},
				},
			}

			mockRepo := tt.createRepo(t)
			tt.setupRepo(mockRepo.MockClonedRepository)

			scheme := runtime.NewScheme()
			require.NoError(t, metav1.AddMetaToScheme(scheme))
			listGVK := schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    "FolderList",
			}
			listGVKDashboard := schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    "DashboardList",
			}

			scheme.AddKnownTypeWithName(listGVK, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(listGVKDashboard, &metav1.PartialObjectMetadataList{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.FolderResource.Group,
				Version: resources.FolderResource.Version,
				Kind:    resources.FolderResource.Resource,
			}, &metav1.PartialObjectMetadata{})
			scheme.AddKnownTypeWithName(schema.GroupVersionKind{
				Group:   resources.DashboardResource.Group,
				Version: resources.DashboardResource.Version,
				Kind:    resources.DashboardResource.Resource,
			}, &metav1.PartialObjectMetadata{})

			fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
				resources.FolderResource:    listGVK.Kind,
				resources.DashboardResource: listGVKDashboard.Kind,
			})
			fakeFolderClient := fakeDynamicClient.Resource(resources.FolderResource)

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
			mockClientFactory := resources.NewMockClientFactory(t)
			var repoResources *resources.MockRepositoryResources

			if tt.setupResources != nil {
				resourceClients := resources.NewMockResourceClients(t)
				resourceClients.On("Folder").Return(fakeFolderClient, nil)

				fakeDynamicClient.PrependReactor("list", "folders", tt.reactorFunc)
				fakeDynamicClient.PrependReactor("list", "dashboards", tt.reactorFunc)
				mockClientFactory.On("Clients", mock.Anything, "test-namespace").Return(resourceClients, nil)

				repoResources = resources.NewMockRepositoryResources(t)
				tt.setupResources(repoResources, resourceClients, fakeDynamicClient, listGVKDashboard)
				mockRepoResources.On("Client", mock.Anything, mock.MatchedBy(func(repo repository.ReaderWriter) bool {
					// compare only pointers
					return repo == mockRepo.MockClonedRepository
				})).Return(repoResources, nil)
			}

			r := NewExportWorker(mockClientFactory, mockRepoResources)
			err := r.Process(context.Background(), mockRepo, job, mockProgress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockProgress.AssertExpectations(t)
			mockRepoResources.AssertExpectations(t)
			mockClientFactory.AssertExpectations(t)

			if repoResources != nil {
				repoResources.AssertExpectations(t)
			}
		})
	}
}
