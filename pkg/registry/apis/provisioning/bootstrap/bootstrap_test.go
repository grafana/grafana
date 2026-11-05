package bootstrap

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	clienttesting "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fakeclientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
)

const namespace = "default"

var config = Config{Path: "conf/provisioning/bootstrap", Namespace: namespace}

func TestEnsureCreatesReadOnlyLocalRepository(t *testing.T) {
	client := newClientset()

	require.NoError(t, Ensure(context.Background(), repositories(client), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, provisioning.LocalRepositoryType, repo.Spec.Type)
	assert.Equal(t, config.Path, repo.Spec.Local.Path)
	assert.Empty(t, repo.Spec.Workflows, "an empty workflow list is what makes the repository read-only")
	assert.True(t, repo.Spec.Sync.Enabled)
	assert.Equal(t, provisioning.SyncTargetTypeFolderless, repo.Spec.Sync.Target)
}

func TestEnsureIsIdempotent(t *testing.T) {
	client := newClientset()
	require.NoError(t, Ensure(context.Background(), repositories(client), config))
	client.ClearActions()

	require.NoError(t, Ensure(context.Background(), repositories(client), config))

	for _, action := range client.Actions() {
		assert.Equal(t, "get", action.GetVerb(), "a matching repository must not be rewritten")
	}
}

func TestEnsurePreservesTheClampedSyncInterval(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		applySpec(&repo.Spec, config.Path)
		repo.Spec.Sync.IntervalSeconds = 60
		repo.Spec.Local.Path = "conf/provisioning/stale"
	}))

	require.NoError(t, Ensure(context.Background(), repositories(client), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, config.Path, repo.Spec.Local.Path)
	assert.EqualValues(t, 60, repo.Spec.Sync.IntervalSeconds)
}

func TestEnsureRepairsADivertedRepository(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.GitHubRepositoryType
		repo.Spec.GitHub = &provisioning.GitHubRepositoryConfig{URL: "https://github.com/acme/elsewhere"}
		repo.Spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow}
		repo.Spec.Sync.Enabled = false
	}))

	require.NoError(t, Ensure(context.Background(), repositories(client), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, provisioning.LocalRepositoryType, repo.Spec.Type)
	assert.Nil(t, repo.Spec.GitHub)
	assert.Empty(t, repo.Spec.Workflows)
	assert.True(t, repo.Spec.Sync.Enabled)
}

func TestEnsureToleratesAnotherReplicaWinningTheCreate(t *testing.T) {
	client := newClientset()
	client.PrependReactor("create", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewAlreadyExists(schema.GroupResource{Resource: "repositories"}, Name)
	})

	assert.NoError(t, Ensure(context.Background(), repositories(client), config))
}

func TestEnsureReportsAFailedRead(t *testing.T) {
	client := newClientset()
	client.PrependReactor("get", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("boom")
	})

	assert.ErrorContains(t, Ensure(context.Background(), repositories(client), config), "read bootstrap repository")
}

func TestConfigEnabled(t *testing.T) {
	assert.True(t, config.Enabled())
	assert.False(t, Config{Namespace: namespace}.Enabled())
	assert.False(t, Config{Path: config.Path}.Enabled())
}

func newClientset(objects ...runtime.Object) *fakeclientset.Clientset {
	//nolint:staticcheck // NewClientset requires schema registration not available for this type.
	return fakeclientset.NewSimpleClientset(objects...)
}

func repositories(client *fakeclientset.Clientset) Repositories {
	return client.ProvisioningV0alpha1().Repositories(namespace)
}

func repositoryWith(mutate func(*provisioning.Repository)) *provisioning.Repository {
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: namespace},
	}
	mutate(repo)
	return repo
}
