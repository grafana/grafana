package git

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_IncrementalGitSync_Add verifies that incremental
// sync imports a newly committed file without re-processing the full tree.
func TestIntegrationProvisioning_IncrementalGitSync_Add(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-add"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)

	require.NoError(t, local.CreateFile("dashboard2.json", string(dashboardJSON("incr-dash-002", "Dashboard Two", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard2")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboardCount(t, helper, ctx, 2)
}

// TestIntegrationProvisioning_IncrementalGitSync_Update verifies that
// incremental sync applies an in-place file modification.
func TestIntegrationProvisioning_IncrementalGitSync_Update(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-update"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)

	require.NoError(t, local.UpdateFile("dashboard1.json", string(dashboardJSON("incr-dash-001", "Dashboard One Updated", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "update dashboard1 title")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)
	requireDashboardTitle(t, helper, ctx, "incr-dash-001", "Dashboard One Updated")
}

// TestIntegrationProvisioning_IncrementalGitSync_Delete verifies that
// incremental sync removes a dashboard whose file was deleted from the repo.
func TestIntegrationProvisioning_IncrementalGitSync_Delete(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-delete"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
		"dashboard2.json": dashboardJSON("incr-dash-002", "Dashboard Two", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboardCount(t, helper, ctx, 2)

	_, err := local.Git("rm", "dashboard2.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "delete dashboard2")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "incr-dash-002", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "dashboard incr-dash-002 should be deleted")
	}, waitTimeoutDefault, waitIntervalDefault, "deleted dashboard should be removed from Grafana")
}

// TestIntegrationProvisioning_IncrementalGitSync_Noop verifies that incremental
// sync is a no-op when there are no new commits since the last sync.
func TestIntegrationProvisioning_IncrementalGitSync_Noop(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-noop"

	helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)
}

// TestIntegrationProvisioning_IncrementalGitSync_Rename verifies that
// incremental sync handles a file rename (git mv) without losing the dashboard.
// The dashboard UID and title should be preserved after the rename.
func TestIntegrationProvisioning_IncrementalGitSync_Rename(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)
	requireDashboardTitle(t, helper, ctx, "incr-dash-001", "Dashboard One")

	_, err := local.Git("mv", "dashboard1.json", "renamed-dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename dashboard1")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)
	requireDashboardTitle(t, helper, ctx, "incr-dash-001", "Dashboard One")
}

// requireDashboardCount asserts the total number of dashboards in the instance.
func requireDashboardCount(t *testing.T, h *gitTestHelper, ctx context.Context, expected int) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		assert.Len(c, list.Items, expected, "unexpected dashboard count")
	}, waitTimeoutDefault, waitIntervalDefault, "expected %d dashboard(s)", expected)
}

// requireDashboardTitle asserts that the dashboard with the given uid (K8s name)
// has the expected title. Classic dashboards store their full JSON under spec,
// so the title lives at spec.title.
func requireDashboardTitle(t *testing.T, h *gitTestHelper, ctx context.Context, uid, expectedTitle string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		for _, d := range list.Items {
			if d.GetName() != uid {
				continue
			}
			title, _, _ := unstructured.NestedString(d.Object, "spec", "title")
			assert.Equal(c, expectedTitle, title, "dashboard %q title mismatch", uid)
			return
		}
		c.Errorf("dashboard with uid %q not found", uid)
	}, waitTimeoutDefault, waitIntervalDefault, "dashboard %q should have title %q", uid, expectedTitle)
}
