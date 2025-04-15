package pullrequest

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
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
			worker := NewPullRequestWorker(evaluator, commenter)
			result := worker.IsSupported(context.Background(), tt.job)
			require.Equal(t, tt.expected, result)
		})
	}
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
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
				})
			},
			expectedError: "missing spec.pr",
		},
		{
			name: "missing ref",
			opts: &provisioning.PullRequestJobOptions{
				PR: 123,
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
				})
			},
			expectedError: "missing spec.ref",
		},
		{
			name: "missing github configuration",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title: "test-repo",
					},
				})
			},
			expectedError: "expecting github configuration",
		},
		{
			name: "failed to list pull request files",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title:  "test-repo",
						GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					},
				})
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "main", "test-ref").Return(nil, errors.New("failed to list files"))
			},
			expectedError: "failed to list pull request files: failed to list files",
		},
		{
			name: "no files to process",
			opts: &provisioning.PullRequestJobOptions{
				PR:  123,
				Ref: "test-ref",
			},
			setupMocks: func(evaluator *MockEvaluator, commenter *MockCommenter, repo *mockPullRequestRepo, progress *jobs.MockJobProgressRecorder) {
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title:  "test-repo",
						GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					},
				})
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "main", "test-ref").Return([]repository.VersionedFileChange{}, nil)
				progress.On("SetFinalMessage", mock.Anything, "no files to process").Return()
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
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title:  "test-repo",
						GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					},
				})
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "main", "test-ref").Return(files, nil)
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
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title:  "test-repo",
						GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					},
				})
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "main", "test-ref").Return(files, nil)
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
				repo.MockRepository.On("Config").Return(&provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
					Spec: provisioning.RepositorySpec{
						Title:  "test-repo",
						GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					},
				})
				progress.On("SetMessage", mock.Anything, "listing pull request files").Return()
				files := []repository.VersionedFileChange{
					{Path: "test.yaml"},
				}
				repo.MockPullRequestRepo.On("CompareFiles", mock.Anything, "main", "test-ref").Return(files, nil)
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
				MockPullRequestRepo: NewMockPullRequestRepo(t),
			}
			progress := jobs.NewMockJobProgressRecorder(t)
			// ensure it's a pull request repository before passing it to the worker
			var i repository.Repository
			i = repo
			_, ok := i.(PullRequestRepo)
			require.True(t, ok)

			tt.setupMocks(evaluator, commenter, &repo, progress)

			worker := NewPullRequestWorker(evaluator, commenter)
			job := provisioning.Job{
				Spec: provisioning.JobSpec{
					Action:      provisioning.JobActionPullRequest,
					PullRequest: tt.opts,
				},
			}

			err := worker.Process(context.Background(), repo, job, progress)

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
	*MockPullRequestRepo
}

func (m mockPullRequestRepo) Config() *provisioning.Repository {
	return m.MockRepository.Config()
}

func (m mockPullRequestRepo) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return m.MockRepository.Test(ctx)
}

func (m mockPullRequestRepo) Validate() field.ErrorList {
	return m.MockRepository.Validate()
}

func (m mockPullRequestRepo) AssertExpectations(t *testing.T) {
	m.MockRepository.AssertExpectations(t)
	m.MockPullRequestRepo.AssertExpectations(t)
}
