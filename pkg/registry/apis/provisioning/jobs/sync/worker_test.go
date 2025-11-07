package sync

import (
	"context"
	"errors"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSyncWorker_IsSupported(t *testing.T) {
	metrics := jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry())
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
			worker := NewSyncWorker(nil, nil, nil, nil, nil, metrics, tracing.NewNoopTracerService(), 10)
			result := worker.IsSupported(context.Background(), tt.job)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestSyncWorker_ProcessNotReaderWriter(t *testing.T) {
	repo := repository.NewMockReader(t)
	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "test-repo",
		},
	})
	fakeDualwrite := dualwrite.NewMockService(t)
	fakeDualwrite.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()
	worker := NewSyncWorker(nil, nil, fakeDualwrite, nil, nil, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), tracing.NewNoopTracerService(), 10)
	err := worker.Process(context.Background(), repo, provisioning.Job{}, jobs.NewMockJobProgressRecorder(t))
	require.EqualError(t, err, "sync job submitted for repository that does not support read-write")
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
				rw.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
				})

				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(false, nil).Twice()
			},
			expectedError: "sync not supported until storage has migrated",
		},
		{
			name: "failed initial status patching",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				// Setup repository config with existing LastRef
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "existing-ref",
						},
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()

				// Expect granular patches for state, job, and started fields
				rpf.On("Execute", mock.Anything, repoConfig, 
					mock.MatchedBy(func(patch map[string]interface{}) bool {
						return patch["op"] == "replace" && patch["path"] == "/status/sync/state"
					}),
					mock.MatchedBy(func(patch map[string]interface{}) bool {
						return patch["op"] == "replace" && patch["path"] == "/status/sync/job"
					}),
					mock.MatchedBy(func(patch map[string]interface{}) bool {
						return patch["op"] == "replace" && patch["path"] == "/status/sync/started"
					}),
				).Return(errors.New("failed to patch status"))
			},
			expectedError: "update repo with job status at start: failed to patch status",
		},
		{
			name: "failed getting repository resources",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				// Setup repository config
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "existing-ref",
						},
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)

				// Storage is migrated
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				// Initial status update succeeds - expect granular patches
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()
				rpf.On("Execute", mock.Anything, repoConfig, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Repository resources creation fails
				rrf.On("Client", mock.Anything, mock.Anything).Return(nil, errors.New("failed to create repository resources client"))

				// Progress.Complete should be called with the error
				pr.On("Complete", mock.Anything, mock.MatchedBy(func(err error) bool {
					return err != nil && err.Error() == "create repository resources client: failed to create repository resources client"
				})).Return(provisioning.JobStatus{State: provisioning.JobStateError})
			},
			expectedError: "create repository resources client: failed to create repository resources client",
		},
		{
			name: "failed getting clients for namespace",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				// Setup repository config
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "existing-ref",
						},
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)

				// Storage is migrated
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				// Initial status update succeeds - expect granular patches
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()
				rpf.On("Execute", mock.Anything, repoConfig, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Repository resources creation succeeds
				rrf.On("Client", mock.Anything, mock.Anything).Return(&resources.MockRepositoryResources{}, nil)

				// Getting clients for namespace fails
				cf.On("Clients", mock.Anything, "test-namespace").Return(nil, errors.New("failed to get clients"))

				// Progress.Complete should be called with the error
				pr.On("Complete", mock.Anything, mock.MatchedBy(func(err error) bool {
					return err != nil && err.Error() == "get clients for test-repo: failed to get clients"
				})).Return(provisioning.JobStatus{State: provisioning.JobStateError})
			},
			expectedError: "get clients for test-repo: failed to get clients",
		},
		{
			name: "successful sync",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "existing-ref",
						},
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)

				// Storage is migrated
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				// Initial status update - expect granular patches
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()
				rpf.On("Execute", mock.Anything, repoConfig, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Setup resources and clients
				mockRepoResources := resources.NewMockRepositoryResources(t)
				mockRepoResources.On("Stats", mock.Anything).Return(nil, nil)
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, "test-namespace").Return(mockClients, nil)

				// Sync execution succeeds
				pr.On("SetMessage", mock.Anything, "execute sync job").Return()
				pr.On("StrictMaxErrors", 20).Return()
				s.On("Sync", mock.Anything, rw, mock.MatchedBy(func(opts provisioning.SyncJobOptions) bool {
					return true // Add specific sync options validation if needed
				}), mockRepoResources, mock.Anything, pr).Return("new-ref", nil)

				// Final status updates
				pr.On("Complete", mock.Anything, nil).Return(provisioning.JobStatus{State: provisioning.JobStateSuccess})
				pr.On("SetMessage", mock.Anything, "update status and stats").Return()

				// Final patch should include new ref
				rpf.On("Execute", mock.Anything, repoConfig, mock.MatchedBy(func(patch map[string]interface{}) bool {
					if patch["op"] != "replace" || patch["path"] != "/status/sync" {
						return false
					}
					syncStatus := patch["value"].(provisioning.SyncStatus)
					return syncStatus.LastRef == "new-ref" && syncStatus.State == provisioning.JobStateSuccess
				})).Return(nil).Once()
			},
			expectedError: "",
		},
		{
			name: "failed sync",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "existing-ref",
						},
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)

				// Storage is migrated
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				// Initial status update - expect granular patches
				pr.On("SetMessage", mock.Anything, "update sync status at start").Return()
				rpf.On("Execute", mock.Anything, repoConfig, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Setup resources and clients
				mockRepoResources := resources.NewMockRepositoryResources(t)
				mockRepoResources.On("Stats", mock.Anything).Return(nil, nil)
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, "test-namespace").Return(mockClients, nil)

				// Sync execution fails
				pr.On("SetMessage", mock.Anything, "execute sync job").Return()
				pr.On("StrictMaxErrors", 20).Return()
				syncError := errors.New("sync operation failed")
				s.On("Sync", mock.Anything, rw, mock.MatchedBy(func(opts provisioning.SyncJobOptions) bool {
					return true // Add specific sync options validation if needed
				}), mockRepoResources, mock.Anything, pr).Return("", syncError)

				// Final status updates
				pr.On("Complete", mock.Anything, syncError).Return(provisioning.JobStatus{State: provisioning.JobStateError})
				pr.On("SetMessage", mock.Anything, "update status and stats").Return()

				// Final patch should preserve existing ref on failure
				rpf.On("Execute", mock.Anything, repoConfig, mock.MatchedBy(func(patch map[string]interface{}) bool {
					syncStatus := patch["value"].(provisioning.SyncStatus)
					return patch["op"] == "replace" &&
						patch["path"] == "/status/sync" &&
						syncStatus.LastRef == "existing-ref" && // LastRef should not change on failure
						syncStatus.State == provisioning.JobStateError
				})).Return(nil).Once()
			},
			expectedError: "sync operation failed",
		},
		{
			name: "stats call fails",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				mockRepoResources := resources.NewMockRepositoryResources(t)
				mockRepoResources.On("Stats", mock.Anything).Return(nil, errors.New("stats error"))
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				// Simple mocks for other calls
				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, mock.Anything).Return(mockClients, nil)
				pr.On("SetMessage", mock.Anything, mock.Anything).Return()
				pr.On("StrictMaxErrors", 20).Return()
				pr.On("Complete", mock.Anything, mock.Anything).Return(provisioning.JobStatus{State: provisioning.JobStateSuccess})
				// Initial patch with granular updates, final patch with full sync status
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("new-ref", nil)
			},
			expectedError: "",
		},
		{
			name: "stats returns nil stats and nil error",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				mockRepoResources := resources.NewMockRepositoryResources(t)
				mockRepoResources.On("Stats", mock.Anything).Return(nil, nil)
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				// Initial patch with granular updates
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Verify only sync status is patched for final update
				rpf.On("Execute", mock.Anything, mock.Anything, mock.MatchedBy(func(patch map[string]interface{}) bool {
					return patch["path"] == "/status/sync"
				})).Return(nil).Once()

				// Simple mocks for other calls
				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, mock.Anything).Return(mockClients, nil)
				pr.On("SetMessage", mock.Anything, mock.Anything).Return()
				pr.On("StrictMaxErrors", 20).Return()
				pr.On("Complete", mock.Anything, mock.Anything).Return(provisioning.JobStatus{State: provisioning.JobStateSuccess})
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("new-ref", nil)
			},
			expectedError: "",
		},
		{
			name: "stats returns one managed stats",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()
				// Initial patch with granular updates
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				mockRepoResources := resources.NewMockRepositoryResources(t)
				stats := &provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{
									Group:    "test",
									Resource: "test",
									Count:    42,
								},
							},
						},
					},
				}
				mockRepoResources.On("Stats", mock.Anything).Return(stats, nil)
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				// Verify both sync status and stats are patched
				rpf.On("Execute", mock.Anything, mock.Anything, mock.MatchedBy(func(patch map[string]interface{}) bool {
					return patch["path"] == "/status/sync"
				}), mock.MatchedBy(func(patch map[string]interface{}) bool {
					if patch["path"] != "/status/stats" {
						return false
					}

					value := patch["value"].([]provisioning.ResourceCount)
					if len(value) != 1 {
						return false
					}

					if value[0].Group != "test" || value[0].Resource != "test" || value[0].Count != 42 {
						return false
					}

					return true
				})).Return(nil).Once()

				// Simple mocks for other calls
				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, mock.Anything).Return(mockClients, nil)
				pr.On("SetMessage", mock.Anything, mock.Anything).Return()
				pr.On("StrictMaxErrors", 20).Return()
				pr.On("Complete", mock.Anything, mock.Anything).Return(provisioning.JobStatus{State: provisioning.JobStateSuccess})
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("new-ref", nil)
			},
			expectedError: "",
		},
		{
			name: "stats returns multiple managed stats",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				mockRepoResources := resources.NewMockRepositoryResources(t)
				stats := &provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{
									Group:    "test1",
									Resource: "test1",
									Count:    42,
								},
							},
						},
						{
							Stats: []provisioning.ResourceCount{
								{
									Group:    "test2",
									Resource: "test2",
									Count:    24,
								},
							},
						},
					},
				}
				mockRepoResources.On("Stats", mock.Anything).Return(stats, nil)
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				// Initial patch with granular updates
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Verify only sync status is patched (multiple stats should be ignored)
				rpf.On("Execute", mock.Anything, mock.Anything, mock.MatchedBy(func(patch map[string]interface{}) bool {
					return patch["path"] == "/status/sync"
				})).Return(nil).Once()

				// Simple mocks for other calls
				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, mock.Anything).Return(mockClients, nil)
				pr.On("SetMessage", mock.Anything, mock.Anything).Return()
				pr.On("StrictMaxErrors", 20).Return()
				pr.On("Complete", mock.Anything, mock.Anything).Return(provisioning.JobStatus{State: provisioning.JobStateSuccess})
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("new-ref", nil)
			},
			expectedError: "",
		},
		{
			name: "failed final status patch",
			setupMocks: func(cf *resources.MockClientFactory, rrf *resources.MockRepositoryResourcesFactory, ds *dualwrite.MockService, rpf *MockRepositoryPatchFn, s *MockSyncer, rw *mockReaderWriter, pr *jobs.MockJobProgressRecorder) {
				repoConfig := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-repo",
						Namespace: "test-namespace",
					},
				}
				rw.MockRepository.On("Config").Return(repoConfig)
				ds.On("ReadFromUnified", mock.Anything, mock.Anything).Return(true, nil).Twice()

				// Initial status patch succeeds - expect granular patches
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Once()

				// Setup resources and clients
				mockRepoResources := resources.NewMockRepositoryResources(t)
				mockRepoResources.On("Stats", mock.Anything).Return(nil, nil)
				rrf.On("Client", mock.Anything, mock.Anything).Return(mockRepoResources, nil)

				mockClients := resources.NewMockResourceClients(t)
				cf.On("Clients", mock.Anything, mock.Anything).Return(mockClients, nil)

				// Sync succeeds
				pr.On("SetMessage", mock.Anything, mock.Anything).Return()
				pr.On("StrictMaxErrors", 20).Return()
				s.On("Sync", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("new-ref", nil)
				pr.On("Complete", mock.Anything, nil).Return(provisioning.JobStatus{State: provisioning.JobStateSuccess})

				// Final status patch fails
				rpf.On("Execute", mock.Anything, mock.Anything, mock.Anything).Return(errors.New("failed to patch final status")).Once()
			},
			expectedError: "update repo with job final status: failed to patch final status",
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
				jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()),
				tracing.NewNoopTracerService(),
				10,
			)

			// Create test job
			job := provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
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

			// Verify mock expectations
			repositoryPatchFn.AssertExpectations(t)
			progressRecorder.AssertExpectations(t)
		})
	}
}
