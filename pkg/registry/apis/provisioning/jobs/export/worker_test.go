package export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	v0alpha1 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	mockCloneFn := NewMockWrapWithCloneFn(t)
	mockCloneFn.On("Execute", context.Background(), mockRepo, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.CloneOptions, pushOpts repository.PushOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, nil, nil, mockCloneFn.Execute)
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

	mockCloneFn := NewMockWrapWithCloneFn(t)
	mockCloneFn.On("Execute", context.Background(), mockRepo, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.CloneOptions, pushOpts repository.PushOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, nil, nil, mockCloneFn.Execute)
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
	mockCloneFn := NewMockWrapWithCloneFn(t)
	mockCloneFn.On("Execute", context.Background(), mockRepo, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.CloneOptions, pushOpts repository.PushOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})
	r := NewExportWorker(mockClients, mockRepoResources, nil, mockCloneFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create repository resource client: failed to create repository resources client")
}

func TestExportWorker_ProcessCloneAndPushOptions(t *testing.T) {
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
	// Verify progress messages are set
	mockProgress.On("SetMessage", mock.Anything, "clone target").Return()
	mockProgress.On("SetMessage", mock.Anything, "push changes").Return()

	mockClients := resources.NewMockClientFactory(t)
	mockResourceClients := resources.NewMockResourceClients(t)
	mockClients.On("Clients", mock.Anything, "test-namespace").Return(mockResourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResourcesClient := resources.NewMockRepositoryResources(t)
	mockRepoResources.On("Client", mock.Anything, mock.Anything).Return(mockRepoResourcesClient, nil)

	mockExportFn := NewMockExportFn(t)
	mockExportFn.On("Execute", mock.Anything, "test-repo", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	mockCloneFn := NewMockWrapWithCloneFn(t)
	// Verify clone and push options
	mockCloneFn.On("Execute", mock.Anything, mockRepo, mock.MatchedBy(func(opts repository.CloneOptions) bool {
		return opts.Timeout == 10*time.Minute && !opts.PushOnWrites && opts.BeforeFn != nil
	}), mock.MatchedBy(func(opts repository.PushOptions) bool {
		return opts.Timeout == 10*time.Minute && opts.Progress == os.Stdout && opts.BeforeFn != nil
	}), mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.CloneOptions, pushOpts repository.PushOptions, fn func(repository.Repository, bool) error) error {
		// Execute both BeforeFn functions to verify progress messages
		assert.NoError(t, cloneOpts.BeforeFn())
		assert.NoError(t, pushOpts.BeforeFn())

		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockCloneFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.NoError(t, err)
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

	mockCloneFn := NewMockWrapWithCloneFn(t)
	mockCloneFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.CloneOptions, pushOpts repository.PushOptions, fn func(repository.Repository, bool) error) error {
		return fn(repo, true)
	})

	r := NewExportWorker(mockClients, mockRepoResources, mockExportFn.Execute, mockCloneFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "export failed")
}

func TestExportWorker_ProcessWrapWithCloneFnError(t *testing.T) {
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
	mockCloneFn := NewMockWrapWithCloneFn(t)
	mockCloneFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything, mock.Anything).Return(errors.New("clone failed"))

	r := NewExportWorker(nil, nil, nil, mockCloneFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "clone failed")
}

func TestExportWorker_ProcessBranchNotAllowedForClonableRepositories(t *testing.T) {
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
			Workflows: []v0alpha1.Workflow{v0alpha1.BranchWorkflow},
		},
	})

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", mock.Anything, "clone target").Return()
	mockCloneFn := NewMockWrapWithCloneFn(t)
	mockCloneFn.On("Execute", mock.Anything, mockRepo, mock.Anything, mock.Anything, mock.Anything).Return(func(ctx context.Context, repo repository.Repository, cloneOpts repository.CloneOptions, pushOpts repository.PushOptions, fn func(repository.Repository, bool) error) error {
		if cloneOpts.BeforeFn != nil {
			return cloneOpts.BeforeFn()
		}

		return fn(repo, true)
	})

	r := NewExportWorker(nil, nil, nil, mockCloneFn.Execute)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "branch is not supported for clonable repositories")
}
