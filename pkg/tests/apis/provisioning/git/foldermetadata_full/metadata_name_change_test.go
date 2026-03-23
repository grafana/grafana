package foldermetadatafull

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
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
		assert.True(c, apierrors.IsNotFound(err), "old dashboard should be NotFound, got: %v", err)
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault, "old dashboard should be deleted after name change")

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
		assert.True(c, apierrors.IsNotFound(err), "v1 should be NotFound, got: %v", err)
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
		assert.True(c, apierrors.IsNotFound(err), "v2 should be NotFound, got: %v", err)
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
		assert.True(c, apierrors.IsNotFound(err), "dashboard A should be NotFound, got: %v", err)
		_, err = helper.DashboardsV1.Resource.Get(ctx, "multi-b", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "dashboard B should be NotFound, got: %v", err)
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)
}

// TestIntegrationProvisioning_FullSync_OrphanCleanupOnSubsequentSync verifies
// that if orphans somehow accumulated at the same sourcePath (e.g., from a
// previous Grafana version without the cleanup fix), a subsequent full sync
// detects the duplicates and removes them.
//
// The orphan state is simulated by creating the real dashboard via sync, then
// injecting a second dashboard through the K8s API. The orphan is first created
// unmanaged (to bypass admission control), then updated to add the manager and
// sourcePath annotations — producing two resources at the same path.
func TestIntegrationProvisioning_FullSync_OrphanCleanupOnSubsequentSync(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-orphan-cleanup"

	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": gitcommon.DashboardJSON("real-dash", "Real Dashboard", 1),
	}, "write", "branch")

	helper.SyncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// Step 1: Create an unmanaged dashboard (no provisioning annotations).
	orphan := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1beta1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name": "orphan-dash",
			},
			"spec": map[string]interface{}{
				"title":         "Orphan Dashboard",
				"schemaVersion": 41,
			},
		},
	}
	created, err := helper.DashboardsV1.Resource.Create(ctx, orphan, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create unmanaged dashboard")

	// Step 2: Update the orphan to add manager + sourcePath annotations,
	// simulating a resource that was left behind by a previous Grafana version.
	annotations := created.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindRepo)
	annotations[utils.AnnoKeyManagerIdentity] = repoName
	annotations[utils.AnnoKeySourcePath] = "dashboard.json"
	annotations[utils.AnnoKeySourceChecksum] = "stale-checksum"
	created.SetAnnotations(annotations)

	_, err = helper.DashboardsV1.Resource.Update(ctx, created, metav1.UpdateOptions{})
	require.NoError(t, err, "should be able to add provisioning annotations to orphan")

	// Confirm two dashboards exist before cleanup.
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)

	// Full sync should detect the duplicate sourcePath and delete the orphan.
	helper.SyncAndWait(t, repoName)

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "real-dash", metav1.GetOptions{})
		assert.NoError(c, err, "real dashboard should survive cleanup")
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "orphan-dash", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "orphan should be deleted, got: %v", err)
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault)
}
