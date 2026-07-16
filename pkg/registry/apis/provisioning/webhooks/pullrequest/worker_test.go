package pullrequest

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func TestPullRequestWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name     string
		job      provisioning.Job
		expected bool
	}{
		{
			name: "pull request action is supported",
			job: provisioning.Job{
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPullRequest,
				},
			},
			expected: true,
		},
		{
			name: "non-pull request action is not supported",
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
			evaluator := NewMockEvaluator(t)
			commenter := NewMockCommenter(t)
			worker := NewPullRequestWorker(evaluator, commenter, prometheus.NewPedanticRegistry())
			result := worker.IsSupported(t.Context(), tt.job)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestPullRequestWorker_Process_NotPullRequestRepository(t *testing.T) {
	evaluator := NewMockEvaluator(t)
	commenter := NewMockCommenter(t)
	repo := repository.NewMockRepository(t)
	progress := jobs.NewMockJobProgressRecorder(t)

	worker := NewPullRequestWorker(evaluator, commenter, prometheus.NewPedanticRegistry())
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
		},
	}

	// The repository is not a PullRequestRepo, so it should fail
	err := worker.Process(t.Context(), repo, job, progress)
	require.Error(t, err)
	require.Contains(t, err.Error(), "repository is not a pull request repository")

	repo.AssertExpectations(t)
}

func TestPullRequestWorker_Process_NotReaderRepository(t *testing.T) {
	evaluator := NewMockEvaluator(t)
	commenter := NewMockCommenter(t)
	progress := jobs.NewMockJobProgressRecorder(t)

	// Create a mock that implements PullRequestRepo but not Reader
	repo := repository.NewMockConfigRepository(t)

	worker := NewPullRequestWorker(evaluator, commenter, prometheus.NewPedanticRegistry())
	job := provisioning.Job{
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
		},
	}

	// The repository is not a Reader, so it should fail
	err := worker.Process(t.Context(), repo, job, progress)
	require.Error(t, err)
	require.Contains(t, err.Error(), "repository that is not a Reader")
	repo.AssertExpectations(t)
}

func TestPullRequestWorker_Process(t *testing.T) {
	tests := []struct {
		name          string
		opts          *provisioning.PullRequestJobOptions
		setupMocks    func(*MockEvaluator, *MockCommenter, *mockPullRequestRepo, *jobs.MockJobProgressRecorder)
		expectedError string
	}{
		{
			name: "missing pull request options",
			opts: nil,
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
			},
			expectedError: "missing spec.pr",
		},
		{
			name: "missing ref",
			opts: &provisioning.PullRequestJobOptions{
				PR: 123,
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
			},
			expectedError: "missing spec.ref",
		},
		{
			name: "failed to list pull request files",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(nil, errors.New("failed to list files"))
			},
			expectedError: "failed to list pull request files: failed to list files",
		},
		{
			name: "falls back to the configured branch when base resolution fails",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type:   provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					},
				})
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("", errors.New("api unavailable"))
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "main", "test-ref").Return([]repository.VersionedFileChange{}, nil)
				progress.On("SetFinalMessage", mock.Anything, "no files to process").Return()
			},
			expectedError: "",
		},
		{
			name: "no files to process",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return([]repository.VersionedFileChange{}, nil)
				progress.On("SetFinalMessage", mock.Anything, "no files to process").Return()
			},
			expectedError: "",
		},
		{
			name: "ignored files are filtered out",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()

				// Create a mix of ignored and supported files
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"}, // Supported file
					{Path: "ignored.txt", Action: repository.FileActionIgnored}, // Ignored file
					{Path: "another.yaml"}, // Supported file
				}

				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(files, nil)

				// Only non-ignored files should be passed to the evaluator
				expectedFiles := []repository.VersionedFileChange{
					{Path: "test.yaml"},
					{Path: "another.yaml"},
				}

				evaluator.On("Evaluate", mock.Anything, mock.Anything, mock.Anything, expectedFiles, mock.Anything).Return(changeInfo{}, nil)
				commenter.On("Comment", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: "",
		},
		{
			name: "files with unsupported paths are filtered out",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()

				// Create a mix of supported and unsupported files
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},            // Supported file
					{Path: "unsupported/path.txt"}, // Unsupported file
					{Path: "another.yaml"},         // Supported file
					{Path: "invalid.doc"},          // Unsupported file
					{Path: ".github/something"},    // Unsupported file
				}

				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(files, nil)

				// Only supported files should be passed to the evaluator
				expectedFiles := []repository.VersionedFileChange{
					{Path: "test.yaml"},
					{Path: "another.yaml"},
				}

				evaluator.On("Evaluate", mock.Anything, mock.Anything, mock.Anything, expectedFiles, mock.Anything).Return(changeInfo{}, nil)
				commenter.On("Comment", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: "",
		},
		{
			name: "evaluation fails",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(files, nil)
				evaluator.On("Evaluate", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changeInfo{}, errors.New("evaluation failed"))
			},
			expectedError: "calculate changes: evaluation failed",
		},
		{
			name: "comment fails",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(files, nil)
				evaluator.On("Evaluate", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changeInfo{}, nil)
				commenter.On("Comment", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("comment failed"))
			},
			expectedError: "comment pull request: comment failed",
		},
		{
			name: "successful process",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(files, nil)
				evaluator.On("Evaluate", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changeInfo{}, nil)
				commenter.On("Comment", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: "",
		},
		{
			name: "gitlab repository resolves base branch",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("MergeBase", mock.Anything, "test-ref").Return("merge-base-sha", nil)
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "merge-base-sha", "test-ref").Return(files, nil)
				evaluator.On("Evaluate", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(changeInfo{}, nil)
				commenter.On("Comment", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
			},
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			evaluator := NewMockEvaluator(t)
			commenter := NewMockCommenter(t)
			repo := mockPullRequestRepo{
				MockRepository:      repository.NewMockRepository(t),
				MockPullRequestRepo: repository.NewMockPullRequestRepo(t),
			}
			progress := jobs.NewMockJobProgressRecorder(t)
			tt.setupMocks(evaluator, commenter, &repo, progress)

			worker := NewPullRequestWorker(evaluator, commenter, prometheus.NewPedanticRegistry())
			job := provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:      provisioning.JobActionPullRequest,
					PullRequest: tt.opts,
				},
			}

			err := worker.Process(logging.Context(t.Context(), logging.DefaultLogger), repo, job, progress)
			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			evaluator.AssertExpectations(t)
			commenter.AssertExpectations(t)
			repo.AssertExpectations(t)
			progress.AssertExpectations(t)
		})
	}
}

type mockPullRequestRepo struct {
	*repository.MockRepository
	*repository.MockPullRequestRepo
}

// implemented by both mocks
func (m mockPullRequestRepo) Config() *provisioning.Repository {
	return m.MockRepository.Config()
}

// implemented by both mocks
func (m mockPullRequestRepo) Read(ctx context.Context, path, ref string) (*repository.FileInfo, error) {
	return m.MockRepository.Read(ctx, path, ref)
}

// implemented by both mocks
func (m mockPullRequestRepo) AssertExpectations(t *testing.T) {
	m.MockRepository.AssertExpectations(t)
	m.MockPullRequestRepo.AssertExpectations(t)
}
