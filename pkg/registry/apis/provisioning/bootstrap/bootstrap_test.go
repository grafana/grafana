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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const namespace = "default"

var config = Config{Path: "conf/provisioning/bootstrap", Namespace: namespace}

func TestReconcileCreatesALocalRepository(t *testing.T) {
	client := newClientset()

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, provisioning.LocalRepositoryType, repo.Spec.Type)
	assert.Equal(t, config.Path, repo.Spec.Local.Path)
	assert.True(t, repo.Spec.Sync.Enabled)
	assert.Equal(t, provisioning.SyncTargetTypeFolderless, repo.Spec.Sync.Target)
	assert.Equal(t, []provisioning.Workflow{provisioning.WriteWorkflow}, repo.Spec.Workflows,
		"the resources it provisions are edited through this repository's files endpoint")
}

func TestReconcileMarksTheRepositoryNotEditable(t *testing.T) {
	client := newClientset()

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	manager, ok := metaOf(t, repo).GetManagerProperties()
	require.True(t, ok, "the repository should declare a manager so the UI renders it read-only")
	assert.Equal(t, utils.ManagerKindFileProvisioning, manager.Kind)
	assert.Equal(t, Name, manager.Identity)
	assert.False(t, manager.AllowsEdits)
	// SetManagerProperties drops the annotation when edits are not allowed, and the UI
	// reads its absence the same way.
	assert.NotContains(t, repo.Annotations, utils.AnnoKeyManagerAllowsEdits)
}

func TestReconcileTakesBackAllowedEdits(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		metaOf(t, repo).SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindFileProvisioning,
			Identity:    Name,
			AllowsEdits: true,
		})
	}))

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	manager, _ := metaOf(t, repo).GetManagerProperties()
	assert.False(t, manager.AllowsEdits, "its configuration still comes from bootstrap_path")
}

func TestReconcileIsIdempotent(t *testing.T) {
	client := newClientset()
	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))
	client.ClearActions()

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	for _, action := range client.Actions() {
		assert.Equal(t, "get", action.GetVerb(), "a matching repository must not be rewritten")
	}
}

func TestReconcilePreservesTheClampedSyncInterval(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.Spec.Sync.IntervalSeconds = 60
		repo.Spec.Local.Path = "conf/provisioning/stale"
	}))

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, config.Path, repo.Spec.Local.Path)
	assert.EqualValues(t, 60, repo.Spec.Sync.IntervalSeconds)
}

func TestReconcileRepairsADivertedRepository(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.Spec.Type = provisioning.GitHubRepositoryType
		repo.Spec.GitHub = &provisioning.GitHubRepositoryConfig{URL: "https://github.com/acme/elsewhere"}
		repo.Spec.Workflows = []provisioning.Workflow{provisioning.BranchWorkflow}
		repo.Spec.Sync.Enabled = false
	}))

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, provisioning.LocalRepositoryType, repo.Spec.Type)
	assert.Nil(t, repo.Spec.GitHub)
	assert.Equal(t, []provisioning.Workflow{provisioning.WriteWorkflow}, repo.Spec.Workflows)
	assert.True(t, repo.Spec.Sync.Enabled)
}

func TestReconcileToleratesAnotherReplicaWinningTheCreate(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))
	client.PrependReactor("create", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewAlreadyExists(schema.GroupResource{Resource: "repositories"}, Name)
	})
	// The object is only in storage after the create was attempted, as it is for the replica
	// that lost the race.
	client.PrependReactor("get", "repositories", onceNotFound())

	assert.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))
}

func TestReconcileLeavesAnUnrelatedRepositoryOfTheSameNameAlone(t *testing.T) {
	unrelated := repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.LocalRepositoryType
		repo.Spec.Local = &provisioning.LocalRepositoryConfig{Path: "conf/provisioning/someone-elses"}
		repo.Spec.Sync = provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeFolderless}
	})
	client := newClientset(unrelated)

	err := Reconcile(context.Background(), repositories(client), noQueue(t), config)

	require.ErrorContains(t, err, "already exists and is not managed by file-provisioning")
	repo, getErr := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, getErr)
	assert.Equal(t, "conf/provisioning/someone-elses", repo.Spec.Local.Path,
		"repointing it would hand its resources to another source")
}

func TestReconcileLeavesARepositoryManagedByAnotherSystemAlone(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		metaOf(t, repo).SetManagerProperties(utils.ManagerProperties{
			Kind:     utils.ManagerKindTerraform,
			Identity: "terraform",
		})
	}))

	assert.ErrorContains(t, Reconcile(context.Background(), repositories(client), noQueue(t), config),
		"already exists and is not managed by file-provisioning")
}

// onceNotFound makes the first get report NotFound and lets every later one through.
func onceNotFound() clienttesting.ReactionFunc {
	var served bool
	return func(clienttesting.Action) (bool, runtime.Object, error) {
		if served {
			return false, nil, nil
		}
		served = true
		return true, nil, apierrors.NewNotFound(schema.GroupResource{Resource: "repositories"}, Name)
	}
}

// The hook runs once per boot, so a conflict dropped here would leave a changed bootstrap_path
// pointed at the old directory until the next restart.
func TestReconcileRetriesAnUpdateConflict(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.Spec.Local.Path = "conf/provisioning/stale"
	}))
	var updates int
	client.PrependReactor("update", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		if updates++; updates == 1 {
			return true, nil, apierrors.NewConflict(schema.GroupResource{Resource: "repositories"}, Name, errors.New("stale"))
		}
		return false, nil, nil
	})

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, config.Path, repo.Spec.Local.Path)
	assert.Equal(t, 2, updates, "the second attempt should re-read and retry")
}

func TestReconcileGivesUpOnPersistentConflicts(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.Spec.Local.Path = "conf/provisioning/stale"
	}))
	client.PrependReactor("update", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewConflict(schema.GroupResource{Resource: "repositories"}, Name, errors.New("stale"))
	})

	assert.Error(t, Reconcile(context.Background(), repositories(client), noQueue(t), config))
}

func TestReconcileReportsAFailedRead(t *testing.T) {
	client := newClientset()
	client.PrependReactor("get", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("boom")
	})

	assert.ErrorContains(t, Reconcile(context.Background(), repositories(client), noQueue(t), config), "read bootstrap repository")
}

func TestConfigEnabled(t *testing.T) {
	assert.True(t, config.Enabled())
	assert.False(t, Config{Namespace: namespace}.Enabled())
	assert.False(t, Config{Path: config.Path}.Enabled())

	// A cleared path is still reconcilable: that is how an earlier run's repository is stopped.
	assert.True(t, Config{Namespace: namespace}.Reconcilable())
	assert.False(t, Config{Path: config.Path}.Reconcilable())
}

// cleared is the configuration of an instance whose bootstrap_path has been removed. The
// namespace survives because it comes from the org, not from the setting.
var cleared = Config{Namespace: namespace}

// The repository persists a cleared path, and its old path can stay permitted on its own, so
// without this the controllers keep syncing it after a restart.
func TestReconcileStopsSyncWhenThePathIsCleared(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), cleared))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.False(t, repo.Spec.Sync.Enabled, "the controllers must stop reading the old path")
	// Clearing a setting must not delete an instance's dashboards; the repository is left for
	// an operator to remove deliberately.
	assert.Equal(t, config.Path, repo.Spec.Local.Path, "the repository itself is kept")
	assert.NotEmpty(t, repo.Spec.Workflows)
}

func TestReconcileLeavesAStoppedRepositoryAlone(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.Spec.Sync.Enabled = false
	}))
	client.ClearActions()

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), cleared))

	for _, action := range client.Actions() {
		assert.Equal(t, "get", action.GetVerb(), "an already stopped repository must not be rewritten")
	}
}

func TestReconcileDoesNotStopARepositoryItDoesNotOwn(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.LocalRepositoryType
		repo.Spec.Local = &provisioning.LocalRepositoryConfig{Path: "conf/provisioning/someone-elses"}
		repo.Spec.Sync = provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeFolderless}
	}))

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), cleared))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	assert.True(t, repo.Spec.Sync.Enabled, "an unrelated repository of the same name is not ours to stop")
}

func TestReconcileIsANoOpWhenNoRepositoryWasEverRegistered(t *testing.T) {
	client := newClientset()

	require.NoError(t, Reconcile(context.Background(), repositories(client), noQueue(t), cleared))

	_, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "nothing should be created when no path is configured")
}

func newClientset(objects ...runtime.Object) *fakeclientset.Clientset {
	//nolint:staticcheck // NewClientset requires schema registration not available for this type.
	return fakeclientset.NewSimpleClientset(objects...)
}

// noQueue is a drain that must not fail; the queue-specific cases assert on it directly.
type stubQueue struct {
	t       *testing.T
	drained []string
	err     error
}

func (q *stubQueue) CleanupQueue(_ context.Context, namespace, repository string) (int, error) {
	q.drained = append(q.drained, namespace+"/"+repository)
	return 0, q.err
}

func noQueue(t *testing.T) *stubQueue { return &stubQueue{t: t} }

func repositories(client *fakeclientset.Clientset) Repositories {
	return client.ProvisioningV0alpha1().Repositories(namespace)
}

func metaOf(t *testing.T, repo *provisioning.Repository) utils.GrafanaMetaAccessor {
	t.Helper()
	meta, err := utils.MetaAccessor(repo)
	require.NoError(t, err)
	return meta
}

func repositoryWith(mutate func(*provisioning.Repository)) *provisioning.Repository {
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: namespace},
	}
	mutate(repo)
	return repo
}

// Only scheduling consults sync.enabled, so a pull queued before the disable still runs -- and
// reads an empty repository if the directory went away with the setting.
func TestReconcileDrainsQueuedJobsWhenThePathIsCleared(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))
	queue := noQueue(t)

	require.NoError(t, Reconcile(context.Background(), repositories(client), queue, cleared))

	assert.Equal(t, []string{namespace + "/" + Name}, queue.drained,
		"the queue has to be cleared so no pull outlives the disable")
}

// The drain still has to run: the repository can already be disabled while a job queued before
// an earlier, failed attempt is waiting.
func TestReconcileDrainsQueuedJobsForAnAlreadyStoppedRepository(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.Spec.Sync.Enabled = false
	}))
	queue := noQueue(t)

	require.NoError(t, Reconcile(context.Background(), repositories(client), queue, cleared))

	assert.Equal(t, []string{namespace + "/" + Name}, queue.drained)
}

func TestReconcileDoesNotDrainARepositoryItDoesNotOwn(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.LocalRepositoryType
		repo.Spec.Local = &provisioning.LocalRepositoryConfig{Path: "conf/provisioning/someone-elses"}
		repo.Spec.Sync = provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeFolderless}
	}))
	queue := noQueue(t)

	require.NoError(t, Reconcile(context.Background(), repositories(client), queue, cleared))

	assert.Empty(t, queue.drained, "another manager's queue is not ours to clear")
}

func TestReconcileReportsAFailedDrain(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))
	queue := noQueue(t)
	queue.err = errors.New("boom")

	assert.ErrorContains(t, Reconcile(context.Background(), repositories(client), queue, cleared),
		"clear bootstrap repository job queue")
}
