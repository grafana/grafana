package export

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestExportWorker_IsSupported(t *testing.T) {
	tests := []struct {
		name string
		job  v0alpha1.Job
		want bool
	}{
		{
			name: "push job",
			job: v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPush,
				},
			},
			want: true,
		},
		{
			name: "pull job",
			job: v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPull,
				},
			},
			want: false,
		},
		{
			name: "migrate job",
			job: v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionMigrate,
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewExportWorker(nil, nil, nil, nil)
			got := r.IsSupported(context.Background(), tt.job)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestExportWorker_ProcessNoExportSettings(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
		},
	}

	r := NewExportWorker(nil, nil, nil, nil)
	err := r.Process(context.Background(), nil, job, nil)
	require.EqualError(t, err, "missing export settings")
}

func TestExportWorker_ProcessWriteNotAllowed(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch: "main",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			// no write permissions
			Workflows: []v0alpha1.Workflow{},
		},
	})

	r := NewExportWorker(nil, nil, nil, nil)
	err := r.Process(context.Background(), mockRepo, job, nil)
	require.EqualError(t, err, "this repository is read only")
}

func TestExportWorker_ProcessBranchNotAllowedForLocal(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch: "somebranch",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			Type: v0alpha1.LocalRepositoryType,
			// try to override the branch workflow
			Workflows: []v0alpha1.Workflow{v0alpha1.BranchWorkflow},
		},
	})

	r := NewExportWorker(nil, nil, nil, nil)
	err := r.Process(context.Background(), mockRepo, job, nil)
	require.EqualError(t, err, "this repository does not support the branch workflow")
}

func TestExportWorker_ProcessFailedToCreateClients(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	mockClients := resources.NewMockClientFactory(t)

	mockClients.On("Clients", context.Background(), "test-namespace").Return(nil, errors.New("failed to create clients"))
	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", context.Background(), mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, nil, nil, mockStageFn.Execute)
	mockProgress := jobs.NewMockJobProgressRecorder(t)

	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create clients: failed to create clients")
}

func TestExportWorker_ProcessNotReaderWriter(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockReader(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	resourceClients := resources.NewMockResourceClients(t)
	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)
	mockProgress := jobs.NewMockJobProgressRecorder(t)

	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", context.Background(), mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, nil, nil, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "export job submitted targeting repository that is not a ReaderWriter")
}

func TestExportWorker_ProcessRepositoryResourcesError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	resourceClients := resources.NewMockResourceClients(t)
	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResources.On("Client", context.Background(), mockRepo).Return(nil, fmt.Errorf("failed to create repository resources client"))

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", context.Background(), mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})
	r := NewExportWorker(mockClients, mockRepoResources, nil, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create repository resource client: failed to create repository resources client")
}

func TestExportWorker_ProcessStageOptions(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch: "feature-branch",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Type:      v0alpha1.GitRepositoryType,
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow, v0alpha1.BranchWorkflow},
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	// No progress messages expected in current implementation

	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	mockStageFn := NewMockWrapWithStageFn(t)
	// Verify all stage options including Ref (branch), Timeout, and PushOnWrites
	mockStageFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return opts.Ref == "feature-branch" &&
			opts.Timeout == 10*time.Minute &&
			!opts.PushOnWrites && opts.Mode == repository.StageModeCommitOnlyOnce
	}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestExportWorker_ProcessStageOptionsWithBranch(t *testing.T) {
	tests := []struct {
		name        string
		branch      string
		expectedRef string
		workflows   []v0alpha1.Workflow
		repoType    v0alpha1.RepositoryType
	}{
		{
			name:        "branch specified",
			branch:      "develop",
			expectedRef: "develop",
			workflows:   []v0alpha1.Workflow{v0alpha1.WriteWorkflow, v0alpha1.BranchWorkflow},
			repoType:    v0alpha1.GitRepositoryType,
		},
		{
			name:        "empty branch",
			branch:      "",
			expectedRef: "",
			workflows:   []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
			repoType:    v0alpha1.LocalRepositoryType,
		},
		{
			name:        "main branch",
			branch:      "main",
			expectedRef: "main",
			workflows:   []v0alpha1.Workflow{v0alpha1.WriteWorkflow, v0alpha1.BranchWorkflow},
			repoType:    v0alpha1.GitRepositoryType,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := v0alpha1.Job{
				Spec: v0alpha1.JobSpec{
					Action: v0alpha1.JobActionPush,
					Push: &v0alpha1.ExportJobOptions{
						Branch: tt.branch,
					},
				},
			}

			mockRepo := repository.NewMockRepository(t)
			mockRepo.On("Config").Return(&v0alpha1.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "test-namespace",
				},
				Spec: v0alpha1.RepositorySpec{
					Type:      tt.repoType,
					Workflows: tt.workflows,
				},
			})

			mockProgress := jobs.NewMockJobProgressRecorder(t)
			mockClients := resources.NewMockClientFactory(t)
			mockResourceClients := resources.NewMockResourceClients(t)
			mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

			mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
			mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
			mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

			mockExportFn := NewMockExportFn(t)
			mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

			mockStageFn := NewMockWrapWithStageFn(t)
			// Verify that the stage options contain the correct branch reference and other parameters
			mockStageFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
				return opts.Ref == tt.expectedRef &&
					opts.Timeout == 10*time.Minute &&
					!opts.PushOnWrites
			}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
				return fn(repo, true)
			})

			r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
			err := r.Process(context.Background(), mockRepo, job, mockProgress)
			require.NoError(t, err)
		})
	}
}

func TestExportWorker_ProcessExportFnError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("export failed"))

	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "export failed")
}

func TestExportWorker_ProcessWrapWithStageFnError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(errors.New("stage failed"))

	r := NewExportWorker(nil, nil, nil, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "stage failed")
}

func TestExportWorker_ProcessBranchNotAllowedForStageableRepositories(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch: "somebranch",
			},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			Type:      v0alpha1.GitHubRepositoryType,
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow}, // Only write workflow, not branch
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	// No progress messages expected in current implementation

	r := NewExportWorker(nil, nil, nil, nil)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "this repository does not support the branch workflow")
}

func TestExportWorker_ProcessGitRepository(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Type: v0alpha1.GitRepositoryType,
			Git: &v0alpha1.GitRepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
			},
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	// No progress messages expected in current implementation

	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	mockStageFn := NewMockWrapWithStageFn(t)
	// Verify clone and push options
	mockStageFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.StageOptions) bool {
		return opts.Timeout == 10*time.Minute && opts.Mode == repository.StageModeCommitOnlyOnce
	}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
}

func TestExportWorker_ProcessGitRepositoryExportFnError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockRepository(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Type: v0alpha1.GitRepositoryType,
			Git: &v0alpha1.GitRepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
			},
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("export failed"))

	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "export failed")
}

func TestExportWorker_RefURLsSetWithBranch(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch:  "feature-branch",
				Message: "test commit",
			},
		},
	}

	// Create a repository that implements both Repository and RepositoryWithURLs
	mockRepoWithURLs := repository.NewMockRepositoryWithURLs(t)

	mockRepoWithURLs.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Type:      v0alpha1.GitHubRepositoryType,
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow, v0alpha1.BranchWorkflow},
		},
	})

	// Mock RefURLs method to return expected URLs
	expectedRefURLs := &v0alpha1.RepositoryURLs{
		SourceURL:         "https://github.com/grafana/grafana/tree/feature-branch",
		CompareURL:        "https://github.com/grafana/grafana/compare/main...feature-branch",
		NewPullRequestURL: "https://github.com/grafana/grafana/compare/main...feature-branch?quick_pull=1&labels=grafana",
	}
	mockRepoWithURLs.On("RefURLs", mock.Anything, "feature-branch").Return(expectedRefURLs, nil)

	// Mock progress recorder to expect SetRefURLs call
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetRefURLs", mock.Anything, expectedRefURLs).Once()

	// Mock other dependencies
	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	// Mock the ReaderWriter interface that the export function expects
	mockReaderWriter := repository.NewMockReaderWriter(t)

	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		// The staging function needs to call the inner function with a ReaderWriter
		return fn(mockReaderWriter, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepoWithURLs, job, mockProgress)
	require.NoError(t, err)

	// Verify that SetRefURLs was called with the expected RefURLs
	mockProgress.AssertExpectations(t)
	mockRepoWithURLs.AssertExpectations(t)
}

func TestExportWorker_RefURLsNotSetWithoutBranch(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Message: "test commit",
				// No branch specified
			},
		},
	}

	mockRepoWithURLs := repository.NewMockRepositoryWithURLs(t)

	mockRepoWithURLs.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Type:      v0alpha1.GitHubRepositoryType,
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	// Mock progress recorder - SetRefURLs should NOT be called
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	// Explicitly NOT expecting SetRefURLs call

	// Mock other dependencies
	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	mockReaderWriter := repository.NewMockReaderWriter(t)

	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockReaderWriter, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepoWithURLs, job, mockProgress)
	require.NoError(t, err)

	// Verify that SetRefURLs was NOT called since no branch was specified
	mockProgress.AssertExpectations(t)
}

func TestExportWorker_RefURLsNotSetForNonURLRepository(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Branch:  "feature-branch",
				Message: "test commit",
			},
		},
	}

	// Use a regular Repository that doesn't implement RepositoryWithURLs
	mockRepo := repository.NewMockRepository(t)

	mockRepo.On("Config").Return(&v0alpha1.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: "test-namespace",
		},
		Spec: v0alpha1.RepositorySpec{
			Type:      v0alpha1.GitRepositoryType, // Regular git repo, not GitHub
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow, v0alpha1.BranchWorkflow},
		},
	})

	// Mock progress recorder - SetRefURLs should NOT be called
	mockProgress := jobs.NewMockJobProgressRecorder(t)
	// Explicitly NOT expecting SetRefURLs call

	// Mock other dependencies
	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	mockReaderWriter := repository.NewMockReaderWriter(t)

	mockStageFn := NewMockWrapWithStageFn(t)
	mockStageFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, stageOpts repository.StageOptions, fn func(repository.Repository, bool) error) error {
		return fn(mockReaderWriter, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockStageFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)

	// Verify that SetRefURLs was NOT called since repo doesn't support URLs
	mockProgress.AssertExpectations(t)
}
