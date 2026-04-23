package full

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_MetadataNameChange verifies that when a
// resource's metadata.name (uid) changes in a file at the same path, full sync
// creates the new resource and deletes the old one so no orphan is left behind.
func TestIntegrationProvisioning_FullSync_MetadataNameChange(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-full-name-change"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("name-change-full-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "name-change-full-001", "Dashboard One")

	// Change the metadata.name (uid) in the same file path.
	require.NoError(t, local.UpdateFile("dashboard1.json", string(common.DashboardJSON("name-change-full-002", "Dashboard One Renamed", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change dashboard uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// The new dashboard should exist with the new name.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-full-002", metav1.GetOptions{})
		assert.NoError(c, err, "new dashboard should exist")
		if d != nil {
			assert.Equal(c, "name-change-full-002", d.GetName())
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard with new name should be created")

	// The old dashboard should be deleted — no orphan left behind.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-full-001", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "old dashboard should be NotFound, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "old dashboard should be deleted after name change")

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}

// TestIntegrationProvisioning_FullSync_ChainedNameChanges verifies that
// sequential metadata.name changes never accumulate orphaned resources.
func TestIntegrationProvisioning_FullSync_ChainedNameChanges(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-full-chained-name"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("chained-v1", "Dashboard V1", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// First name change: v1 -> v2
	require.NoError(t, local.UpdateFile("dashboard.json", string(common.DashboardJSON("chained-v2", "Dashboard V2", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename v1 to v2")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v2", metav1.GetOptions{})
		assert.NoError(c, err, "v2 should exist")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v1", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "v1 should be NotFound, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// Second name change: v2 -> v3
	require.NoError(t, local.UpdateFile("dashboard.json", string(common.DashboardJSON("chained-v3", "Dashboard V3", 3))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename v2 to v3")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v3", metav1.GetOptions{})
		assert.NoError(c, err, "v3 should exist")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "chained-v2", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "v2 should be NotFound, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}

// TestIntegrationProvisioning_FullSync_MultipleFilesNameChange verifies that
// simultaneous metadata.name changes across multiple files all get cleaned up.
func TestIntegrationProvisioning_FullSync_MultipleFilesNameChange(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-full-multi-name"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dash1.json": common.DashboardJSON("multi-a", "Dashboard A", 1),
		"dash2.json": common.DashboardJSON("multi-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)

	// Change both names simultaneously.
	require.NoError(t, local.UpdateFile("dash1.json", string(common.DashboardJSON("multi-c", "Dashboard C", 2))))
	require.NoError(t, local.UpdateFile("dash2.json", string(common.DashboardJSON("multi-d", "Dashboard D", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change both dashboard uids")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// New dashboards should exist.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "multi-c", metav1.GetOptions{})
		assert.NoError(c, err, "dashboard C should exist")
		_, err = helper.DashboardsV1.Resource.Get(ctx, "multi-d", metav1.GetOptions{})
		assert.NoError(c, err, "dashboard D should exist")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	// Old dashboards should be deleted.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "multi-a", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "dashboard A should be NotFound, got: %v", err)
		_, err = helper.DashboardsV1.Resource.Get(ctx, "multi-b", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "dashboard B should be NotFound, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)
}

// TestIntegrationProvisioning_FullSync_OrphanCleanupOnSubsequentSync verifies
// that if orphans somehow accumulated at the same sourcePath (e.g., from a
// previous Grafana version without the cleanup fix), a subsequent full sync
// detects the duplicates and removes them.
//
// The orphan is injected directly into unified storage (via the gRPC resource
// client) to bypass the K8s API layer's managed-resource routing, which would
// otherwise refuse to create a second resource at the same sourcePath.
func TestIntegrationProvisioning_FullSync_OrphanCleanupOnSubsequentSync(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-full-orphan-cleanup"

	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("real-dash", "Real Dashboard", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	// Inject an orphan directly into unified storage, bypassing the K8s API
	// admission hooks that prevent creating a second managed resource at the
	// same sourcePath. This simulates a corrupt state left by a previous
	// Grafana version.
	orphanObj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1beta1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":      "orphan-dash",
				"namespace": "default",
				"annotations": map[string]interface{}{
					utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
					utils.AnnoKeyManagerIdentity: repoName,
					utils.AnnoKeySourcePath:      "dashboard.json",
					utils.AnnoKeySourceChecksum:  "stale-checksum",
				},
			},
			"spec": map[string]interface{}{
				"title":         "Orphan Dashboard",
				"schemaVersion": 41,
			},
		},
	}
	orphanBytes, err := json.Marshal(orphanObj.Object)
	require.NoError(t, err)

	provCtx, _, err := identity.WithProvisioningIdentity(ctx, "default")
	require.NoError(t, err)

	rsp, err := helper.GetEnv().ResourceClient.Create(provCtx, &resourcepb.CreateRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Name:      "orphan-dash",
		},
		Value: orphanBytes,
	})
	require.NoError(t, err, "gRPC create should succeed")
	require.Nil(t, rsp.GetError(), "resource create should not return error: %v", rsp.GetError())

	// Confirm two dashboards exist before cleanup.
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 2)

	// Full sync should detect the duplicate sourcePath and delete the orphan.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "real-dash", metav1.GetOptions{})
		assert.NoError(c, err, "real dashboard should survive cleanup")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "orphan-dash", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "orphan should be deleted, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}
