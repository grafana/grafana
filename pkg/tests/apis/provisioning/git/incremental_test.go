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

// TestIntegrationProvisioning_IncrementalGitSync verifies that incremental sync
// correctly applies file-level changes (add, update, delete) from a real git
// repository without re-processing the entire tree on each sync.
//
// Changes are committed via Grafana's repository write API (files subresource)
// so that each operation creates a real git commit, advancing the ref that
// incremental sync compares against. Sub-tests share a single Grafana + Gitea
// instance so that LastRef state carries over between syncs.
func TestIntegrationProvisioning_IncrementalGitSync(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-repo"

	// Seed the git repo with one dashboard so the initial full sync has something
	// to import. The "write" workflow is required for the files API calls below.
	_, _ = helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write")

	// Initial full sync imports dashboard1.
	helper.syncAndWait(t, repoName)
	requireDashboardCount(t, helper, ctx, 1)

	t.Run("incremental sync adds new dashboard", func(t *testing.T) {
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("message", "add dashboard2").
			Body(dashboardJSON("incr-dash-002", "Dashboard Two", 1)).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "failed to create dashboard2.json via files API")

		helper.syncAndWaitIncremental(t, repoName)
		requireDashboardCount(t, helper, ctx, 2)
	})

	t.Run("incremental sync updates existing dashboard", func(t *testing.T) {
		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard1.json").
			Param("message", "update dashboard1 title").
			Body(dashboardJSON("incr-dash-001", "Dashboard One Updated", 2)).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "failed to update dashboard1.json via files API")

		helper.syncAndWaitIncremental(t, repoName)
		requireDashboardCount(t, helper, ctx, 2)
		requireDashboardTitle(t, helper, ctx, "incr-dash-001", "Dashboard One Updated")
	})

	t.Run("incremental sync deletes removed dashboard", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("message", "delete dashboard2").
			Do(ctx)
		require.NoError(t, result.Error(), "failed to delete dashboard2.json via files API")

		helper.syncAndWaitIncremental(t, repoName)
		requireDashboardCount(t, helper, ctx, 1)

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			_, err := helper.DashboardsV1.Resource.Get(ctx, "incr-dash-002", metav1.GetOptions{})
			assert.True(c, apierrors.IsNotFound(err), "dashboard incr-dash-002 should be deleted")
		}, waitTimeoutDefault, waitIntervalDefault, "deleted dashboard should be removed from Grafana")
	})

	t.Run("incremental sync is a noop when there are no changes", func(t *testing.T) {
		helper.syncAndWaitIncremental(t, repoName)
		requireDashboardCount(t, helper, ctx, 1)
	})
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
