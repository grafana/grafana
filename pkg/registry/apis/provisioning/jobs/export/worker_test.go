package export

import (
	"context"
	"errors"
	"fmt"
	"testing"

	v0alpha1 "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8testing "k8s.io/client-go/testing"
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

func TestExportWorker_ProcessNotReaderWriter(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push:   &v0alpha1.ExportJobOptions{},
		},
	}

	mockRepo := repository.NewMockReader(t)
	mockRepo.On("Config").Return(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	r := NewExportWorker(nil, nil)
	err := r.Process(context.Background(), mockRepo, job, nil)
	require.EqualError(t, err, "export job submitted targeting repository that is not a ReaderWriter")
}

func TestExportWorker_ProcessFolderClientError(t *testing.T) {
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
	resourceClients.On("Folder").Return(nil, fmt.Errorf("failed to create folder client"))

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	r := NewExportWorker(mockClients, nil)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create folder client: failed to create folder client")
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
	resourceClients.On("Folder").Return(nil, nil)
	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)

	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResources.On("Client", context.Background(), mockRepo).Return(nil, fmt.Errorf("failed to create repository resources client"))

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", context.Background(), "read folder tree from API server").Return()

	r := NewExportWorker(mockClients, mockRepoResources)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "create repository resource client: failed to create repository resources client")
}

func TestExportWorker_ProcessFolderMigrationError(t *testing.T) {
	job := v0alpha1.Job{
		Spec: v0alpha1.JobSpec{
			Action: v0alpha1.JobActionPush,
			Push: &v0alpha1.ExportJobOptions{
				Path: "grafana",
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
			Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
		},
	})

	scheme := runtime.NewScheme()
	listGVK := schema.GroupVersionKind{
		Group:   resources.FolderResource.Group,
		Version: resources.FolderResource.Version,
		Kind:    "FolderList",
	}
	fakeDynamicClient := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
		resources.FolderResource: listGVK.Kind,
	})

	fakeFolderClient := fakeDynamicClient.Resource(resources.FolderResource)

	resourceClients := resources.NewMockResourceClients(t)
	resourceClients.On("Folder").Return(fakeFolderClient, nil)

	// make list call fail
	fakeDynamicClient.PrependReactor("list", "folders", func(action k8testing.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("failed to list folders")
	})

	mockClients := resources.NewMockClientFactory(t)
	mockClients.On("Clients", context.Background(), "test-namespace").Return(resourceClients, nil)

	repoResources := resources.NewMockRepositoryResources(t)
	mockRepoResources := resources.NewMockRepositoryResourcesFactory(t)
	mockRepoResources.On("Client", context.Background(), mockRepo).Return(repoResources, nil)

	mockProgress := jobs.NewMockJobProgressRecorder(t)
	mockProgress.On("SetMessage", mock.Anything, mock.Anything).Return()

	r := NewExportWorker(mockClients, mockRepoResources)
	err := r.Process(context.Background(), mockRepo, job, mockProgress)
	require.EqualError(t, err, "load folder tree: error executing list: failed to list folders")
}
