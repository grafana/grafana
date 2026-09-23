package sync

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func toRuntimeObjects(repos []*provisioning.Repository) []runtime.Object {
	objs := make([]runtime.Object, len(repos))
	for i, r := range repos {
		objs[i] = r
	}
	return objs
}

func gitRepoWithSync(name, url, branch, path string, syncEnabled bool) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "test-ns"},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    url,
				Branch: branch,
				Path:   path,
			},
			Sync: provisioning.SyncOptions{Enabled: syncEnabled},
		},
	}
}

func TestSyncWorker_checkPathConflict(t *testing.T) {
	tests := []struct {
		name      string
		cfg       *provisioning.Repository
		others    []*provisioning.Repository
		wantErr   bool
		errSubstr string
	}{
		{
			name: "no other repositories",
			cfg:  gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana", true),
		},
		{
			name: "unrelated repository",
			cfg:  gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana", true),
			others: []*provisioning.Repository{
				gitRepoWithSync("other-repo", "https://github.com/org/other", "main", "grafana", true),
			},
		},
		{
			name: "conflicting repository with sync disabled does not block",
			cfg:  gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana", true),
			others: []*provisioning.Repository{
				gitRepoWithSync("existing-repo", "https://github.com/org/repo", "main", "grafana", false),
			},
		},
		{
			name: "exact duplicate path with sync enabled blocks",
			cfg:  gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana", true),
			others: []*provisioning.Repository{
				gitRepoWithSync("existing-repo", "https://github.com/org/repo", "main", "grafana", true),
			},
			wantErr:   true,
			errSubstr: "existing-repo",
		},
		{
			name: "parent/child overlap with sync enabled blocks",
			cfg:  gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana/dashboards", true),
			others: []*provisioning.Repository{
				gitRepoWithSync("existing-repo", "https://github.com/org/repo", "main", "grafana", true),
			},
			wantErr:   true,
			errSubstr: "existing-repo",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := fake.NewSimpleClientset(toRuntimeObjects(tt.others)...)

			worker := &SyncWorker{repos: client.ProvisioningV0alpha1()}
			err := worker.checkPathConflict(context.Background(), tt.cfg)

			if tt.wantErr {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.errSubstr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestSyncWorker_checkPathConflict_NilRepos(t *testing.T) {
	worker := &SyncWorker{}
	err := worker.checkPathConflict(context.Background(), gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana", true))
	require.NoError(t, err)
}

func TestSyncWorker_Process_BlocksOnPathConflict(t *testing.T) {
	cfg := gitRepoWithSync("new-repo", "https://github.com/org/repo", "main", "grafana", true)
	other := gitRepoWithSync("existing-repo", "https://github.com/org/repo", "main", "grafana", true)
	client := fake.NewSimpleClientset(other)

	readerWriter := &mockReaderWriter{
		MockRepository: repository.NewMockRepository(t),
		MockVersioned:  repository.NewMockVersioned(t),
	}
	readerWriter.MockRepository.On("Config").Return(cfg)

	syncer := NewMockSyncer(t)
	worker := NewSyncWorker(nil, nil, nil, syncer, jobs.RegisterJobMetrics(prometheus.NewPedanticRegistry()), tracing.NewNoopTracerService(), 10, 0, client.ProvisioningV0alpha1())

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
		Spec: provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		},
	}

	err := worker.Process(context.Background(), readerWriter, job, jobs.NewMockJobProgressRecorder(t))
	require.Error(t, err)
	require.ErrorContains(t, err, "existing-repo")
	syncer.AssertNotCalled(t, "Sync")
}
