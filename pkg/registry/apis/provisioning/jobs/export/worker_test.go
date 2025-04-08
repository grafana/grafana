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
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
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
			r := NewExportWorker(nil, nil, nil)
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

	r := NewExportWorker(nil, nil, nil)
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

	r := NewExportWorker(nil, nil, nil)
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

	r := NewExportWorker(nil, nil, nil)
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
	r := NewExportWorker(mockClients, nil, nil)

	mockProgress := jobs.NewMockJobProgressRecorder(t)

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

	r := NewExportWorker(mockClients, nil, nil)
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
	r := NewExportWorker(mockClients, nil, nil)
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
	r := NewExportWorker(mockClients, mockRepoResources, nil)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create repository resource client: failed to create repository resources client")
}

type MockClonableRepository struct {
	*repository.MockClonableRepository
	*repository.MockClonedRepository
}

func TestExportWorker_ClonableRepository(t *testing.T) {
	tests := []struct {
		name          string
		createRepo    func(t *testing.T) *MockClonableRepository
		setupRepo     func(repo *repository.MockClonedRepository)
		setupProgress func(progress *jobs.MockJobProgressRecorder)
		exportRun     bool
		exportErr     error
		expectedError string
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
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "clone target").Return()
				progress.On("SetMessage", mock.Anything, "push changes").Return()
			},
			expectedError: "",
			exportRun:     true,
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
			exportRun:     false,
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
			exportErr: fmt.Errorf("some error"),
			exportRun: true,
			setupProgress: func(progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "clone target").Return()
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
			expectedError: "some error",
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

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			tt.setupProgress(mockProgress)

			mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
			mockClientFactory := resources.NewMockClientFactory(t)

			resourceClients := resources.NewMockResourceClients(t)
			repoResources := resources.NewMockRepositoryResources(t)
			mockExportFn := NewMockExportFn(t)

			if tt.exportRun {
				resourceClients.On("Folder").Return(fakeFolderClient, nil)

				mockClientFactory.On("Clients", mock.Anything, "test-namespace").Return(resourceClients, nil)

				mockRepoResources.On("Client", mock.Anything, mock.MatchedBy(func(repo repository.ReaderWriter) bool {
					// compare only pointers
					return repo == mockRepo.MockClonedRepository
				})).Return(repoResources, nil)
				mockExportFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(tt.exportErr)
			}

			r := NewExportWorker(mockClientFactory, mockRepoResources, mockExportFn.Execute)
			err := r.Process(context.Background(), mockRepo, job, mockProgress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockProgress.AssertExpectations(t)
			mockRepoResources.AssertExpectations(t)
			mockClientFactory.AssertExpectations(t)
			repoResources.AssertExpectations(t)
		})
	}
}
