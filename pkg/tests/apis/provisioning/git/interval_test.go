package git

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_GitSyncIntervalNoopRefreshesFinished verifies that
// an interval sync with no new repository changes refreshes status.sync.finished
// instead of leaving the controller to consider the interval stale on every reconcile.
func TestIntegrationProvisioning_GitSyncIntervalNoopRefreshesFinished(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "git-interval-noop-refresh"
	helper.CreateSyncEnabledGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("interval-noop-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)

	repo := common.MustFromUnstructured[provisioning.Repository](t, repoObj)
	require.NotZero(t, repo.Status.Sync.Finished, "initial sync should set status.sync.finished")
	require.NotEmpty(t, repo.Status.Sync.LastRef, "initial sync should record the repository ref")

	staleFinished := time.Now().Add(-time.Hour).UnixMilli()
	require.NoError(t, common.RetryOnConflict(t, func() error {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if err != nil {
			return err
		}

		status, ok := obj.Object["status"].(map[string]interface{})
		if !ok {
			return assert.AnError
		}
		syncStatus, ok := status["sync"].(map[string]interface{})
		if !ok {
			return assert.AnError
		}
		syncStatus["finished"] = staleFinished
		_, err = helper.Repositories.Resource.UpdateStatus(t.Context(), obj, metav1.UpdateOptions{})
		return err
	}), "failed to make the interval sync status stale")

	helper.TriggerRepositoryReconciliation(t, repoName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}

		current := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Greater(collect, current.Status.Sync.Finished, staleFinished,
			"no-op interval sync should refresh status.sync.finished")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"status.sync.finished should be refreshed by the no-op interval sync")
}
