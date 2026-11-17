package bootstrap

import (
	"context"
	"errors"
	"testing"
	"time"

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

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

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

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

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

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	manager, _ := metaOf(t, repo).GetManagerProperties()
	assert.False(t, manager.AllowsEdits, "its configuration still comes from bootstrap_path")
}

func TestReconcileIsIdempotent(t *testing.T) {
	client := newClientset()
	require.NoError(t, Reconcile(context.Background(), repositories(client), config))
	client.ClearActions()

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

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

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

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

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

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

	assert.NoError(t, Reconcile(context.Background(), repositories(client), config))
}

func TestReconcileLeavesAnUnrelatedRepositoryOfTheSameNameAlone(t *testing.T) {
	unrelated := repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.LocalRepositoryType
		repo.Spec.Local = &provisioning.LocalRepositoryConfig{Path: "conf/provisioning/someone-elses"}
		repo.Spec.Sync = provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeFolderless}
	})
	client := newClientset(unrelated)

	err := Reconcile(context.Background(), repositories(client), config)

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

	assert.ErrorContains(t, Reconcile(context.Background(), repositories(client), config),
		"already exists and is not managed by file-provisioning")
}

// onceThen lets the first get through and serves obj to every later one.
func onceThen(obj runtime.Object) clienttesting.ReactionFunc {
	var served bool
	return func(clienttesting.Action) (bool, runtime.Object, error) {
		if !served {
			served = true
			return false, nil, nil
		}
		return true, obj, nil
	}
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

	require.NoError(t, Reconcile(context.Background(), repositories(client), config))

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

	assert.Error(t, Reconcile(context.Background(), repositories(client), config))
}

func TestReconcileReportsAFailedRead(t *testing.T) {
	client := newClientset()
	client.PrependReactor("get", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("boom")
	})

	assert.ErrorContains(t, Reconcile(context.Background(), repositories(client), config), "read bootstrap repository")
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

// Deleting it is what removes the job queue and the resources it provisioned, so nothing is
// left managed by a source the configuration no longer names.
func TestReconcileRemovesTheRepositoryWhenThePathIsCleared(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))

	require.NoError(t, Reconcile(context.Background(), repositories(client), cleared))

	_, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "the repository should be gone, got %v", err)
}

func TestReconcileLeavesATerminatingRepositoryAlone(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.DeletionTimestamp = &metav1.Time{Time: time.Now()}
	}))
	client.ClearActions()

	require.NoError(t, Reconcile(context.Background(), repositories(client), cleared))

	for _, action := range client.Actions() {
		assert.Equal(t, "get", action.GetVerb(), "a repository whose finalizers are running must not be deleted again")
	}
}

// A name-only delete would remove a replacement created in the window after the ownership
// check, and with it everything that replacement manages.
func TestReconcileDeletesOnlyTheObjectItVouchedFor(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		config.apply(repo)
		repo.UID = "the-one-we-read"
	}))

	require.NoError(t, Reconcile(context.Background(), repositories(client), cleared))

	var deletes int
	for _, action := range client.Actions() {
		del, ok := action.(clienttesting.DeleteActionImpl)
		if !ok {
			continue
		}
		deletes++
		require.NotNil(t, del.DeleteOptions.Preconditions, "the delete must be bound to a UID")
		assert.EqualValues(t, "the-one-we-read", *del.DeleteOptions.Preconditions.UID)
	}
	assert.Equal(t, 1, deletes)
}

// The precondition fails as a conflict, so the retry re-reads and finds the replacement is
// someone else's.
func TestReconcileLeavesAReplacementItDidNotReadAlone(t *testing.T) {
	replacement := repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.LocalRepositoryType
		repo.Spec.Local = &provisioning.LocalRepositoryConfig{Path: "conf/provisioning/someone-elses"}
	})
	client := newClientset(repositoryWith(config.apply))
	client.PrependReactor("get", "repositories", onceThen(replacement))
	var deletes int
	client.PrependReactor("delete", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		deletes++
		return true, nil, apierrors.NewConflict(schema.GroupResource{Resource: "repositories"}, Name, errors.New("uid mismatch"))
	})

	require.NoError(t, Reconcile(context.Background(), repositories(client), cleared))

	assert.Equal(t, 1, deletes, "the re-read must stop at the replacement, not delete it")
}

// Another replica deleting it between our read and our delete is the outcome we wanted.
func TestReconcileToleratesTheRepositoryBeingGoneBeforeTheDelete(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))
	client.PrependReactor("delete", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewNotFound(schema.GroupResource{Resource: "repositories"}, Name)
	})

	assert.NoError(t, Reconcile(context.Background(), repositories(client), cleared))
}

func TestReconcileReportsAFailedDelete(t *testing.T) {
	client := newClientset(repositoryWith(config.apply))
	client.PrependReactor("delete", "repositories", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("boom")
	})

	assert.ErrorContains(t, Reconcile(context.Background(), repositories(client), cleared),
		"delete bootstrap repository")
}

func TestReconcileDoesNotRemoveARepositoryItDoesNotOwn(t *testing.T) {
	client := newClientset(repositoryWith(func(repo *provisioning.Repository) {
		repo.Spec.Type = provisioning.LocalRepositoryType
		repo.Spec.Local = &provisioning.LocalRepositoryConfig{Path: "conf/provisioning/someone-elses"}
		repo.Spec.Sync = provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeFolderless}
	}))

	require.NoError(t, Reconcile(context.Background(), repositories(client), cleared))

	repo, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err, "an unrelated repository of the same name is not ours to remove")
	assert.Equal(t, "conf/provisioning/someone-elses", repo.Spec.Local.Path)
}

func TestReconcileIsANoOpWhenNoRepositoryWasEverRegistered(t *testing.T) {
	client := newClientset()

	require.NoError(t, Reconcile(context.Background(), repositories(client), cleared))

	_, err := repositories(client).Get(context.Background(), Name, metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "nothing should be created when no path is configured")
}

func newClientset(objects ...runtime.Object) *fakeclientset.Clientset {
	//nolint:staticcheck // NewClientset requires schema registration not available for this type.
	return fakeclientset.NewSimpleClientset(objects...)
}

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
