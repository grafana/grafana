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

type mockReaderWriter struct {
	*repository.MockRepository
	*repository.MockVersioned
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
			name: "successful full sync with root folder",
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

				repoResources.On("EnsureFolderExists", mock.Anything, mock.MatchedBy(func(folder resources.Folder) bool {
					return folder.Title == "test-repo" && folder.ID == "test-repo"
				}), "").Return(nil)

				repoResources.On("SetTree", mock.Anything).Return()
				repoResources.On("EnsureFolderPathExist", mock.Anything, mock.Anything).Return("", nil)
				repoResources.On("EnsureFolderTreeExists", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
				repoResources.On("CreateResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).Return("", nil)
				repoResources.On("WriteResourceFromFile", mock.Anything, mock.Anything, mock.Anything).Return("", schema.GroupVersionKind{}, nil)
				repoResources.On("RemoveResourceFromFile", mock.Anything, mock.Anything, mock.Anything).Return("", schema.GroupVersionKind{}, nil)
				repoResources.On("RenameResourceFile", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return("", schema.GroupVersionKind{}, nil)
				repoResources.On("Stats", mock.Anything).Return(&provisioning.ResourceStats{}, nil)
				repoResources.On("List", mock.Anything).Return(&provisioning.ResourceList{}, nil)

				progress.On("SetMessage", mock.Anything, "full sync").Return()
				fullSyncFn.EXPECT().Execute(mock.Anything, mock.Anything, mock.Anything, mock.Anything, "", mock.Anything, mock.Anything).Return(nil)
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

				repoResources.On("EnsureFolderExists", mock.Anything, mock.AnythingOfType("resources.Folder"), "").Return(nil)
				progress.On("SetMessage", mock.Anything, "incremental sync").Return()
				incrementalSyncFn.EXPECT().Execute(mock.Anything, mock.Anything, "old-ref", "new-ref", mock.Anything, mock.Anything).Return(nil)
			},
			expectedRef:      "new-ref",
			expectedMessages: []string{"incremental sync"},
		},
		{
			name: "no changes in incremental sync",
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
							LastRef: "same-ref",
						},
					},
				})
				repo.MockVersioned.On("LatestRef", mock.Anything).Return("same-ref", nil)

				repoResources.On("EnsureFolderExists", mock.Anything, mock.AnythingOfType("resources.Folder"), "").Return(nil)
				progress.On("SetFinalMessage", mock.Anything, "same commit as last sync").Return()
			},
			expectedRef:      "same-ref",
			expectedFinalMsg: "same commit as last sync",
		},
		{
			name: "root folder creation error",
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

				repoResources.On("EnsureFolderExists", mock.Anything, mock.AnythingOfType("resources.Folder"), "").
					Return(fmt.Errorf("folder creation failed"))
			},
			expectedError: "create root folder: folder creation failed",
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

				repoResources.On("EnsureFolderExists", mock.Anything, mock.AnythingOfType("resources.Folder"), "").Return(nil)
			},
			expectedError: "get latest ref: failed to get latest ref",
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
				nil,
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
