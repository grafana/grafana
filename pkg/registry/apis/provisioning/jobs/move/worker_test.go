package move

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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
			worker := NewWorker(nil, nil, nil)
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

	worker := NewWorker(nil, nil, nil)
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

	worker := NewWorker(nil, nil, nil)
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

	worker := NewWorker(nil, nil, nil)
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

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
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

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
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
			opts.CommitOnlyOnceMessage != "" && opts.Ref == "main"
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

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
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

	worker := NewWorker(nil, mockWrapFn.Execute, nil)
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

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, nil)
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

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, nil)
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

			worker := NewWorker(nil, nil, nil)
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
			worker := NewWorker(nil, nil, nil)
			result := worker.constructTargetPath(tt.jobTargetPath, tt.sourcePath)
			require.Equal(t, tt.expectedTarget, result)
		})
	}
}

func TestMoveWorker_ProcessWithResourceReferences(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"test/path1"},
				TargetPath: "new/location/",
				Resources: []provisioning.ResourceRef{
					{
						Name:  "dashboard-uid",
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
	mockRepoResources := resources.NewMockRepositoryResources(t)
	mockSyncWorker := jobs.NewMockWorker(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 2).Return() // 1 path + 1 resource
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/dashboard-uid").Return()
	mockProgress.On("SetMessage", mock.Anything, "Moving test/path1 to new/location/path1").Return()
	mockProgress.On("SetMessage", mock.Anything, "Moving dashboard/file.yaml to new/location/file.yaml").Return()
	mockProgress.On("TooManyErrors").Return(nil).Times(2)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepoResources, nil)
	mockRepoResources.On("FindResourcePath", mock.Anything, "dashboard-uid", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
	}).Return("dashboard/file.yaml", nil)

	mockRepo.On("Move", mock.Anything, "test/path1", "new/location/path1", "", "Move test/path1 to new/location/path1").Return(nil)
	mockRepo.On("Move", mock.Anything, "dashboard/file.yaml", "new/location/file.yaml", "", "Move dashboard/file.yaml to new/location/file.yaml").Return(nil)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "test/path1" && result.Action == repository.FileActionRenamed && result.Error == nil
	})).Return()
	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Path == "dashboard/file.yaml" && result.Action == repository.FileActionRenamed && result.Error == nil
	})).Return()

	// Add expectations for sync worker (called when ref is empty)
	mockProgress.On("ResetResults").Return()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Return()
	mockSyncWorker.On("Process", mock.Anything, mockRepo, mock.MatchedBy(func(syncJob provisioning.Job) bool {
		return syncJob.Spec.Pull != nil && !syncJob.Spec.Pull.Incremental
	}), mockProgress).Return(nil)

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestMoveWorker_ProcessResourceReferencesError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				TargetPath: "new/location/",
				Resources: []provisioning.ResourceRef{
					{
						Name:  "non-existent-uid",
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
	mockRepoResources := resources.NewMockRepositoryResources(t)

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return() // 1 resource
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
	mockProgress.On("SetMessage", mock.Anything, "Finding path for resource dashboard.grafana.app/Dashboard/non-existent-uid").Return()
	mockProgress.On("TooManyErrors").Return(nil)

	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepoResources, nil)
	resourceError := errors.New("resource not found")
	mockRepoResources.On("FindResourcePath", mock.Anything, "non-existent-uid", schema.GroupVersionKind{
		Group: "dashboard.grafana.app",
		Kind:  "Dashboard",
	}).Return("", resourceError)

	mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
		return result.Name == "non-existent-uid" && result.Group == "dashboard.grafana.app" &&
			result.Action == repository.FileActionRenamed &&
			result.Error != nil && result.Error.Error() == "find path for resource dashboard.grafana.app/Dashboard/non-existent-uid: resource not found"
	})).Return()

	// Add expectations for sync worker (called when ref is empty)
	mockSyncWorker := jobs.NewMockWorker(t)
	mockProgress.On("ResetResults").Return()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Return()
	mockSyncWorker.On("Process", mock.Anything, mockRepo, mock.MatchedBy(func(syncJob provisioning.Job) bool {
		return syncJob.Spec.Pull != nil && !syncJob.Spec.Pull.Incremental
	}), mockProgress).Return(nil)

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err) // Should continue despite individual resource errors
}

func TestMoveWorker_ProcessResourcesFactoryError(t *testing.T) {
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				TargetPath: "new/location/",
				Resources: []provisioning.ResourceRef{
					{
						Name:  "dashboard-uid",
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

	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOptions repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockRepo, false)
	})

	mockProgress.On("SetTotal", mock.Anything, 1).Return() // 1 resource
	mockProgress.On("StrictMaxErrors", 1).Return()
	mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()

	factoryError := errors.New("failed to create resources client")
	mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(nil, factoryError)

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "move files in repository: create repository resources client: failed to create resources client")
}

func TestMoveWorker_resolveResourcesToPaths(t *testing.T) {
	tests := []struct {
		name           string
		resources      []provisioning.ResourceRef
		resourcePaths  map[string]string
		resourceErrors map[string]error
		tooManyErrors  error
		expectedPaths  []string
		expectedError  string
		expectContinue bool
	}{
		{
			name: "single resource success",
			resources: []provisioning.ResourceRef{
				{
					Name:  "dashboard-uid",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				},
			},
			resourcePaths: map[string]string{
				"dashboard-uid": "dashboards/test.json",
			},
			expectedPaths: []string{"dashboards/test.json"},
		},
		{
			name: "multiple resources success",
			resources: []provisioning.ResourceRef{
				{
					Name:  "dashboard1",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				},
				{
					Name:  "dashboard2",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				},
			},
			resourcePaths: map[string]string{
				"dashboard1": "dashboards/dash1.json",
				"dashboard2": "dashboards/dash2.json",
			},
			expectedPaths: []string{"dashboards/dash1.json", "dashboards/dash2.json"},
		},
		{
			name: "resource not found continues",
			resources: []provisioning.ResourceRef{
				{
					Name:  "non-existent",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				},
				{
					Name:  "existing",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				},
			},
			resourcePaths: map[string]string{
				"existing": "dashboards/existing.json",
			},
			resourceErrors: map[string]error{
				"non-existent": errors.New("not found"),
			},
			expectedPaths:  []string{"dashboards/existing.json"},
			expectContinue: true,
		},
		{
			name:          "empty resources list",
			resources:     []provisioning.ResourceRef{},
			expectedPaths: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &mockReaderWriter{
				MockRepository: repository.NewMockRepository(t),
			}
			mockProgress := jobs.NewMockJobProgressRecorder(t)
			mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
			mockRepoResources := resources.NewMockRepositoryResources(t)

			if len(tt.resources) > 0 {
				mockProgress.On("SetMessage", mock.Anything, "Resolving resource paths").Return()
				mockResourcesFactory.On("Client", mock.Anything, mockRepo).Return(mockRepoResources, nil)

				for _, resource := range tt.resources {
					mockProgress.On("SetMessage", mock.Anything, fmt.Sprintf("Finding path for resource %s/%s/%s", resource.Group, resource.Kind, resource.Name)).Return()

					gvk := schema.GroupVersionKind{
						Group: resource.Group,
						Kind:  resource.Kind,
					}

					if path, ok := tt.resourcePaths[resource.Name]; ok {
						mockRepoResources.On("FindResourcePath", mock.Anything, resource.Name, gvk).Return(path, nil)
					} else if err, ok := tt.resourceErrors[resource.Name]; ok {
						mockRepoResources.On("FindResourcePath", mock.Anything, resource.Name, gvk).Return("", err)
						mockProgress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
							return result.Name == resource.Name && result.Group == resource.Group &&
								result.Action == repository.FileActionRenamed && result.Error != nil
						})).Return()
						if tt.tooManyErrors != nil {
							mockProgress.On("TooManyErrors").Return(tt.tooManyErrors)
						} else {
							mockProgress.On("TooManyErrors").Return(nil)
						}
					}
				}
			}

			worker := NewWorker(nil, nil, mockResourcesFactory)
			paths, err := worker.resolveResourcesToPaths(context.Background(), mockRepo, mockProgress, tt.resources)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectedPaths, paths)

			mockResourcesFactory.AssertExpectations(t)
			if len(tt.resources) > 0 {
				mockRepoResources.AssertExpectations(t)
			}
			mockProgress.AssertExpectations(t)
		})
	}
}

func TestMoveWorker_deduplicatePaths(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected []string
	}{
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
			name:     "empty slice",
			input:    []string{},
			expected: []string{},
		},
		{
			name:     "single item",
			input:    []string{"path1"},
			expected: []string{"path1"},
		},
		{
			name:     "all duplicates",
			input:    []string{"path1", "path1", "path1"},
			expected: []string{"path1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := deduplicatePaths(tt.input)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestMoveWorker_RefURLsSetWithRef(t *testing.T) {
	mockRepoWithURLs := repository.NewMockRepositoryWithURLs(t)
	config := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
		},
	}
	mockRepoWithURLs.On("Config").Return(config).Maybe() // Config may be called multiple times

	// Mock RefURLs method to return expected URLs
	expectedRefURLs := &provisioning.RepositoryURLs{
		SourceURL:         "https://github.com/grafana/grafana/tree/feature-branch",
		CompareURL:        "https://github.com/grafana/grafana/compare/main...feature-branch",
		NewPullRequestURL: "https://github.com/grafana/grafana/compare/main...feature-branch?quick_pull=1&labels=grafana",
	}
	mockRepoWithURLs.On("RefURLs", mock.Anything, "feature-branch").Return(expectedRefURLs, nil)

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetTotal", mock.Anything, 1).Once()
	mockProgress.On("StrictMaxErrors", 1).Once()
	mockProgress.On("SetMessage", mock.Anything, "Moving test.json to target/test.json").Once()
	mockProgress.On("Record", mock.Anything, mock.Anything).Once()
	mockProgress.On("TooManyErrors").Return(nil).Once()
	mockProgress.On("SetRefURLs", mock.Anything, expectedRefURLs).Once()

	mockReaderWriter := repository.NewMockReaderWriter(t)
	mockReaderWriter.On("Move", mock.Anything, "test.json", "target/test.json", "feature-branch", "Move test.json to target/test.json").Return(nil)

	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockWrapFn.On("Execute", mock.Anything, mockRepoWithURLs, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, opts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockReaderWriter, true)
	})

	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Ref:        "feature-branch",
				Paths:      []string{"test.json"},
				TargetPath: "target/",
			},
		},
	}

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepoWithURLs, job, mockProgress)
	require.NoError(t, err)

	// Verify that SetRefURLs was called with the expected RefURLs
	mockProgress.AssertExpectations(t)
	mockRepoWithURLs.AssertExpectations(t)
}

func TestMoveWorker_RefURLsNotSetWithoutRef(t *testing.T) {
	mockRepoWithURLs := repository.NewMockRepositoryWithURLs(t)
	config := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
		},
	}
	mockRepoWithURLs.On("Config").Return(config).Maybe() // Config may be called multiple times

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetTotal", mock.Anything, 1).Once()
	mockProgress.On("StrictMaxErrors", 1).Once()
	mockProgress.On("SetMessage", mock.Anything, "Moving test.json to target/test.json").Once()
	mockProgress.On("Record", mock.Anything, mock.Anything).Once()
	mockProgress.On("TooManyErrors").Return(nil).Once()
	mockProgress.On("ResetResults").Once()
	mockProgress.On("SetMessage", mock.Anything, "pull resources").Once()
	// SetRefURLs should NOT be called since no ref is specified

	mockReaderWriter := repository.NewMockReaderWriter(t)
	mockReaderWriter.On("Move", mock.Anything, "test.json", "target/test.json", "", "Move test.json to target/test.json").Return(nil)

	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockWrapFn.On("Execute", mock.Anything, mockRepoWithURLs, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, opts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockReaderWriter, true)
	})

	mockSyncWorker := jobs.NewMockWorker(t)
	mockSyncWorker.On("Process", mock.Anything, mockRepoWithURLs, mock.Anything, mockProgress).Return(nil)

	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				// No ref specified
				Paths:      []string{"test.json"},
				TargetPath: "target/",
			},
		},
	}

	worker := NewWorker(mockSyncWorker, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepoWithURLs, job, mockProgress)
	require.NoError(t, err)

	// Verify that SetRefURLs was NOT called since no ref was specified
	mockProgress.AssertExpectations(t)
}

func TestMoveWorker_RefURLsNotSetForNonURLRepository(t *testing.T) {
	mockRepo := repository.NewMockRepository(t)
	config := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitRepositoryType, // Regular git repo, not GitHub
		},
	}
	mockRepo.On("Config").Return(config).Maybe() // Config may be called multiple times

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetTotal", mock.Anything, 1).Once()
	mockProgress.On("StrictMaxErrors", 1).Once()
	mockProgress.On("SetMessage", mock.Anything, "Moving test.json to target/test.json").Once()
	mockProgress.On("Record", mock.Anything, mock.Anything).Once()
	mockProgress.On("TooManyErrors").Return(nil).Once()
	// SetRefURLs should NOT be called since repo doesn't support URLs

	mockReaderWriter := repository.NewMockReaderWriter(t)
	mockReaderWriter.On("Move", mock.Anything, "test.json", "target/test.json", "feature-branch", "Move test.json to target/test.json").Return(nil)

	mockWrapFn := repository.NewMockWrapWithStageFn(t)
	mockWrapFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, opts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockReaderWriter, true)
	})

	mockResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Ref:        "feature-branch",
				Paths:      []string{"test.json"},
				TargetPath: "target/",
			},
		},
	}

	worker := NewWorker(nil, mockWrapFn.Execute, mockResourcesFactory)
	err := worker.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)

	// Verify that SetRefURLs was NOT called since repo doesn't support URLs
	mockProgress.AssertExpectations(t)
}
