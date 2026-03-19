package repository

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// labelPendingDelete mirrors the constant defined in the repository controller
// (pkg/registry/apis/provisioning/controller/repository.go) and written by the
// tenant watcher (pkg/storage/unified/resource/tenant_watcher.go).
const labelPendingDelete = "cloud.grafana.com/pending-delete"

// TestIntegrationProvisioning_PendingDeleteLabel_SkipsReconciliation verifies that
// when a repository carries the pending-delete label the controller skips further
// reconciliation – in particular it never reaches the quota-getter call that would
// fail for a soft-deleted stack.
func TestIntegrationProvisioning_PendingDeleteLabel_SkipsReconciliation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)

	const repoName = "pending-delete-skip-test"
	helper.CreateRepo(t, common.TestRepo{
		Name:                   repoName,
		Target:                 "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.SyncAndWait(t, repoName, nil)

	// After the initial sync the controller has observed the current spec, so
	// Generation == ObservedGeneration.
	repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	initialRepo := common.UnstructuredToRepository(t, repoObj)
	require.Equal(t, initialRepo.Generation, initialRepo.Status.ObservedGeneration,
		"generation and observedGeneration should match after initial sync")

	// Mutate the spec (changing the sync interval increments metadata.Generation)
	// and simultaneously set the pending-delete label.  Both mutations go in one
	// Update so the controller sees the label from the very first reconcile attempt.
	newInterval := initialRepo.Spec.Sync.IntervalSeconds + 10
	repoObj.Object["spec"].(map[string]interface{})["sync"].(map[string]interface{})["intervalSeconds"] = newInterval

	labels := repoObj.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[labelPendingDelete] = "true"
	repoObj.SetLabels(labels)

	updatedObj, err := helper.Repositories.Resource.Update(t.Context(), repoObj, metav1.UpdateOptions{})
	require.NoError(t, err)

	newGeneration := updatedObj.GetGeneration()
	require.Greater(t, newGeneration, initialRepo.Generation,
		"spec change should have incremented generation")

	// Poke the controller so it processes the updated object promptly.
	helper.TriggerRepositoryReconciliation(t, repoName)

	// For the next 10 seconds ObservedGeneration must never advance to the new
	// generation.  Without the early-exit the controller would update it within
	// a few seconds; the 10 s window is therefore a reliable upper bound.
	require.Never(t, func() bool {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if err != nil {
			return false
		}
		repo := common.UnstructuredToRepository(t, obj)
		return repo.Status.ObservedGeneration >= newGeneration
	}, 10*time.Second, 200*time.Millisecond,
		"ObservedGeneration must not advance while the pending-delete label is set (reconciliation should be skipped)")

	// Sanity-check: removing the label causes the controller to process the spec
	// change normally and advance ObservedGeneration.
	repoObj, err = helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	labels = repoObj.GetLabels()
	delete(labels, labelPendingDelete)
	repoObj.SetLabels(labels)

	_, err = helper.Repositories.Resource.Update(t.Context(), repoObj, metav1.UpdateOptions{})
	require.NoError(t, err)

	helper.TriggerRepositoryReconciliation(t, repoName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		assert.NoError(collect, err)
		if err != nil {
			return
		}
		repo := common.UnstructuredToRepository(t, obj)
		assert.Equal(collect, provisioning.JobStateSuccess, repo.Status.Sync.State,
			"repository should reach success sync state after label removal")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"repository should reconcile successfully once the pending-delete label is removed")
}
