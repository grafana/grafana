package delete

import (
	"context"
	"errors"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
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
			worker := NewWorker(nil, nil)
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

	worker := NewWorker(nil, nil)
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

	worker := NewWorker(nil, mockWrapFn.Execute)
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

	worker := NewWorker(nil, mockWrapFn.Execute)
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

	worker := NewWorker(nil, mockWrapFn.Execute)
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

	worker := NewWorker(nil, mockWrapFn.Execute)
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

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute)
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

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute)
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

			worker := NewWorker(nil, nil)
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
