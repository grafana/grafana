package repository

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_PendingDeleteLabel_SkipsReconciliation verifies that
// when a repository carries the pending-delete label the controller skips further
// reconciliation – in particular it never reaches the quota-getter call that would
// fail for a soft-deleted stack.
func TestIntegrationProvisioning_PendingDeleteLabel_SkipsReconciliation(t *testing.T) {
	helper := sharedHelper(t)

	const repoName = "pending-delete-skip-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repoName,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// After the initial sync the controller has observed the current spec, so
	// Generation == ObservedGeneration.
	repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	initialRepo := common.MustFromUnstructured[provisioning.Repository](t, repoObj)
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
	labels[common.LabelPendingDelete] = "true"
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
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		return repo.Status.ObservedGeneration >= newGeneration
	}, 10*time.Second, 200*time.Millisecond,
		"ObservedGeneration must not advance while the pending-delete label is set (reconciliation should be skipped)")

	// Sanity-check: removing the label causes the controller to process the spec
	// change normally and advance ObservedGeneration.
	repoObj, err = helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	labels = repoObj.GetLabels()
	delete(labels, common.LabelPendingDelete)
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
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, provisioning.JobStateSuccess, repo.Status.Sync.State,
			"repository should reach success sync state after label removal")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"repository should reconcile successfully once the pending-delete label is removed")
}

// TestIntegrationProvisioning_RepositoryPendingDeleteAdmission verifies that the
// admission webhook enforces pending-delete semantics on Repository resources.
func TestIntegrationProvisioning_RepositoryPendingDeleteAdmission(t *testing.T) {
	helper := sharedHelper(t)

	// createRepo creates a local repository and returns immediately — no health wait.
	// Sufficient for tests that exercise the admission webhook synchronously.
	createRepo := func(t *testing.T, name string) {
		t.Helper()
		repoObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Pending Delete Admission Test",
				"type":  "local",
				"sync": map[string]any{
					"enabled": false,
				},
				"local": map[string]any{
					"path": helper.ProvisioningPath,
				},
			},
		}}
		_, err := helper.Repositories.Resource.Create(t.Context(), repoObj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Run("create with pending-delete label is forbidden", func(t *testing.T) {
		repoObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "pd-repo-admission-create",
				"namespace": "default",
				"labels": map[string]any{
					common.LabelPendingDelete: "true",
				},
			},
			"spec": map[string]any{
				"title": "Pending Delete Admission Test",
				"type":  "local",
				"sync": map[string]any{
					"enabled": false,
				},
				"local": map[string]any{
					"path": helper.ProvisioningPath,
				},
			},
		}}
		_, err := helper.Repositories.Resource.Create(t.Context(), repoObj, metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsForbidden(err),
			"expected Forbidden when creating a repository with the pending-delete label, got: %v", err)
	})

	t.Run("update blocked when both old and new have pending-delete label", func(t *testing.T) {
		const repoName = "pd-repo-admission-update-blocked"
		createRepo(t, repoName)
		common.SetPendingDeleteLabel(t, helper.Repositories.Resource, repoName)

		// Always re-Get to avoid stale resourceVersion conflicts from concurrent status updates.
		err := common.RetryOnConflict(t, func() error {
			obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			if err != nil {
				return err
			}
			obj.Object["spec"].(map[string]interface{})["title"] = "Modified Title"
			_, err = helper.Repositories.Resource.Update(t.Context(), obj, metav1.UpdateOptions{})
			return err
		})
		require.Error(t, err)
		require.True(t, k8serrors.IsForbidden(err),
			"expected Forbidden when mutating a pending-delete repository, got: %v", err)
	})

	t.Run("status subresource update allowed with pending-delete label", func(t *testing.T) {
		const repoName = "pd-repo-admission-status-update"
		createRepo(t, repoName)
		common.SetPendingDeleteLabel(t, helper.Repositories.Resource, repoName)

		// Echo back the current object via UpdateStatus. The admission webhook must
		// pass status-subresource requests through without a Forbidden rejection,
		// regardless of whether the pending-delete label is set.
		err := common.RetryOnConflict(t, func() error {
			obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			if err != nil {
				return err
			}
			_, err = helper.Repositories.Resource.UpdateStatus(t.Context(), obj, metav1.UpdateOptions{})
			return err
		})
		require.NoError(t, err, "status subresource update must be allowed even when the pending-delete label is set")
	})

	t.Run("removing pending-delete label via update is allowed", func(t *testing.T) {
		const repoName = "pd-repo-admission-remove-label"
		createRepo(t, repoName)
		common.SetPendingDeleteLabel(t, helper.Repositories.Resource, repoName)

		// Always re-Get to avoid stale resourceVersion conflicts from concurrent status updates.
		err := common.RetryOnConflict(t, func() error {
			obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			if err != nil {
				return err
			}
			labels := obj.GetLabels()
			delete(labels, common.LabelPendingDelete)
			obj.SetLabels(labels)
			_, err = helper.Repositories.Resource.Update(t.Context(), obj, metav1.UpdateOptions{})
			return err
		})
		require.NoError(t, err, "removing the pending-delete label should be allowed")
	})
}
