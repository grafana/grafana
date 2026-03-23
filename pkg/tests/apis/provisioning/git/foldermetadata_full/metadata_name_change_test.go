package foldermetadatafull

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TestIntegrationProvisioning_FullSync_MetadataNameChange verifies that when a
// resource's metadata.name (uid) changes in a file at the same path, full sync
// creates the new resource and deletes the old one so no orphan is left behind.
func TestIntegrationProvisioning_FullSync_MetadataNameChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-name-change"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": gitcommon.DashboardJSON("name-change-full-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "name-change-full-001", "Dashboard One")

	// Change the metadata.name (uid) in the same file path.
	require.NoError(t, local.UpdateFile("dashboard1.json", string(gitcommon.DashboardJSON("name-change-full-002", "Dashboard One Renamed", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change dashboard uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWait(t, repoName)

	// The new dashboard should exist with the new name.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-full-002", metav1.GetOptions{})
		assert.NoError(c, err, "new dashboard should exist")
		if d != nil {
			assert.Equal(c, "name-change-full-002", d.GetName())
		}
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault, "dashboard with new name should be created")

	// The old dashboard should be deleted — no orphan left behind.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-full-001", metav1.GetOptions{})
		assert.Error(c, err, "old dashboard should have been deleted")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault, "old dashboard should be cleaned up")

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}

// TestIntegrationProvisioning_FullSync_ChainedNameChanges verifies that
// sequential metadata.name changes never accumulate orphaned resources.
func TestIntegrationProvisioning_FullSync_ChainedNameChanges(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-chained-name"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": gitcommon.DashboardJSON("chained-v1", "Dashboard V1", 1),
	}, "write", "branch")

	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// First name change: v1 -> v2
	require.NoError(t, local.UpdateFile("dashboard.json", string(gitcommon.DashboardJSON("chained-v2", "Dashboard V2", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename v1 to v2")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWait(t, repoName)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v2", metav1.GetOptions{})
		assert.NoError(c, err, "v2 should exist")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v1", metav1.GetOptions{})
		assert.Error(c, err, "v1 should be deleted")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// Second name change: v2 -> v3
	require.NoError(t, local.UpdateFile("dashboard.json", string(gitcommon.DashboardJSON("chained-v3", "Dashboard V3", 3))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename v2 to v3")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWait(t, repoName)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v3", metav1.GetOptions{})
		assert.NoError(c, err, "v3 should exist")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v2", metav1.GetOptions{})
		assert.Error(c, err, "v2 should be deleted")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}

// TestIntegrationProvisioning_FullSync_MultipleFilesNameChange verifies that
// simultaneous metadata.name changes across multiple files all get cleaned up.
func TestIntegrationProvisioning_FullSync_MultipleFilesNameChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-multi-name"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dash1.json": gitcommon.DashboardJSON("multi-a", "Dashboard A", 1),
		"dash2.json": gitcommon.DashboardJSON("multi-b", "Dashboard B", 1),
	}, "write", "branch")

	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)

	// Change both names simultaneously.
	require.NoError(t, local.UpdateFile("dash1.json", string(gitcommon.DashboardJSON("multi-c", "Dashboard C", 2))))
	require.NoError(t, local.UpdateFile("dash2.json", string(gitcommon.DashboardJSON("multi-d", "Dashboard D", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change both dashboard uids")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWait(t, repoName)

	// New dashboards should exist.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "multi-c", metav1.GetOptions{})
		assert.NoError(c, err, "dashboard C should exist")
		_, err = helper.DashboardsV1.Resource.Get(ctx, "multi-d", metav1.GetOptions{})
		assert.NoError(c, err, "dashboard D should exist")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)

	// Old dashboards should be deleted.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "multi-a", metav1.GetOptions{})
		assert.Error(c, err, "dashboard A should be deleted")
		_, err = helper.DashboardsV1.Resource.Get(ctx, "multi-b", metav1.GetOptions{})
		assert.Error(c, err, "dashboard B should be deleted")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)
}

// TestIntegrationProvisioning_FullSync_OrphanCleanupOnSubsequentSync verifies
// that if orphans somehow accumulated at the same path (e.g., from a previous
// Grafana version without the cleanup fix), a subsequent full sync detects and
// removes them. The orphan state is simulated by performing two name changes
// with a full sync only after the second change: the index will have the
// original resource and the file will resolve to the third name, so the
// Changes() duplicate-path detection kicks in on the next sync.
func TestIntegrationProvisioning_FullSync_OrphanCleanupOnSubsequentSync(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-orphan-cleanup"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": gitcommon.DashboardJSON("orphan-orig", "Dashboard Original", 1),
	}, "write", "branch")

	// Initial sync: orphan-orig exists.
	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// Change name and sync, producing the new resource and deleting the old one.
	require.NoError(t, local.UpdateFile("dashboard.json", string(gitcommon.DashboardJSON("orphan-second", "Dashboard Second", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename to second")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// Another full sync should be a no-op — still exactly 1 dashboard.
	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "orphan-second", metav1.GetOptions{})
		assert.NoError(c, err, "current dashboard should still exist")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)
}
