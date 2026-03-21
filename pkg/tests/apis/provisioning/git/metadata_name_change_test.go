package git

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_FullSync_MetadataNameChange verifies that when a
// resource's metadata.name (uid) changes in a file at the same path, full sync
// creates a new resource with the new name and deletes the old one to prevent
// orphans.
func TestIntegrationProvisioning_FullSync_MetadataNameChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-name-change"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("name-change-full-001", "Dashboard One", 1),
	}, "write", "branch")

	helper.syncAndWait(t, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "name-change-full-001", "Dashboard One")

	// Change the metadata.name (uid) in the same file path.
	require.NoError(t, local.UpdateFile("dashboard1.json", string(dashboardJSON("name-change-full-002", "Dashboard One Renamed", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change dashboard uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.syncAndWait(t, repoName)

	// The new dashboard should exist with the new name.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-full-002", metav1.GetOptions{})
		assert.NoError(c, err, "new dashboard should exist")
		if d != nil {
			assert.Equal(c, "name-change-full-002", d.GetName())
		}
	}, waitTimeoutDefault, waitIntervalDefault, "dashboard with new name should be created")

	// The old dashboard should be deleted — ReplaceResourceFromFile detects
	// the name change and removes the previous resource.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-full-001", metav1.GetOptions{})
		assert.Error(c, err, "old dashboard should be deleted")
	}, waitTimeoutDefault, waitIntervalDefault, "old dashboard should be deleted after name change")

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}

// TestIntegrationProvisioning_IncrementalGitSync_MetadataNameChange verifies
// that when a resource's metadata.name (uid) changes in a file at the same
// path, incremental sync creates a new resource with the new name and deletes
// the old one to prevent orphans.
func TestIntegrationProvisioning_IncrementalGitSync_MetadataNameChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-name-change"

	_, local := helper.createGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": dashboardJSON("name-change-incr-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWaitWithSuccess(t, helper, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "name-change-incr-001", "Dashboard One")

	// Change the metadata.name (uid) in the same file path.
	require.NoError(t, local.UpdateFile("dashboard1.json", string(dashboardJSON("name-change-incr-002", "Dashboard One Renamed", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change dashboard uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWaitSuccessfulIncremental(t, helper, repoName)

	// The new dashboard should exist with the new name.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-incr-002", metav1.GetOptions{})
		assert.NoError(c, err, "new dashboard should exist")
		if d != nil {
			assert.Equal(c, "name-change-incr-002", d.GetName())
		}
	}, waitTimeoutDefault, waitIntervalDefault, "dashboard with new name should be created")

	// The old dashboard should be deleted — ReplaceResourceFromFile detects
	// the name change and removes the previous resource.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-incr-001", metav1.GetOptions{})
		assert.Error(c, err, "old dashboard should be deleted")
	}, waitTimeoutDefault, waitIntervalDefault, "old dashboard should be deleted after name change")

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}
