package jobs

import (
	"context"
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
		la := action.(clienttesting.ListActionImpl)
		obj, err := fc.Tracker().List(la.GetResource(), la.GetKind(), la.GetNamespace())
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
	_, err := client.ProvisioningV0alpha1().Jobs(ns).Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns, Labels: jobLabels},
		Spec:       provisioning.JobSpec{Repository: repo, Action: provisioning.JobActionPull},
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
