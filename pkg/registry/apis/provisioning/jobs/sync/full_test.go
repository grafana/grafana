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

	repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
	repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{}, nil)
	compareFn.On("Execute", mock.Anything, mock.Anything).Return([]ResourceFileChange{{}}, nil)
	repoResources.On("SetTree", mock.Anything).Return()
	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("SetMessage", mock.Anything, "replicating changes").Return()

	err := FullSync(ctx, repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.EqualError(t, err, "context canceled")
}

func TestFullSync(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*repository.MockRepository, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *MockCompareFn)
		expectedError string
		expectedCalls int
	}{
		{
			name: "successful sync with no changes",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{}, nil)
				compareFn.On("Execute", mock.MatchedBy(func(source []repository.FileTreeEntry) bool {
					return len(source) == 0
				}), mock.MatchedBy(func(target []repository.FileTreeEntry) bool {
					return len(target) == 0
				})).Return([]ResourceFileChange{}, nil)

				progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()
			},
		},
		{
			name: "error ensuring root folder exists",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(fmt.Errorf("folder creation failed"))
			},
			expectedError: "create root folder: folder creation failed",
		},
		{
			name: "error listing current resources",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

				repoResources.On("List", mock.Anything).Return(nil, fmt.Errorf("listing failed"))
			},
			expectedError: "error listing current: listing failed",
		},
		{
			name: "error reading tree",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return(nil, fmt.Errorf("read tree failed"))
			},
			expectedError: "error reading tree: read tree failed",
		},
		{
			name: "error comparing changes",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)
				repo.On("ReadTree", mock.Anything, "current-ref").Return([]repository.FileTreeEntry{}, nil)
				compareFn.On("Execute", mock.Anything, mock.Anything).Return(nil, fmt.Errorf("compare failed"))
			},
			expectedError: "error calculating changes: compare failed",
		},
		{
			name: "successful sync with changes",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

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
			expectedCalls: 1,
		},
		{
			name: "successful sync with folder creation",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

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
			expectedCalls: 1,
		},
		{
			name: "error creating folder during sync",
			setupMocks: func(repo *repository.MockRepository, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn) {
				repo.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})

				repoResources.On("EnsureFolderExists", mock.Anything, resources.Folder{
					ID:    "",
					Title: "Test Repo",
					Path:  "",
				}, "").Return(nil)

				repoResources.On("List", mock.Anything).Return(provisioning.ResourceList{}, nil)
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
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
