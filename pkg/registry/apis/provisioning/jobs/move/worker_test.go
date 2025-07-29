package move

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockReaderWriter struct {
	*repository.MockRepository
}

func (m *mockReaderWriter) Move(ctx context.Context, oldPath, newPath, ref, message string) error {
	args := m.Called(ctx, oldPath, newPath, ref, message)
	return args.Error(0)
}

func TestMoveWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name     string
		job      provisioning.Job
		expected bool
	}{
		{
			name: "move action is supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionMove,
				},
			},
			expected: true,
		},
		{
			name: "delete action is not supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
				},
			},
			expected: false,
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

func TestMoveWorker_ProcessMissingMoveSettings(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
		},
	}

	worker := NewWorker(nil, nil)
	err := worker.Process(context.Background(), nil, job, nil)
	require.EqualError(t, err, "missing move settings")
}

func TestMoveWorker_ProcessMissingTargetPath(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths: []string{"test/path"},
			},
		},
	}

	worker := NewWorker(nil, nil)
	err := worker.Process(context.Background(), nil, job, nil)
	require.EqualError(t, err, "target path is required for move operation")
}

func TestMoveWorker_ProcessInvalidTargetPath(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path"},
				TargetPath: "target.txt", // This is not a directory path
			},
		},
	}

	worker := NewWorker(nil, nil)
	err := worker.Process(context.Background(), nil, job, nil)
	require.EqualError(t, err, "target path must be a directory (should end with '/')")
}

func TestMoveWorker_ProcessNotReaderWriter(t *testing.T) {
	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-job",
		},
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path"},
				TargetPath: "new/location/",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return !opts.PushOnWrites && opts.Timeout == 10*time.Minute &&
			opts.Mode == repository.StageModeCommitOnlyOnce &&
			opts.CommitOnlyOnceMessage == "Move files from Grafana test-job"
	}), mock.Anything).Return(errors.New("move job submitted targeting repository that is not a ReaderWriter"))

	mockProgress.On("SetTotal", mock.Anything, 1).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()

	worker := NewWorker(nil, mockWrapFn.Execute)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "move files in repository: move job submitted targeting repository that is not a ReaderWriter")
}

func TestMoveWorker_ProcessWrapFnError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path"},
				TargetPath: "new/location/",
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
	require.EqualError(t, err, "move files in repository: stage failed")
}

func TestMoveWorker_ProcessMoveFilesSuccess(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path1", "test/path2"},
				TargetPath: "new/location/",
				Ref:        "main",
			},
		},
	}

	mockRepo := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
	}
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockWrapFn := repository.NewMockWrapWithStageFn(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return !opts.PushOnWrites && opts.Timeout == 10*time.Minute &&
			opts.Mode == repository.StageModeCommitOnlyOnce &&
			opts.CommitOnlyOnceMessage != ""
	}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 2).Return()
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Moving test/path1 to new/location/path1").Return()
	mockProgress.On("SetMessage", mock.Anything, "Moving test/path2 to new/location/path2").Return()
	mockProgress.On("TooManyErrors").Return(nil).Twice()

	mockRepo.On("Move", mock.Anything, "test/path1", "new/location/path1", "main", "Move test/path1 to new/location/path1").Return(nil)
	mockRepo.On("Move", mock.Anything, "test/path2", "new/location/path2", "main", "Move test/path2 to new/location/path2").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path1" && result.Action == repository.FileActionRenamed && result.Error == nil
	})).Return()
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path2" && result.Action == repository.FileActionRenamed && result.Error == nil
	})).Return()

	worker := NewWorker(nil, mockWrapFn.Execute)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestMoveWorker_ProcessMoveFilesWithError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path1", "test/path2"},
				TargetPath: "new/location/",
				Ref:        "main",
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
	mockProgress.On("SetMessage", mock.Anything, "Moving test/path1 to new/location/path1").Return()

	moveError := errors.New("move failed")
	mockRepo.On("Move", mock.Anything, "test/path1", "new/location/path1", "main", "Move test/path1 to new/location/path1").Return(moveError)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path1" && result.Action == repository.FileActionRenamed && errors.Is(result.Error, moveError)
	})).Return()
	mockProgress.On("TooManyErrors").Return(errors.New("too many errors"))

	worker := NewWorker(nil, mockWrapFn.Execute)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "move files in repository: too many errors")
}

func TestMoveWorker_ProcessWithSyncWorker(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path"},
				TargetPath: "new/location/",
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
	mockProgress.On("SetMessage", mock.Anything, "Moving test/path to new/location/path").Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockRepo.On("Move", mock.Anything, "test/path", "new/location/path", "", "Move test/path to new/location/path").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path" && result.Action == repository.FileActionRenamed && result.Error == nil
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

func TestMoveWorker_ProcessSyncWorkerError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path"},
				TargetPath: "new/location/",
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
	mockProgress.On("SetMessage", mock.Anything, "Moving test/path to new/location/path").Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockRepo.On("Move", mock.Anything, "test/path", "new/location/path", "", "Move test/path to new/location/path").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.Anything).Return()
	mockProgress.On("ResetResults").Return()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Return()

	syncError := errors.New("sync failed")
	mockSyncWorker.On("Process", mock.Anything, mockRepo, mock.Anything, mockProgress).Return(syncError)

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "pull resources: sync failed")
}

func TestMoveWorker_moveFiles(t *testing.T) {
	tests := []struct {
		name          string
		paths         []string
		moveResults   []error
		tooManyErrors error
		expectedError string
		expectedCalls int
	}{
		{
			name:          "single file success",
			paths:         []string{"test/file1.yaml"},
			moveResults:   []error{nil},
			expectedCalls: 1,
		},
		{
			name:          "multiple files success",
			paths:         []string{"test/file1.yaml", "test/file2.yaml", "test/file3.yaml"},
			moveResults:   []error{nil, nil, nil},
			expectedCalls: 3,
		},
		{
			name:          "mixed files and folders",
			paths:         []string{"file.json", "folder/", "nested/file.yaml"},
			moveResults:   []error{nil, nil, nil},
			expectedCalls: 3,
		},
		{
			name:          "single file with error continues",
			paths:         []string{"test/file1.yaml", "test/file2.yaml"},
			moveResults:   []error{errors.New("move failed"), nil},
			expectedCalls: 2,
		},
		{
			name:          "too many errors stops processing",
			paths:         []string{"test/file1.yaml", "test/file2.yaml", "test/file3.yaml"},
			moveResults:   []error{errors.New("move failed")},
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

			opts := provisioning.MoveJobOptions{
				TargetPath: "new/location/",
				Ref:        "main",
			}

			for i, path := range tt.paths {
				if i < len(tt.moveResults) {
					// Use the same logic as constructTargetPath to build expected target
					expectedTarget := "new/location/" + filepath.Base(path)
					if safepath.IsDir(path) {
						expectedTarget += "/"
					}
					mockRepo.On("Move", mock.Anything, path, expectedTarget, "main", "Move "+path+" to "+expectedTarget).Return(tt.moveResults[i]).Once()
					mockProgress.On("SetMessage", mock.Anything, "Moving "+path+" to "+expectedTarget).Return().Once()
					mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
						return result.Path == path && result.Action == repository.FileActionRenamed
					})).Return().Once()

					if tt.tooManyErrors != nil && i == 0 {
						mockProgress.On("TooManyErrors").Return(tt.tooManyErrors).Once()
					} else {
						mockProgress.On("TooManyErrors").Return(nil).Once()
					}
				}
			}

			worker := NewWorker(nil, nil)
			err := worker.moveFiles(context.Background(), mockRepo, mockProgress, opts, tt.paths...)

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

func TestMoveWorker_constructTargetPath(t *testing.T) {
	tests := []struct {
		name           string
		jobTargetPath  string
		sourcePath     string
		expectedTarget string
	}{
		{
			name:           "simple file in directory",
			jobTargetPath:  "moved/",
			sourcePath:     "dashboard.json",
			expectedTarget: "moved/dashboard.json",
		},
		{
			name:           "nested file in directory",
			jobTargetPath:  "archived/",
			sourcePath:     "folder/dashboard.json",
			expectedTarget: "archived/dashboard.json",
		},
		{
			name:           "deeply nested directory target",
			jobTargetPath:  "deep/nested/target/",
			sourcePath:     "source/file.yaml",
			expectedTarget: "deep/nested/target/file.yaml",
		},
		{
			name:           "folder to folder",
			jobTargetPath:  "new-location/",
			sourcePath:     "old-folder/",
			expectedTarget: "new-location/old-folder/",
		},
		{
			name:           "nested folder move",
			jobTargetPath:  "archive/",
			sourcePath:     "deep/nested/folder/",
			expectedTarget: "archive/folder/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			worker := NewWorker(nil, nil)
			result := worker.constructTargetPath(tt.jobTargetPath, tt.sourcePath)
			require.Equal(t, tt.expectedTarget, result)
		})
	}
}
