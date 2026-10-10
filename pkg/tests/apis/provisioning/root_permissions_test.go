package provisioning

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// UIDs baked into the shared testdata fixtures.
const (
	allPanelsDashboardUID = "n1jR8vnnz" // testdata/all-panels.json
	timelineDashboardUID  = "mIJjFy8Kz" // testdata/timeline-demo.json
)

// A dashboard inside a folder inherits access from it. One at the top level has no parent to
// inherit from, so without default permissions of its own only admins can see it. These tests
// cover the two ways a folderless (instance-scoped) repository can put a dashboard there: syncing
// a file at the repository root, and moving an existing file up to it.

// TestIntegrationProvisioning_RootLevelDashboardPermissions verifies that a dashboard synced at
// the top level is granted the default permissions and is therefore visible to a Viewer, while a
// dashboard inside a folder keeps inheriting access and gets no ACL of its own.
func TestIntegrationProvisioning_RootLevelDashboardPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "root-dashboard-perms"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folderless",
		Copies: map[string]string{
			"testdata/all-panels.json":    "root-dashboard.json",
			"testdata/timeline-demo.json": "team-a/nested-dashboard.json",
		},
	})

	helper.RequireRepoDashboardCount(t, repo, 2)
	helper.RequireRepoFolderCount(t, repo, 1)

	rootDashboard, err := helper.DashboardsV1.Resource.Get(t.Context(), allPanelsDashboardUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Empty(t, rootDashboard.GetAnnotations()[utils.AnnoKeyFolder],
		"a repo-root file must land at the top level")

	common.RequireDefaultRootDashboardPermissions(t, helper, allPanelsDashboardUID)
	common.RequireDashboardAccessible(t, helper, allPanelsDashboardUID, "viewer", "viewer")

	// The nested dashboard reaches the viewer through its folder's defaults, so it must not get
	// an ACL of its own.
	common.RequireNoDefaultRootDashboardPermissions(t, helper, timelineDashboardUID)
	common.RequireDashboardAccessible(t, helper, timelineDashboardUID, "viewer", "viewer")
}

// TestIntegrationProvisioning_DashboardMovedToRootPermissions verifies that moving a dashboard
// file up to the repository root grants it the default permissions it no longer inherits, and
// that a grant it already had is neither removed nor lowered.
func TestIntegrationProvisioning_DashboardMovedToRootPermissions(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "dashboard-move-to-root-perms"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folderless",
		Copies: map[string]string{
			"testdata/all-panels.json": "team-a/dashboard.json",
		},
	})

	helper.RequireRepoDashboardCount(t, repo, 1)
	folderName := helper.RequireSingleRepoFolder(t, repo).GetName()

	nested, err := helper.DashboardsV1.Resource.Get(t.Context(), allPanelsDashboardUID, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, folderName, nested.GetAnnotations()[utils.AnnoKeyFolder])
	common.RequireNoDefaultRootDashboardPermissions(t, helper, allPanelsDashboardUID)

	// Raise Editor above the default edit level. The move must not lower it back, which is what
	// replacing the ACL with the defaults would do.
	common.SetDashboardPermissions(t, helper, allPanelsDashboardUID,
		common.RolePermission{Role: "Editor", Permission: common.FolderPermissionAdmin})

	// Move the file up to the repository root and re-sync. The dashboard keeps its UID, because
	// that comes from the file contents rather than the path.
	moveFileInProvisioningPath(t, helper, "team-a/dashboard.json", "dashboard.json")
	helper.SyncAndWait(t, repo, nil)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		moved, getErr := helper.DashboardsV1.Resource.Get(t.Context(), allPanelsDashboardUID, metav1.GetOptions{})
		if !assert.NoError(c, getErr) {
			return
		}
		assert.Empty(c, moved.GetAnnotations()[utils.AnnoKeyFolder],
			"the dashboard must have moved to the top level")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	// The Viewer default is added, so the dashboard stays visible after the move...
	common.RequireDashboardAccessible(t, helper, allPanelsDashboardUID, "viewer", "viewer")
	perms := common.DashboardPermissions(t, helper, allPanelsDashboardUID)
	common.RequirePermissionContainsRole(t, perms, "Viewer", common.FolderPermissionView)
	// ...and the grant that was already there keeps its own level.
	common.RequirePermissionContainsRole(t, perms, "Editor", common.FolderPermissionAdmin)
	common.RequirePermissionLacksRole(t, perms, "Editor", common.FolderPermissionEdit)
}

func moveFileInProvisioningPath(t *testing.T, helper *common.ProvisioningTestHelper, from, to string) {
	t.Helper()
	fromPath := filepath.Join(helper.ProvisioningPath, from)
	toPath := filepath.Join(helper.ProvisioningPath, to)
	require.NoError(t, os.MkdirAll(filepath.Dir(toPath), 0o750), "create parent for move destination")
	require.NoError(t, os.Rename(fromPath, toPath), "move %s to %s", from, to)
}
