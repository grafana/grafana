package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSyncWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name     string
		job      provisioning.Job
		expected bool
	}{
		{
			name: "pull action is supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPull,
				},
			},
			expected: true,
		},
		{
			name: "non-pull action is not supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPush,
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			worker := NewSyncWorker(nil, nil, nil, nil, nil)
			result := worker.IsSupported(context.Background(), tt.job)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestSyncWorker_Process(t *testing.T) {
	tests := []struct {
		name           string
		setupMocks     func(*resources.MockClientFactory, *resources.MockRepositoryResourcesFactory, *dualwrite.MockService, *MockRepositoryPatchFn, *MockSyncer, *mockReaderWriter, *jobs.MockJobProgressRecorder)
		expectedError  string
		expectedStatus *provisioning.SyncStatus
	}{
		{
			name: "legacy storage not migrated",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				ds.On("IsReadingLegacyDashboardsAndFolders").Return(true)
			},
			expectedError: "sync not supported until storage has migrated",
		},
		{
			name: "successful sync",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				ds.On("IsReadingLegacyDashboardsAndFolders").Return(false)

				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "old-ref",
						},
					},
				}
				rw.MockRepository.On("Config").Return(repo)

				// Mock repository resources client creation
				mockRepoResources := &resources.MockRepositoryResources{}
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				// Mock resource clients creation
				mockClients := &resources.MockResourceClients{}
				cf.On("Clients", mock.Anything, repo.Namespace).Return(mockClients, nil)

				// Mock sync operation
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mockRepoResources, mockClients, mock.Anything).Return("new-ref", nil)

				// Mock progress recorder
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()
				pr.On("SetMessage", mock.Anything, "execute sync job").Return()
				pr.On("SetMessage", mock.Anything, "update status and stats").Return()
				pr.On("Complete", mock.Anything, nil).Return(provisioning.JobStatus{
					State: provisioning.JobStateSuccess,
				})

				// Mock repository resources stats
				mockRepoResources.On("Stats", mock.Anything).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{Stats: []provisioning.ResourceCount{
							{Group: "group1", Resource: "resource1", Count: 1},
						}},
					},
				}, nil)

				// Mock patch operations
				rpf.On("Execute", mock.Anything, repo, mock.Anything).Return(nil).Twice()
			},
		},
		{
			name: "sync error",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				ds.On("IsReadingLegacyDashboardsAndFolders").Return(false)

				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				rw.MockRepository.On("Config").Return(repo)

				// Mock repository resources client creation
				mockRepoResources := &resources.MockRepositoryResources{}
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				// Mock resource clients creation
				mockClients := &resources.MockResourceClients{}
				cf.On("Clients", mock.Anything, repo.Namespace).Return(mockClients, nil)

				// Mock sync operation with error
				syncError := fmt.Errorf("sync failed")
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mockRepoResources, mockClients, mock.Anything).Return("", syncError)

				// Mock progress recorder
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()
				pr.On("SetMessage", mock.Anything, "execute sync job").Return()
				pr.On("SetMessage", mock.Anything, "update status and stats").Return()
				pr.On("Complete", mock.Anything, syncError).Return(provisioning.JobStatus{
					State: provisioning.JobStateError,
				})

				// Mock repository resources stats
				mockRepoResources.On("Stats", mock.Anything).Return(nil, nil)

				// Mock patch operations
				rpf.On("Execute", mock.Anything, repo, mock.Anything).Return(nil).Twice()
			},
			expectedError: "sync failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mocks
			clientFactory := resources.NewMockClientFactory(t)
			repoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
			dualwriteService := dualwrite.NewMockService(t)
			repositoryPatchFn := NewMockRepositoryPatchFn(t)
			syncer := NewMockSyncer(t)
			readerWriter := &mockReaderWriter{
				MockRepository: repository.NewMockRepository(t),
				MockVersioned:  repository.NewMockVersioned(t),
			}
			progressRecorder := jobs.NewMockJobProgressRecorder(t)

			// Setup mocks
			tt.setupMocks(clientFactory, repoResourcesFactory, dualwriteService, repositoryPatchFn, syncer, readerWriter, progressRecorder)

			// Create worker
			worker := NewSyncWorker(
				clientFactory,
				repoResourcesFactory,
				dualwriteService,
				repositoryPatchFn.Execute,
				syncer,
			)

			// Create test job
			job := provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPull,
					Pull:   &provisioning.SyncJobOptions{},
				},
			}

			// Execute test
			err := worker.Process(context.Background(), readerWriter, job, progressRecorder)

			// Verify results
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
