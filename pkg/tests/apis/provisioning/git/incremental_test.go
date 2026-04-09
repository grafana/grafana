package git

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_IncrementalGitSync_Add verifies that incremental
// sync imports a newly committed file without re-processing the full tree.
func TestIntegrationProvisioning_IncrementalGitSync_Add(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-add"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	require.NoError(t, local.CreateFile("dashboard2.json", string(common.DashboardJSON("incr-dash-002", "Dashboard Two", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard2")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)
}

// TestIntegrationProvisioning_IncrementalGitSync_Update verifies that
// incremental sync applies an in-place file modification.
func TestIntegrationProvisioning_IncrementalGitSync_Update(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-update"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	require.NoError(t, local.UpdateFile("dashboard1.json", string(common.DashboardJSON("incr-dash-001", "Dashboard One Updated", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "update dashboard1 title")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "incr-dash-001", "Dashboard One Updated")
}

// TestIntegrationProvisioning_IncrementalGitSync_Delete verifies that
// incremental sync removes a dashboard whose file was deleted from the repo.
func TestIntegrationProvisioning_IncrementalGitSync_Delete(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-delete"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("incr-dash-001", "Dashboard One", 1),
		"dashboard2.json": common.DashboardJSON("incr-dash-002", "Dashboard Two", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)

	_, err := local.Git("rm", "dashboard2.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "delete dashboard2")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "incr-dash-002", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "dashboard incr-dash-002 should be deleted")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "deleted dashboard should be removed from Grafana")
}

// TestIntegrationProvisioning_IncrementalGitSync_Noop verifies that incremental
// sync is a no-op when there are no new commits since the last sync.
func TestIntegrationProvisioning_IncrementalGitSync_Noop(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-noop"

	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}

// TestIntegrationProvisioning_IncrementalGitSync_Rename verifies that
// incremental sync handles a file rename (git mv) without losing the dashboard.
func TestIntegrationProvisioning_IncrementalGitSync_Rename(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("incr-dash-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"incr-dash-001": {Title: "Dashboard One", SourcePath: "dashboard1.json"},
	})

	dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "incr-dash-001", metav1.GetOptions{})
	require.NoError(t, err)
	dashSnap := common.SnapshotObject(t, dashBefore)

	_, err = local.Git("mv", "dashboard1.json", "renamed-dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename dashboard1")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"incr-dash-001": {Title: "Dashboard One", SourcePath: "renamed-dashboard1.json"},
	})

	dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "incr-dash-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveIntoFolder verifies that
// incremental sync handles moving a dashboard from root into a subfolder.
func TestIntegrationProvisioning_IncrementalGitSync_MoveIntoFolder(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-into-folder"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("move-in-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"move-in-001": {Title: "Dashboard One", SourcePath: "dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{})

	dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "move-in-001", metav1.GetOptions{})
	require.NoError(t, err)
	dashSnap := common.SnapshotObject(t, dashBefore)

	require.NoError(t, local.CreateDirPath("team-a"))
	_, err = local.Git("mv", "dashboard1.json", "team-a/dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard into team-a folder")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"move-in-001": {Title: "Dashboard One", SourcePath: "team-a/dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"team-a"})

	dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "move-in-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveBetweenFolders verifies
// that incremental sync handles moving a dashboard from one folder to another.
func TestIntegrationProvisioning_IncrementalGitSync_MoveBetweenFolders(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-between"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"folder-a/dashboard1.json": common.DashboardJSON("move-btwn-001", "Dashboard Between", 1),
		"folder-b/.keep":           {},
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"move-btwn-001": {Title: "Dashboard Between", SourcePath: "folder-a/dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"folder-a", "folder-b"})

	dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "move-btwn-001", metav1.GetOptions{})
	require.NoError(t, err)
	dashSnap := common.SnapshotObject(t, dashBefore)

	_, err = local.Git("mv", "folder-a/dashboard1.json", "folder-b/dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard from folder-a to folder-b")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"move-btwn-001": {Title: "Dashboard Between", SourcePath: "folder-b/dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"folder-b"})

	dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "move-btwn-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveToRoot verifies that
// incremental sync handles moving a dashboard from a subfolder back to root.
func TestIntegrationProvisioning_IncrementalGitSync_MoveToRoot(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-to-root"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"team-x/dashboard1.json": common.DashboardJSON("move-root-001", "Dashboard Root", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"move-root-001": {Title: "Dashboard Root", SourcePath: "team-x/dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"team-x"})

	dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "move-root-001", metav1.GetOptions{})
	require.NoError(t, err)
	dashSnap := common.SnapshotObject(t, dashBefore)

	_, err = local.Git("mv", "team-x/dashboard1.json", "dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard from team-x to root")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"move-root-001": {Title: "Dashboard Root", SourcePath: "dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{})

	dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "move-root-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))
}

// TestIntegrationProvisioning_IncrementalGitSync_RenameFolder verifies that
// renaming an entire folder (git mv folderA folderB) preserves all dashboards
// inside it. Git reports individual file renames for each file in the folder.
func TestIntegrationProvisioning_IncrementalGitSync_RenameFolder(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename-folder"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"old-team/dashboard1.json": common.DashboardJSON("ren-fold-001", "Folder Dash One", 1),
		"old-team/dashboard2.json": common.DashboardJSON("ren-fold-002", "Folder Dash Two", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"ren-fold-001": {Title: "Folder Dash One", SourcePath: "old-team/dashboard1.json"},
		"ren-fold-002": {Title: "Folder Dash Two", SourcePath: "old-team/dashboard2.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"old-team"})

	dash1Before, err := helper.DashboardsV1.Resource.Get(ctx, "ren-fold-001", metav1.GetOptions{})
	require.NoError(t, err)
	dash1Snap := common.SnapshotObject(t, dash1Before)

	dash2Before, err := helper.DashboardsV1.Resource.Get(ctx, "ren-fold-002", metav1.GetOptions{})
	require.NoError(t, err)
	dash2Snap := common.SnapshotObject(t, dash2Before)

	_, err = local.Git("mv", "old-team", "new-team")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename folder old-team to new-team")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"ren-fold-001": {Title: "Folder Dash One", SourcePath: "new-team/dashboard1.json"},
		"ren-fold-002": {Title: "Folder Dash Two", SourcePath: "new-team/dashboard2.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"new-team"})

	dash1After, err := helper.DashboardsV1.Resource.Get(ctx, "ren-fold-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard 1", dash1Snap, common.SnapshotObject(t, dash1After))

	dash2After, err := helper.DashboardsV1.Resource.Get(ctx, "ren-fold-002", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard 2", dash2Snap, common.SnapshotObject(t, dash2After))
}

// TestIntegrationProvisioning_IncrementalGitSync_MoveNestedDashboard verifies
// that incremental sync handles moving a dashboard between nested folder levels.
func TestIntegrationProvisioning_IncrementalGitSync_MoveNestedDashboard(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-move-nested"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"parent/child-a/dashboard1.json": common.DashboardJSON("nested-001", "Nested Dashboard", 1),
		"parent/child-b/.keep":           {},
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"nested-001": {Title: "Nested Dashboard", SourcePath: "parent/child-a/dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/child-a", "parent/child-b"})

	dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "nested-001", metav1.GetOptions{})
	require.NoError(t, err)
	dashSnap := common.SnapshotObject(t, dashBefore)

	_, err = local.Git("mv", "parent/child-a/dashboard1.json", "parent/child-b/dashboard1.json")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "move dashboard from child-a to child-b")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"nested-001": {Title: "Nested Dashboard", SourcePath: "parent/child-b/dashboard1.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/child-b"})

	dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "nested-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))
}

// TestIntegrationProvisioning_IncrementalGitSync_RenameNestedFolder verifies
// that renaming a nested folder preserves all dashboards inside it.
func TestIntegrationProvisioning_IncrementalGitSync_RenameNestedFolder(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-rename-nested"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"parent/old-child/dashboard1.json": common.DashboardJSON("ren-nest-001", "Nested Rename Dash", 1),
		"parent/sibling/dashboard2.json":   common.DashboardJSON("ren-nest-002", "Sibling Dash", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"ren-nest-001": {Title: "Nested Rename Dash", SourcePath: "parent/old-child/dashboard1.json"},
		"ren-nest-002": {Title: "Sibling Dash", SourcePath: "parent/sibling/dashboard2.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/old-child", "parent/sibling"})

	dashBefore, err := helper.DashboardsV1.Resource.Get(ctx, "ren-nest-001", metav1.GetOptions{})
	require.NoError(t, err)
	dashSnap := common.SnapshotObject(t, dashBefore)

	_, err = local.Git("mv", "parent/old-child", "parent/new-child")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename nested folder old-child to new-child")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"ren-nest-001": {Title: "Nested Rename Dash", SourcePath: "parent/new-child/dashboard1.json"},
		"ren-nest-002": {Title: "Sibling Dash", SourcePath: "parent/sibling/dashboard2.json"},
	})
	common.RequireRepoFolders(t, helper.Folders, ctx, repoName, []string{"parent", "parent/new-child", "parent/sibling"})

	dashAfter, err := helper.DashboardsV1.Resource.Get(ctx, "ren-nest-001", metav1.GetOptions{})
	require.NoError(t, err)
	common.RequireUpdatedInPlace(t, "dashboard", dashSnap, common.SnapshotObject(t, dashAfter))
}
