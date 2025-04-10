package sync

import (
	"context"
	"errors"
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
	worker := NewSyncWorker(nil, nil, fakeDualwrite, nil, nil)
	err := worker.Process(context.Background(), repo, provisioning.Job{}, jobs.NewMockJobProgressRecorder(t))
	require.EqualError(t, err, "sync job submitted for repository that does not support read-write -- this is a bug")
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

				rpf.On("Execute", mock.Anything, repoConfig, mock.MatchedBy(func(patch []map[string]interface{}) bool {
					if len(patch) != 1 {
						return false
					}

					if patch[0]["op"] != "replace" || patch[0]["path"] != "/status/sync" {
						return false
					}

					if patch[0]["value"].(provisioning.SyncStatus).LastRef != "existing-ref" || patch[0]["value"].(provisioning.SyncStatus).JobID != "test-job" {
						return false
					}

					return true
				})).Return(errors.New("failed to patch status"))
			},
			expectedError: "update repo with job status at start: failed to patch status",
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
