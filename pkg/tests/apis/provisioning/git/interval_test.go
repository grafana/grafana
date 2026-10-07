package git

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_GitSyncIntervalNoop guards against unchanged Git refs
// leaving polling permanently overdue. After a completed sync is aged past the
// interval, reconciliation must advance only lastChecked, preserve the previous
// job's status, and create no job. Reconciling again before the next interval must
// leave sync status unchanged.
func TestIntegrationProvisioning_GitSyncIntervalNoop(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "git-interval-noop"
	helper.CreateSyncEnabledGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("interval-noop", "Interval Dashboard", 1),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	repoObj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)
	original := common.MustFromUnstructured[provisioning.Repository](t, repoObj).Status.Sync
	require.Equal(t, provisioning.JobStateSuccess, original.State)
	require.NotZero(t, original.Finished)
	require.NotEmpty(t, original.LastRef)
	require.NotEmpty(t, original.JobID)

	history, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{}, "jobs")
	require.NoError(t, err)
	initialJobs, err := history.ToList()
	require.NoError(t, err)
	require.NotEmpty(t, initialJobs.Items)

	// Age status without changing the spec, which would force a full sync.
	staleFinished := time.Now().Add(-time.Hour).UnixMilli()
	patch := []byte(fmt.Sprintf(`{"status":{"sync":{"finished":%d}}}`, staleFinished))
	before := time.Now().UnixMilli()
	_, err = helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
	require.NoError(t, err)
	helper.TriggerRepositoryReconciliation(t, repoName)

	var refreshed provisioning.SyncStatus
	var stableSince time.Time
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(c, err) {
			return
		}
		current := repo.Status.Sync
		if !assert.GreaterOrEqual(c, current.LastChecked, before, "an unchanged ref must reset the sync interval") {
			return
		}
		// Queued reconciliations may still see the old informer snapshot until the status update arrives.
		if !assert.ObjectsAreEqual(refreshed, current) {
			refreshed = current
			stableSince = time.Now()
		}
		assert.GreaterOrEqual(c, time.Since(stableSince), time.Second, "sync status should settle after the informer observes the update")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	expected := original
	expected.Finished = staleFinished
	expected.LastChecked = refreshed.LastChecked
	require.Equal(t, expected, refreshed, "a no-op check must preserve the previous sync job's status")

	helper.TriggerRepositoryReconciliation(t, repoName)
	require.Never(t, func() bool {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(t, err) {
			return true
		}
		current, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(t, err) {
			return true
		}
		return !assert.Equal(t, refreshed, current.Status.Sync)
	}, time.Second, common.WaitIntervalDefault, "reconciliation before the next interval must leave sync status unchanged")

	activeJobs, err := helper.Jobs.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, activeJobs.Items, "no-op interval checks must not create sync jobs")
	history, err = helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{}, "jobs")
	require.NoError(t, err)
	currentJobs, err := history.ToList()
	require.NoError(t, err)
	require.ElementsMatch(t, initialJobs.Items, currentJobs.Items, "no-op interval checks must not add completed jobs")
}

func TestIntegrationProvisioning_GitSyncIntervalChangedRef(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "git-interval-changed"
	_, local := helper.CreateSyncEnabledGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("interval-changed-1", "First Dashboard", 1),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	require.NoError(t, local.CreateFile("dashboard2.json", string(common.DashboardJSON("interval-changed-2", "Second Dashboard", 1))))
	gitCommitPush(t, local, "add second dashboard")
	ref, err := local.Git("rev-parse", "HEAD")
	require.NoError(t, err)
	latestRef := strings.TrimSpace(ref)

	stale := time.Now().Add(-time.Hour).UnixMilli()
	patch := []byte(fmt.Sprintf(`{"status":{"sync":{"finished":%d,"lastChecked":%d}}}`, stale, stale))
	before := time.Now().UnixMilli()
	_, err = helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
	require.NoError(t, err)
	helper.TriggerRepositoryReconciliation(t, repoName)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(c, err) {
			return
		}
		assert.Equal(c, provisioning.JobStateSuccess, repo.Status.Sync.State)
		assert.Equal(c, latestRef, repo.Status.Sync.LastRef)
		assert.GreaterOrEqual(c, repo.Status.Sync.LastChecked, before, "a changed ref must also refresh the check timestamp")
		assert.GreaterOrEqual(c, repo.Status.Sync.Finished, repo.Status.Sync.LastChecked, "job completion must preserve the preceding check timestamp")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	helper.RequireRepoDashboardCount(t, repoName, 2)
}
