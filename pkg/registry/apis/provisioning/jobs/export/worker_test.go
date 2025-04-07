package export

import (
	"context"
	"errors"
	"testing"

	v0alpha1 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewExportWorker(nil, nil)
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

	r := NewExportWorker(nil, nil)
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

	r := NewExportWorker(nil, nil)
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

	r := NewExportWorker(nil, nil)
	err := r.Process(context.Background(), mockRepo, job, nil)
	require.EqualError(t, err, "Only github supports writing to a branch")
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
	r := NewExportWorker(mockClients, nil)

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create clients: failed to create clients")
}
