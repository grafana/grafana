package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestFullSync_ContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Title: "Test Repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{{}}, nil)
	progress.On("SetTotal", mock.Anything, 1).Return()
	progress.On("SetMessage", mock.Anything, "replicating changes").Return()

	err := FullSync(ctx, repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.EqualError(t, err, "context canceled")
}

func TestFullSync_Error(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, fmt.Errorf("some error"))

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.EqualError(t, err, "compare changes: some error")
}

func TestFullSync_NoChanges(t *testing.T) {
	repo := repository.NewMockRepository(t)
	repoResources := resources.NewMockRepositoryResources(t)
	clients := resources.NewMockResourceClients(t)
	progress := jobs.NewMockJobProgressRecorder(t)
	compareFn := NewMockCompareFn(t)

	repo.On("Config").Return(&provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-repo",
		},
	})

	compareFn.On("Execute", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]ResourceFileChange{}, nil)
	progress.On("SetFinalMessage", mock.Anything, "no changes to sync").Return()

	err := FullSync(context.Background(), repo, compareFn.Execute, clients, "current-ref", repoResources, progress)
	require.NoError(t, err)
}
