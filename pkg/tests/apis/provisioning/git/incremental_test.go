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

// expectedDashboard describes the expected state of a single dashboard.
type expectedDashboard struct {
	Title      string
	SourcePath string
}

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
func TestIntegrationProvisioning_IncrementalGitSync_Rename(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"incr-dash-001": {Title: "Dashboard One", SourcePath: "dashboard1.json"},
	})

	_, err := local.Git("mv", "dashboard1.json", "renamed-dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename dashboard1")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"incr-dash-001": {Title: "Dashboard One", SourcePath: "renamed-dashboard1.json"},
	})
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveIntoFolder verifies that
// incremental sync handles moving a dashboard from root into a subfolder.
func TestIntegrationProvisioning_IncrementalGitSync_MoveIntoFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-into-folder"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("move-in-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"move-in-001": {Title: "Dashboard One", SourcePath: "dashboard1.json"},
	})

	require.NoError(t, local.CreateDirPath("team-a"))
	_, err := local.Git("mv", "dashboard1.json", "team-a/dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard into team-a folder")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"move-in-001": {Title: "Dashboard One", SourcePath: "team-a/dashboard1.json"},
	})
	requireRepoFolders(t, helper, ctx, repoName, []string{"team-a"})
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveBetweenFolders verifies
// that incremental sync handles moving a dashboard from one folder to another.
func TestIntegrationProvisioning_IncrementalGitSync_MoveBetweenFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-between"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"folder-a/dashboard1.json": dashboardJSON("move-btwn-001", "Dashboard Between", 1),
		"folder-b/.keep":           {},
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"move-btwn-001": {Title: "Dashboard Between", SourcePath: "folder-a/dashboard1.json"},
	})

	_, err := local.Git("mv", "folder-a/dashboard1.json", "folder-b/dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard from folder-a to folder-b")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"move-btwn-001": {Title: "Dashboard Between", SourcePath: "folder-b/dashboard1.json"},
	})
	requireRepoFolders(t, helper, ctx, repoName, []string{"folder-a", "folder-b"})
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveToRoot verifies that
// incremental sync handles moving a dashboard from a subfolder back to root.
func TestIntegrationProvisioning_IncrementalGitSync_MoveToRoot(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-to-root"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"team-x/dashboard1.json": dashboardJSON("move-root-001", "Dashboard Root", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"move-root-001": {Title: "Dashboard Root", SourcePath: "team-x/dashboard1.json"},
	})

	_, err := local.Git("mv", "team-x/dashboard1.json", "dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard from team-x to root")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"move-root-001": {Title: "Dashboard Root", SourcePath: "dashboard1.json"},
	})
}

// TestIntegrationProvisioning_IncrementalGitSync_RenameFolder verifies that
// renaming an entire folder (git mv folderA folderB) preserves all dashboards
// inside it. Git reports individual file renames for each file in the folder.
func TestIntegrationProvisioning_IncrementalGitSync_RenameFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename-folder"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"old-team/dashboard1.json": dashboardJSON("ren-fold-001", "Folder Dash One", 1),
		"old-team/dashboard2.json": dashboardJSON("ren-fold-002", "Folder Dash Two", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"ren-fold-001": {Title: "Folder Dash One", SourcePath: "old-team/dashboard1.json"},
		"ren-fold-002": {Title: "Folder Dash Two", SourcePath: "old-team/dashboard2.json"},
	})
	requireRepoFolders(t, helper, ctx, repoName, []string{"old-team"})

	_, err := local.Git("mv", "old-team", "new-team")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename folder old-team to new-team")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"ren-fold-001": {Title: "Folder Dash One", SourcePath: "new-team/dashboard1.json"},
		"ren-fold-002": {Title: "Folder Dash Two", SourcePath: "new-team/dashboard2.json"},
	})
	requireRepoFolders(t, helper, ctx, repoName, []string{"new-team"})
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveNestedDashboard verifies
// that incremental sync handles moving a dashboard between nested folder levels.
func TestIntegrationProvisioning_IncrementalGitSync_MoveNestedDashboard(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-nested"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"parent/child-a/dashboard1.json": dashboardJSON("nested-001", "Nested Dashboard", 1),
		"parent/child-b/.keep":           {},
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"nested-001": {Title: "Nested Dashboard", SourcePath: "parent/child-a/dashboard1.json"},
	})

	_, err := local.Git("mv", "parent/child-a/dashboard1.json", "parent/child-b/dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard from child-a to child-b")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"nested-001": {Title: "Nested Dashboard", SourcePath: "parent/child-b/dashboard1.json"},
	})
	requireRepoFolders(t, helper, ctx, repoName, []string{"parent", "parent/child-b"})
}

// TestIntegrationProvisioning_IncrementalGitSync_RenameNestedFolder verifies
// that renaming a nested folder preserves all dashboards inside it.
func TestIntegrationProvisioning_IncrementalGitSync_RenameNestedFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename-nested"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"parent/old-child/dashboard1.json": dashboardJSON("ren-nest-001", "Nested Rename Dash", 1),
		"parent/sibling/dashboard2.json":   dashboardJSON("ren-nest-002", "Sibling Dash", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"ren-nest-001": {Title: "Nested Rename Dash", SourcePath: "parent/old-child/dashboard1.json"},
		"ren-nest-002": {Title: "Sibling Dash", SourcePath: "parent/sibling/dashboard2.json"},
	})

	_, err := local.Git("mv", "parent/old-child", "parent/new-child")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename nested folder old-child to new-child")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWaitIncremental(t, repoName)
	requireDashboards(t, helper, ctx, map[string]expectedDashboard{
		"ren-nest-001": {Title: "Nested Rename Dash", SourcePath: "parent/new-child/dashboard1.json"},
		"ren-nest-002": {Title: "Sibling Dash", SourcePath: "parent/sibling/dashboard2.json"},
	})
	requireRepoFolders(t, helper, ctx, repoName, []string{"parent", "parent/new-child", "parent/sibling"})
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

// requireDashboards lists dashboards once and asserts that exactly the expected
// set exists with matching title and grafana.app/sourcePath for each UID.
func requireDashboards(t *testing.T, h *gitTestHelper, ctx context.Context, expected map[string]expectedDashboard) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		if !assert.Len(c, list.Items, len(expected), "unexpected dashboard count") {
			return
		}
		for _, d := range list.Items {
			uid := d.GetName()
			exp, ok := expected[uid]
			if !assert.True(c, ok, "unexpected dashboard %q", uid) {
				continue
			}
			title, _, _ := unstructured.NestedString(d.Object, "spec", "title")
			assert.Equal(c, exp.Title, title, "dashboard %q title mismatch", uid)
			sp, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/sourcePath")
			assert.Equal(c, exp.SourcePath, sp, "dashboard %q sourcePath mismatch", uid)
		}
	}, waitTimeoutDefault, waitIntervalDefault, "dashboards should match expected state")
}

// requireRepoFolders lists folders once and asserts that the set of
// grafana.app/sourcePath values for folders managed by repoName matches exactly.
func requireRepoFolders(t *testing.T, h *gitTestHelper, ctx context.Context, repoName string, expectedSourcePaths []string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.FoldersV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		var gotPaths []string
		for _, f := range list.Items {
			mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if mgr != repoName {
				continue
			}
			sp, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
			gotPaths = append(gotPaths, sp)
		}
		assert.ElementsMatch(c, expectedSourcePaths, gotPaths, "folder sourcePaths mismatch for repo %q", repoName)
	}, waitTimeoutDefault, waitIntervalDefault,
		"folders for repo %q should have sourcePaths %v", repoName, expectedSourcePaths)
}
