package jobs

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	clienttesting "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fakeclientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// newFilteringClientset returns a fake clientset whose job list honours the
// label selector. The default fake tracker filters by namespace only, so
// without this the selector CleanupQueue relies on would be silently ignored.
func newFilteringClientset() *fakeclientset.Clientset {
	//nolint:staticcheck // NewSimpleClientset is needed; NewClientset requires schema registration not available for this type.
	fc := fakeclientset.NewSimpleClientset()
	fc.PrependReactor("list", "jobs", func(action clienttesting.Action) (bool, runtime.Object, error) {
		la := action.(clienttesting.ListAction)
		obj, err := fc.Tracker().List(la.GetResource(), provisioning.JobResourceInfo.GroupVersionKind(), la.GetNamespace())
		if err != nil {
			return true, nil, err
		}
		list := obj.(*provisioning.JobList)
		selector := la.GetListRestrictions().Labels
		if selector == nil || selector.Empty() {
			return true, list, nil
		}
		filtered := &provisioning.JobList{}
		for _, job := range list.Items {
			if selector.Matches(labels.Set(job.Labels)) {
				filtered.Items = append(filtered.Items, job)
			}
		}
		return true, filtered, nil
	})
	return fc
}

func createJob(ctx context.Context, t *testing.T, client *fakeclientset.Clientset, ns, name, repo string, claimed bool) {
	t.Helper()
	jobLabels := map[string]string{LabelRepository: repo}
	if claimed {
		jobLabels[LabelJobClaim] = "123456789"
		jobLabels[LabelJobClaimOwner] = "worker-1"
	}
	createJobWith(ctx, t, client, ns, name, jobLabels, provisioning.JobSpec{Repository: repo, Action: provisioning.JobActionPull})
}

func createJobWith(ctx context.Context, t *testing.T, client *fakeclientset.Clientset, ns, name string, jobLabels map[string]string, spec provisioning.JobSpec) {
	t.Helper()
	_, err := client.ProvisioningV0alpha1().Jobs(ns).Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns, Labels: jobLabels},
		Spec:       spec,
	}, metav1.CreateOptions{})
	require.NoError(t, err)
}

// TestCleanupQueue_DeletesOnlyUnclaimedJobsForRepository verifies that clearing
// a repository's queue removes its pending jobs while leaving executing (claimed)
// jobs and jobs belonging to other repositories untouched.
func TestCleanupQueue_DeletesOnlyUnclaimedJobsForRepository(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	createJob(ctx, t, fakeClient, "stacks-123", "repo-a-pending-1", "repo-a", false)
	createJob(ctx, t, fakeClient, "stacks-123", "repo-a-pending-2", "repo-a", false)
	createJob(ctx, t, fakeClient, "stacks-123", "repo-a-running", "repo-a", true)
	createJob(ctx, t, fakeClient, "stacks-123", "repo-b-pending", "repo-b", false)

	deleted, err := store.CleanupQueue(ctx, "stacks-123", "repo-a")
	require.NoError(t, err)
	assert.Equal(t, 2, deleted)

	remaining, err := fakeClient.ProvisioningV0alpha1().Jobs("stacks-123").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)

	names := make([]string, 0, len(remaining.Items))
	for _, job := range remaining.Items {
		names = append(names, job.GetName())
	}
	assert.ElementsMatch(t, []string{"repo-a-running", "repo-b-pending"}, names)
}

// TestCleanupQueue_NoJobs verifies that clearing an empty queue is a no-op.
func TestCleanupQueue_NoJobs(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	deleted, err := store.CleanupQueue(ctx, "stacks-123", "repo-a")
	require.NoError(t, err)
	assert.Equal(t, 0, deleted)
}

// TestCleanupQueue_InvalidRepositoryLabel verifies that a repository name that
// is not a valid label value does not block deletion: no job could have been
// queued under such a name, so cleanup is a no-op rather than an error.
func TestCleanupQueue_InvalidRepositoryLabel(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	longName := strings.Repeat("a", 64) // exceeds the 63-character label value limit
	deleted, err := store.CleanupQueue(ctx, "stacks-123", longName)
	require.NoError(t, err)
	assert.Equal(t, 0, deleted)
}

// TestCleanupQueue_DeletesJobsMatchedBySpecRepository verifies that a pending
// job created without the repository label (e.g. via the jobs resource directly)
// is still cleared, because matching is done on spec.Repository.
func TestCleanupQueue_DeletesJobsMatchedBySpecRepository(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	// No LabelRepository, only spec.Repository.
	createJobWith(ctx, t, fakeClient, "stacks-123", "unlabeled", nil,
		provisioning.JobSpec{Repository: "repo-a", Action: provisioning.JobActionPull})

	deleted, err := store.CleanupQueue(ctx, "stacks-123", "repo-a")
	require.NoError(t, err)
	assert.Equal(t, 1, deleted)

	remaining, err := fakeClient.ProvisioningV0alpha1().Jobs("stacks-123").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	assert.Empty(t, remaining.Items)
}

// TestCleanupQueue_RetriesDeleteWhenConflictIsNotAClaim verifies that a delete
// conflict caused by something other than a worker claim -- e.g. an unrelated
// update to a still-pending job, or a delete+recreate of the deterministic job
// name between the List and the Delete -- does not leave the job behind. On
// conflict the store re-fetches, sees no claim label, and retries the delete.
func TestCleanupQueue_RetriesDeleteWhenConflictIsNotAClaim(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	createJob(ctx, t, fakeClient, "stacks-123", "repo-a-pending", "repo-a", false)

	// Fail the first delete with a conflict (RV moved on), then let the retry
	// through to the tracker. The re-fetch returns the still-unclaimed job.
	var deleteCalls int
	fakeClient.PrependReactor("delete", "jobs", func(action clienttesting.Action) (bool, runtime.Object, error) {
		deleteCalls++
		if deleteCalls == 1 {
			return true, nil, newConflictError()
		}
		return false, nil, nil
	})

	deleted, err := store.CleanupQueue(ctx, "stacks-123", "repo-a")
	require.NoError(t, err)
	assert.Equal(t, 1, deleted)
	assert.Equal(t, 2, deleteCalls, "expected a retry after the conflict")

	remaining, err := fakeClient.ProvisioningV0alpha1().Jobs("stacks-123").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	assert.Empty(t, remaining.Items)
}

// TestCleanupQueue_SkipsJobClaimedAfterList verifies that a job claimed by a
// worker between the List and the Delete is left in place: on the delete
// conflict the store re-fetches, finds the claim label, and skips it.
func TestCleanupQueue_SkipsJobClaimedAfterList(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	createJob(ctx, t, fakeClient, "stacks-123", "repo-a-pending", "repo-a", false)

	// The delete always conflicts, and the re-fetch reports the job as claimed,
	// simulating a worker that grabbed it after our List.
	fakeClient.PrependReactor("delete", "jobs", func(action clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, newConflictError()
	})
	fakeClient.PrependReactor("get", "jobs", func(action clienttesting.Action) (bool, runtime.Object, error) {
		return true, &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "repo-a-pending",
				Namespace: "stacks-123",
				Labels: map[string]string{
					LabelRepository:    "repo-a",
					LabelJobClaim:      "123456789",
					LabelJobClaimOwner: "worker-1",
				},
			},
			Spec: provisioning.JobSpec{Repository: "repo-a", Action: provisioning.JobActionPull},
		}, nil
	})

	deleted, err := store.CleanupQueue(ctx, "stacks-123", "repo-a")
	require.NoError(t, err)
	assert.Equal(t, 0, deleted)

	remaining, err := fakeClient.ProvisioningV0alpha1().Jobs("stacks-123").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, remaining.Items, 1)
	assert.Equal(t, "repo-a-pending", remaining.Items[0].GetName())
}

// TestCleanupQueue_PreservesOrphanCleanupJobs verifies that releaseResources and
// deleteResources jobs are left in the queue: an admin may enqueue them against a
// terminating repository as a recovery path, so clearing them would defeat it.
func TestCleanupQueue_PreservesOrphanCleanupJobs(t *testing.T) {
	fakeClient := newFilteringClientset()
	store := newTestStore(fakeClient.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	createJob(ctx, t, fakeClient, "stacks-123", "repo-a-pending", "repo-a", false)
	createJobWith(ctx, t, fakeClient, "stacks-123", "repo-a-release", map[string]string{LabelRepository: "repo-a"},
		provisioning.JobSpec{Repository: "repo-a", Action: provisioning.JobActionReleaseResources})
	createJobWith(ctx, t, fakeClient, "stacks-123", "repo-a-delete", map[string]string{LabelRepository: "repo-a"},
		provisioning.JobSpec{Repository: "repo-a", Action: provisioning.JobActionDeleteResources})

	deleted, err := store.CleanupQueue(ctx, "stacks-123", "repo-a")
	require.NoError(t, err)
	assert.Equal(t, 1, deleted)

	remaining, err := fakeClient.ProvisioningV0alpha1().Jobs("stacks-123").List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	names := make([]string, 0, len(remaining.Items))
	for _, job := range remaining.Items {
		names = append(names, job.GetName())
	}
	assert.ElementsMatch(t, []string{"repo-a-release", "repo-a-delete"}, names)
}
