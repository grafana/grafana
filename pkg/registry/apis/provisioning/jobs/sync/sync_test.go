package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type mockReaderWriter struct {
	*repository.MockRepository
	*repository.MockVersioned
}

// FIXME: understand how the MockRepository was generated as it seems
// stale and it's causing collisions for the embedded
func (m *mockReaderWriter) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	return m.MockVersioned.History(ctx, path, ref)
}

func (m *mockReaderWriter) LatestRef(ctx context.Context) (string, error) {
	return m.MockVersioned.LatestRef(ctx)
}

func (m *mockReaderWriter) CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error) {
	return m.MockVersioned.CompareFiles(ctx, base, ref)
}

func (m *mockReaderWriter) Move(ctx context.Context, oldPath, newPath, ref, message string) error {
	args := m.MockRepository.Called(ctx, oldPath, newPath, ref, message)
	return args.Error(0)
}

func TestSyncer_Sync(t *testing.T) {
	tests := []struct {
		name             string
		options          provisioning.SyncJobOptions
		setupMocks       func(*mockReaderWriter, *resources.MockRepositoryResources, *resources.MockResourceClients, *jobs.MockJobProgressRecorder, *MockCompareFn, *MockFullSyncFn, *MockIncrementalSyncFn)
		expectedRef      string
		expectedError    string
		expectedMessages []string
		expectedFinalMsg string
	}{
		{
			name: "successful full sync",
			options: provisioning.SyncJobOptions{
				Incremental: false,
			},
			setupMocks: func(repo *mockReaderWriter, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn, fullSyncFn *MockFullSyncFn, incrementalSyncFn *MockIncrementalSyncFn) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Test Repo",
					},
				})
				repo.MockVersioned.On("LatestRef", mock.Anything).Return("new-ref", nil)

				progress.On("SetMessage", mock.Anything, "full sync").Return()
				fullSyncFn.EXPECT().Execute(mock.Anything, mock.Anything, mock.Anything, mock.Anything, "new-ref", mock.Anything, mock.Anything).Return(nil)
			},
			expectedMessages: []string{"full sync"},
		},
		{
			name: "successful incremental sync",
			options: provisioning.SyncJobOptions{
				Incremental: true,
			},
			setupMocks: func(repo *mockReaderWriter, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn, fullSyncFn *MockFullSyncFn, incrementalSyncFn *MockIncrementalSyncFn) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "old-ref",
						},
					},
				})
				repo.MockVersioned.On("LatestRef", mock.Anything).Return("new-ref", nil)
				progress.On("SetMessage", mock.Anything, "incremental sync").Return()
				incrementalSyncFn.EXPECT().Execute(mock.Anything, mock.Anything, "old-ref", "new-ref", mock.Anything, mock.Anything).Return(nil)
			},
			expectedRef:      "new-ref",
			expectedMessages: []string{"incremental sync"},
		},
		{
			name: "latest ref error",
			options: provisioning.SyncJobOptions{
				Incremental: true,
			},
			setupMocks: func(repo *mockReaderWriter, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn, fullSyncFn *MockFullSyncFn, incrementalSyncFn *MockIncrementalSyncFn) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "old-ref",
						},
					},
				})
				repo.MockVersioned.On("LatestRef", mock.Anything).Return("", fmt.Errorf("failed to get latest ref"))
			},
			expectedError: "get latest ref: failed to get latest ref",
		},
		{
			name: "incremental sync error",
			options: provisioning.SyncJobOptions{
				Incremental: true,
			},
			setupMocks: func(repo *mockReaderWriter, repoResources *resources.MockRepositoryResources, clients *resources.MockResourceClients, progress *jobs.MockJobProgressRecorder, compareFn *MockCompareFn, fullSyncFn *MockFullSyncFn, incrementalSyncFn *MockIncrementalSyncFn) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Status: provisioning.RepositoryStatus{
						Sync: provisioning.SyncStatus{
							LastRef: "old-ref",
						},
					},
				})
				repo.MockVersioned.On("LatestRef", mock.Anything).Return("new-ref", nil)
				progress.On("SetMessage", mock.Anything, "incremental sync").Return()
				incrementalSyncFn.On("Execute", mock.Anything, mock.Anything, "old-ref", "new-ref", mock.Anything, mock.Anything).Return(fmt.Errorf("incremental sync failed"))
			},
			expectedRef:      "new-ref",
			expectedMessages: []string{"incremental sync"},
			expectedError:    "incremental sync failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repoResources := resources.NewMockRepositoryResources(t)
			clients := resources.NewMockResourceClients(t)
			progress := jobs.NewMockJobProgressRecorder(t)
			compareFn := NewMockCompareFn(t)
			fullSyncFn := NewMockFullSyncFn(t)
			incrementalSyncFn := NewMockIncrementalSyncFn(t)

			repo := &mockReaderWriter{
				MockRepository: repository.NewMockRepository(t),
				MockVersioned:  repository.NewMockVersioned(t),
			}

			tt.setupMocks(repo, repoResources, clients, progress, compareFn, fullSyncFn, incrementalSyncFn)

			syncer := NewSyncer(
				compareFn.Execute,
				fullSyncFn.Execute,
				incrementalSyncFn.Execute,
			)

			ref, err := syncer.Sync(context.Background(), repo, tt.options, repoResources, clients, progress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
				if tt.expectedRef != "" {
					require.Equal(t, tt.expectedRef, ref)
				}
			}

			// Verify expected messages were set
			if len(tt.expectedMessages) > 0 {
				for _, msg := range tt.expectedMessages {
					progress.AssertCalled(t, "SetMessage", mock.Anything, msg)
				}
			}

			if tt.expectedFinalMsg != "" {
				progress.AssertCalled(t, "SetFinalMessage", mock.Anything, tt.expectedFinalMsg)
			}
		})
	}
}
