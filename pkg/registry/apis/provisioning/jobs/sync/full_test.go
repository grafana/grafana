package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestFullSync_ContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{{}}, nil)
	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("SetMessage", mock.Anything, "replicating changes").Return()

	err := FullSync(ctx, repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.EqualError(t, err, "context canceled")
}

func TestFullSync_Error(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, fmt.Errorf("some error"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.EqualError(t, err, "compare changes: some error")
}

func TestFullSync_NoChanges(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{}, nil)
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.NoError(t, err)
}

func TestFullSync_ApplyChanges(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockRepository, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *MockCompareFn)
		expectedError string
		description   string
	}{
		{
			name:        "successful apply with file creation",
			description: "Should successfully apply changes when creating a new file",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{
					{
						Path: "dashboards/test.json",
						Hash: "hash",
						Size: 100,
						Blob: true,
					},
				}, nil)

				changes := []ResourceFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/test.json",
					},
				}
				compareFn.On("Execute", mock.Anything, mock.Anything).Return(changes, nil)

				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("SetMessage", mock.Anything, "changes replicated").Return()
				progress.On("TooManyErrors").Return(nil)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("test-dashboard", schema.GroupVersionKind{Kind: "Dashboard", Group: "dashboards"}, nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionCreated,
					Path:     "dashboards/test.json",
					Name:     "test-dashboard",
					Resource: "Dashboard",
					Group:    "dashboards",
				}).Return()

				repoResources.On("SetTree", mock.Anything).Return()
			},
		},
		{
			name:        "successful apply with folder creation",
			description: "Should successfully apply changes when creating a new folder",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{
					{
						Path: "dashboards/",
						Hash: "hash",
						Size: 0,
						Blob: false,
					},
				}, nil)

				changes := []ResourceFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/",
					},
				}
				compareFn.On("Execute", mock.Anything, mock.Anything).Return(changes, nil)

				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("SetMessage", mock.Anything, "changes replicated").Return()
				progress.On("TooManyErrors").Return(nil)

				repoResources.On("EnsureFolderPathExist", mock.Anything, "dashboards/").
					Return("test-folder", nil)

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action:   repository.FileActionCreated,
					Path:     "dashboards/",
					Name:     "test-folder",
					Resource: resources.FolderResource.Resource,
					Group:    resources.FolderResource.Group,
				}).Return()

				repoResources.On("SetTree", mock.Anything).Return()
			},
		},
		{
			name:        "error creating folder",
			description: "Should return error when folder creation fails",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{
					{
						Path: "dashboards/",
						Hash: "hash",
						Size: 0,
						Blob: false,
					},
				}, nil)

				changes := []ResourceFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/",
					},
				}
				compareFn.On("Execute", mock.Anything, mock.Anything).Return(changes, nil)

				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("TooManyErrors").Return(nil)

				repoResources.On("EnsureFolderPathExist", mock.Anything, "dashboards/").
					Return("", fmt.Errorf("folder creation failed"))

				repoResources.On("SetTree", mock.Anything).Return()
			},
			expectedError: "create folder: folder creation failed",
		},
		{
			name:        "too many errors during apply",
			description: "Should stop processing when too many errors occur",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{
					{
						Path: "dashboards/test.json",
						Hash: "hash",
						Size: 100,
						Blob: true,
					},
				}, nil)

				changes := []ResourceFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/test.json",
					},
				}
				compareFn.On("Execute", mock.Anything, mock.Anything).Return(changes, nil)

				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("TooManyErrors").Return(fmt.Errorf("too many errors occurred"))

				repoResources.On("SetTree", mock.Anything).Return()
			},
			expectedError: "too many errors occurred",
		},
		{
			name:        "error writing resource",
			description: "Should handle errors when writing resources fails",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{
					{
						Path: "dashboards/test.json",
						Hash: "hash",
						Size: 100,
						Blob: true,
					},
				}, nil)

				changes := []ResourceFileChange{
					{
						Action: repository.FileActionCreated,
						Path:   "dashboards/test.json",
					},
				}
				compareFn.On("Execute", mock.Anything, mock.Anything).Return(changes, nil)

				progress.On("SetTotal", mock.Anything, 1).Return()
				progress.On("SetMessage", mock.Anything, "replicating changes").Return()
				progress.On("TooManyErrors").Return(nil)

				repoResources.On("WriteResourceFromFile", mock.Anything, "dashboards/test.json", "").
					Return("", schema.GroupVersionKind{}, fmt.Errorf("write failed"))

				progress.On("Record", mock.Anything, jobs.JobResourceResult{
					Action: repository.FileActionCreated,
					Path:   "dashboards/test.json",
					Error:  fmt.Errorf("write failed"),
				}).Return()

				repoResources.On("SetTree", mock.Anything).Return()
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repoResources := resources.NewMockRepositoryResources(t)
			clients := resources.NewMockResourceClients(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			compareFn := NewMockCompareFn(t)

			tt.setupMocks(repo, repoResources, clients, progress, compareFn)

			err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError, tt.description)
			} else {
				require.NoError(t, err, tt.description)
			}
		})
	}
}
