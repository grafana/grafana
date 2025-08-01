package delete

import (
	"context"
	"errors"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockReaderWriter struct {
	*repository.MockRepository
}

func (m *mockReaderWriter) Delete(ctx context.Context, path, ref, message string) error {
	args := m.Called(ctx, path, ref, message)
	return args.Error(0)
}

// simpleRepository implements only the base Repository interface, not ReaderWriter
type simpleRepository struct{}

func (s *simpleRepository) Config() *provisioning.Repository { return nil }
func (s *simpleRepository) Validate() field.ErrorList        { return nil }
func (s *simpleRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return nil, nil
}

func TestDeleteWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name     string
		job      provisioning.Job
		expected bool
	}{
		{
			name: "delete action is supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
				},
			},
			expected: true,
		},
		{
			name: "pull action is not supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPull,
				},
			},
			expected: false,
		},
		{
			name: "push action is not supported",
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
			worker := NewWorker(nil, nil, nil)
			result := worker.IsSupported(context.Background(), tt.job)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestDeleteWorker_ProcessMissingDeleteSettings(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
		},
	}

	worker := NewWorker(nil, nil, nil)
	err := worker.Process(context.Background(), nil, job, nil)
	require.EqualError(t, err, "missing delete settings")
}

func TestDeleteWorker_ProcessNotReaderWriter(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path"},
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return !opts.PushOnWrites &&
			opts.Timeout == 10*time.Minute &&
			opts.Mode == repository.StageModeCommitOnlyOnce &&
			opts.CommitOnlyOnceMessage == "Delete from Grafana "+job.Name
	}), mock.Anything).Return(errors.New("delete job submitted targeting repository that is not a ReaderWriter"))

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "delete files from repository: delete job submitted targeting repository that is not a ReaderWriter")
}

func TestDeleteWorker_ProcessWrapFnError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path"},
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(errors.New("stage failed"))
	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "delete files from repository: stage failed")
}

func TestDeleteWorker_ProcessDeleteFilesSuccess(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path1", "test/path2"},
				Ref:   "main",
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return !opts.PushOnWrites &&
			opts.Timeout == 10*time.Minute &&
			opts.Mode == repository.StageModeCommitOnlyOnce &&
			opts.CommitOnlyOnceMessage == "Delete from Grafana "+job.Name
	}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 2).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting test/path1").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting test/path2").Return()
	mockProgress.On("TooManyErrors").Return(nil).Twice()

	mockRepo.On("Delete", mock.Anything, "test/path1", "main", "Delete test/path1").Return(nil)
	mockRepo.On("Delete", mock.Anything, "test/path2", "main", "Delete test/path2").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path1" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path2" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestDeleteWorker_ProcessDeleteFilesWithError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path1", "test/path2"},
				Ref:   "main",
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 2).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting test/path1").Return()

	deleteError := errors.New("delete failed")
	mockRepo.On("Delete", mock.Anything, "test/path1", "main", "Delete test/path1").Return(deleteError)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path1" && result.Action == repository.FileActionDeleted && errors.Is(result.Error, deleteError)
	})).Return()
	mockProgress.On("TooManyErrors").Return(errors.New("too many errors"))

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "delete files from repository: too many errors")
}

func TestDeleteWorker_ProcessWithSyncWorker(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path"},
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockSyncWorker := jobs.NewMockWorker(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting test/path").Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockRepo.On("Delete", mock.Anything, "test/path", "", "Delete test/path").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()

	mockProgress.On("ResetResults").Return()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Return()

	mockSyncWorker.On("Process", mock.Anything, mockRepo, mock.MatchedBy(func(syncJob provisioning.Job) bool {
		return syncJob.Spec.Pull != nil && !syncJob.Spec.Pull.Incremental
	}), mockProgress).Return(nil)

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, nil)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestDeleteWorker_ProcessSyncWorkerError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path"},
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockSyncWorker := jobs.NewMockWorker(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting test/path").Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockRepo.On("Delete", mock.Anything, "test/path", "", "Delete test/path").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.Anything).Return()
	mockProgress.On("ResetResults").Return()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Return()

	syncError := errors.New("sync failed")
	mockSyncWorker.On("Process", mock.Anything, mockRepo, mock.Anything, mockProgress).Return(syncError)

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, nil)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "pull resources: sync failed")
}

func TestDeleteWorker_deleteFiles(t *testing.T) {
	tests := []struct {
		name          string
		paths         []string
		deleteResults []error
		tooManyErrors error
		expectedError string
		expectedCalls int
	}{
		{
			name:          "single file success",
			paths:         []string{"test/file1.yaml"},
			deleteResults: []error{nil},
			expectedCalls: 1,
		},
		{
			name:          "multiple files success",
			paths:         []string{"test/file1.yaml", "test/file2.yaml", "test/file3.yaml"},
			deleteResults: []error{nil, nil, nil},
			expectedCalls: 3,
		},
		{
			name:          "single file with error continues",
			paths:         []string{"test/file1.yaml", "test/file2.yaml"},
			deleteResults: []error{errors.New("delete failed"), nil},
			expectedCalls: 2,
		},
		{
			name:          "too many errors stops processing",
			paths:         []string{"test/file1.yaml", "test/file2.yaml", "test/file3.yaml"},
			deleteResults: []error{errors.New("delete failed")},
			tooManyErrors: errors.New("too many errors"),
			expectedError: "too many errors",
			expectedCalls: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockReaderWriter{
				MockRepository: repository.NewMockRepository(t),
			}
			mockProgress := jobs.NewMockJobProgressRecorder(t)

			opts := provisioning.DeleteJobOptions{
				Ref: "main",
			}

			for i, path := range tt.paths {
				if i < len(tt.deleteResults) {
					mockRepo.On("Delete", mock.Anything, path, "main", "Delete "+path).Return(tt.deleteResults[i]).Once()
					mockProgress.On("SetMessage", mock.Anything, "Deleting "+path).Return().Once()
					mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
						return result.Path == path && result.Action == repository.FileActionDeleted
					})).Return().Once()

					if tt.tooManyErrors != nil && i == 0 {
						mockProgress.On("TooManyErrors").Return(tt.tooManyErrors).Once()
					} else {
						mockProgress.On("TooManyErrors").Return(nil).Once()
					}
				}
			}

			worker := NewWorker(nil, nil, nil)
			err := worker.deleteFiles(context.Background(), mockRepo, mockProgress, opts, tt.paths...)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
			mockProgress.AssertExpectations(t)
		})
	}
}

func TestDeleteWorker_ProcessWithResourceRefs(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"test/path1"},
				Resources: []provisioning.ResourceRef{
					{
						Name:  "test-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
					{
						Name:  "test-folder",
						Kind:  "Folder",
						Group: "folder.grafana.app",
					},
				},
				Ref: "main",
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	mockRepositoryResources := resources.NewMockRepositoryResources(t)

	// Mock repository resources factory and client
	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepositoryResources, nil)

	// Mock FindResourcePath calls
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "test-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
		// Version is empty - ForKind will discover the preferred version
	}).Return("dashboards/test-dashboard.json", nil)

	mockRepositoryResources.On("FindResourcePath", mock.Anything, "test-folder", schema.GroupVersionKind{
		Group: "folder.grafana.app",
		Kind:  "Folder",
		// Version is empty - ForKind will discover the preferred version
	}).Return("folders/test-folder.json", nil)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return !opts.PushOnWrites && opts.Timeout == 10*time.Minute
	}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	// Progress tracking - expects 3 total (1 path + 2 resources)
	mockProgress.On("SetTotal", mock.Anything, 3).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/test-dashboard").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource folder.grafana.app/Folder/test-folder").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting test/path1").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting dashboards/test-dashboard.json").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting folders/test-folder.json").Return()
	mockProgress.On("TooManyErrors").Return(nil).Times(3)

	// Mock file deletions
	mockRepo.On("Delete", mock.Anything, "test/path1", "main", "Delete test/path1").Return(nil)
	mockRepo.On("Delete", mock.Anything, "dashboards/test-dashboard.json", "main", "Delete dashboards/test-dashboard.json").Return(nil)
	mockRepo.On("Delete", mock.Anything, "folders/test-folder.json", "main", "Delete folders/test-folder.json").Return(nil)

	// Mock progress records
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path1" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "dashboards/test-dashboard.json" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "folders/test-folder.json" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)

	mockResourcesFactory.AssertExpectations(t)
	mockRepositoryResources.AssertExpectations(t)
}

func TestDeleteWorker_ProcessResourceRefsOnly(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{
						Name:  "test-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
				Ref: "main",
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	mockRepositoryResources := resources.NewMockRepositoryResources(t)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepositoryResources, nil)

	mockRepositoryResources.On("FindResourcePath", mock.Anything, "test-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
		// Version is empty - ForKind will discover the preferred version
	}).Return("dashboards/test-dashboard.json", nil)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/test-dashboard").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting dashboards/test-dashboard.json").Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockRepo.On("Delete", mock.Anything, "dashboards/test-dashboard.json", "main", "Delete dashboards/test-dashboard.json").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "dashboards/test-dashboard.json" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestDeleteWorker_ProcessResourceResolutionError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{
						Name:  "nonexistent-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	mockRepositoryResources := resources.NewMockRepositoryResources(t)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepositoryResources, nil)

	findPathError := errors.New("resource not found in repository: dashboard.grafana.app/dashboards/nonexistent-dashboard")
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "nonexistent-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
		// Version is empty - ForKind will discover the preferred version
	}).Return("", findPathError)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/nonexistent-dashboard").Return()

	// Expect error to be recorded, not thrown
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Name == "nonexistent-dashboard" &&
			result.Group == "dashboard.grafana.app" &&
			result.Action == repository.FileActionDeleted &&
			result.Error != nil
	})).Return()
	mockProgress.On("TooManyErrors").Return(nil)

	// Mock sync worker behavior that happens when no ref is specified
	mockProgress.On("ResetResults").Return()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Return()

	mockSyncWorker := jobs.NewMockWorker(t)
	mockSyncWorker.On("Process", mock.Anything, mockRepo, mock.MatchedBy(func(syncJob provisioning.Job) bool {
		return syncJob.Spec.Pull != nil && !syncJob.Spec.Pull.Incremental
	}), mockProgress).Return(nil)

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err) // Should succeed even with resource resolution error
}

func TestDeleteWorker_ProcessResourcesFactoryError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{
						Name:  "test-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)

	factoryError := errors.New("failed to create repository resources client")
	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(nil, factoryError)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "delete files from repository: create repository resources client: failed to create repository resources client")
}

func TestDeleteWorker_ProcessResourceRefsNotReaderWriter(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{
						Name:  "test-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
			},
		},
	}

	// Create a simple repository that doesn't implement ReaderWriter
	mockRepo := &simpleRepository{}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)

	// Mock the wrap function that will call our function and get the ReaderWriter error
	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	// The ReaderWriter check should fail immediately, so no resource resolution calls should happen
	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "delete files from repository: delete job submitted targeting repository that is not a ReaderWriter")
}

func TestDeleteWorker_ProcessResourceResolutionTooManyErrors(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{
						Name:  "nonexistent-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	mockRepositoryResources := resources.NewMockRepositoryResources(t)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepositoryResources, nil)

	findPathError := errors.New("resource not found in repository")
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "nonexistent-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
		// Version is empty - ForKind will discover the preferred version
	}).Return("", findPathError)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/nonexistent-dashboard").Return()

	// Mock recording error and TooManyErrors returning error
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Name == "nonexistent-dashboard" && result.Error != nil
	})).Return()
	mockProgress.On("TooManyErrors").Return(errors.New("too many errors"))

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "delete files from repository: too many errors")
}

func TestDeleteWorker_ProcessMixedResourcesWithPartialFailure(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Resources: []provisioning.ResourceRef{
					{
						Name:  "valid-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
					{
						Name:  "nonexistent-dashboard",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
					{
						Name:  "valid-folder",
						Kind:  "Folder",
						Group: "folder.grafana.app",
					},
				},
				Ref: "main",
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	mockRepositoryResources := resources.NewMockRepositoryResources(t)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepositoryResources, nil)

	// First resource succeeds
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "valid-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
		// Version is empty - ForKind will discover the preferred version
	}).Return("dashboards/valid-dashboard.json", nil)

	// Second resource fails
	findPathError := errors.New("resource not found")
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "nonexistent-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
		// Version is empty - ForKind will discover the preferred version
	}).Return("", findPathError)

	// Third resource succeeds
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "valid-folder", schema.GroupVersionKind{
		Group: "folder.grafana.app",
		Kind:  "Folder",
		// Version is empty - ForKind will discover the preferred version
	}).Return("folders/valid-folder.json", nil)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 3).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/valid-dashboard").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/nonexistent-dashboard").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource folder.grafana.app/Folder/valid-folder").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting dashboards/valid-dashboard.json").Return()
	mockProgress.On("SetMessage", mock.Anything, "Deleting folders/valid-folder.json").Return()

	// Record the error for the failed resource
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Name == "nonexistent-dashboard" && result.Error != nil
	})).Return()

	// Allow continuing after error
	mockProgress.On("TooManyErrors").Return(nil).Times(3) // Called after each resource resolution and file deletion

	// Mock successful file deletions for resolved resources
	mockRepo.On("Delete", mock.Anything, "dashboards/valid-dashboard.json", "main", "Delete dashboards/valid-dashboard.json").Return(nil)
	mockRepo.On("Delete", mock.Anything, "folders/valid-folder.json", "main", "Delete folders/valid-folder.json").Return(nil)

	// Record successful deletions
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "dashboards/valid-dashboard.json" && result.Error == nil
	})).Return()
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "folders/valid-folder.json" && result.Error == nil
	})).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err) // Should succeed overall, with only the failed resource recorded as error
}

func TestDeleteWorker_ProcessWithPathDeduplication(t *testing.T) {
	// Test that duplicate paths from explicit paths and resource resolution are deduplicated
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Ref:   "main",                                                             // Add ref to avoid sync worker execution
				Paths: []string{"dashboards/test-dashboard.json", "folders/test-folder/"}, // Explicit paths
				Resources: []provisioning.ResourceRef{
					{
						Name:  "test-dashboard", // This will resolve to "dashboards/test-dashboard.json" (duplicate)
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
					{
						Name:  "test-folder", // This will resolve to "folders/test-folder/" (duplicate)
						Kind:  "Folder",
						Group: "folder.grafana.app",
					},
					{
						Name:  "unique-dashboard", // This will resolve to "dashboards/unique-dashboard.json" (unique)
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	// Mock resources factory and repository resources
	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
	mockRepositoryResources := resources.NewMockRepositoryResources(t)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepositoryResources, nil)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	// Expect total of 5 items (2 explicit paths + 3 resources), but only 3 unique paths will be deleted
	mockProgress.On("SetTotal", mock.Anything, 5).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()

	// Resource resolution phase
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()

	// Mock resource path resolution - note duplicates with explicit paths
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/test-dashboard").Return()
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "test-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
	}).Return("dashboards/test-dashboard.json", nil) // Duplicate of explicit path

	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource folder.grafana.app/Folder/test-folder").Return()
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "test-folder", schema.GroupVersionKind{
		Group: "folder.grafana.app",
		Kind:  "Folder",
	}).Return("folders/test-folder/", nil) // Duplicate of explicit path

	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/unique-dashboard").Return()
	mockRepositoryResources.On("FindResourcePath", mock.Anything, "unique-dashboard", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
	}).Return("dashboards/unique-dashboard.json", nil) // Unique path

	// Note: successful resource resolution does not call Record - only failures do

	// Deletion phase - should only delete 3 unique paths (deduplication working)
	mockProgress.On("SetMessage", mock.Anything, "Deleting dashboards/test-dashboard.json").Return()
	mockRepo.On("Delete", mock.Anything, "dashboards/test-dashboard.json", "main", "Delete dashboards/test-dashboard.json").Return(nil)
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "dashboards/test-dashboard.json" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockProgress.On("SetMessage", mock.Anything, "Deleting folders/test-folder/").Return()
	mockRepo.On("Delete", mock.Anything, "folders/test-folder/", "main", "Delete folders/test-folder/").Return(nil)
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "folders/test-folder/" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()

	mockProgress.On("SetMessage", mock.Anything, "Deleting dashboards/unique-dashboard.json").Return()
	mockRepo.On("Delete", mock.Anything, "dashboards/unique-dashboard.json", "main", "Delete dashboards/unique-dashboard.json").Return(nil)
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "dashboards/unique-dashboard.json" && result.Action == repository.FileActionDeleted && result.Error == nil
	})).Return()

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)

	// Verify all mocks were called as expected - key point is that each file is only deleted once
	mockRepo.AssertExpectations(t)
	mockProgress.AssertExpectations(t)
	mockResourcesFactory.AssertExpectations(t)
	mockRepositoryResources.AssertExpectations(t)
}

func TestDeduplicatePaths(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
		{
			name:     "empty slice",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "single path",
			input:    []string{"path1"},
			expected: []string{"path1"},
		},
		{
			name:     "no duplicates",
			input:    []string{"path1", "path2", "path3"},
			expected: []string{"path1", "path2", "path3"},
		},
		{
			name:     "with duplicates",
			input:    []string{"path1", "path2", "path1", "path3", "path2"},
			expected: []string{"path1", "path2", "path3"},
		},
		{
			name:     "all same paths",
			input:    []string{"path1", "path1", "path1"},
			expected: []string{"path1"},
		},
		{
			name:     "mixed paths with folder trailing slash",
			input:    []string{"folder/", "file.json", "folder/", "nested/file.json", "file.json"},
			expected: []string{"folder/", "file.json", "nested/file.json"},
		},
		{
			name:     "preserves order",
			input:    []string{"c", "a", "b", "a", "c"},
			expected: []string{"c", "a", "b"},
		},
		{
			name:     "realistic scenario - explicit paths and resource refs resolve to same paths",
			input:    []string{"dashboards/dashboard1.json", "folder/", "dashboards/dashboard1.json", "alerts/alert1.yaml", "folder/"},
			expected: []string{"dashboards/dashboard1.json", "folder/", "alerts/alert1.yaml"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := deduplicatePaths(tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}
