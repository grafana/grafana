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

// TestIntegrationProvisioning_IncrementalGitSync_MetadataNameChange verifies
// that when a resource's metadata.name (uid) changes in a file at the same
// path, incremental sync creates the new resource and deletes the old one so
// no orphan is left behind.
func TestIntegrationProvisioning_IncrementalGitSync_MetadataNameChange(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incremental-name-change"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": common.DashboardJSON("name-change-incr-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "name-change-incr-001", "Dashboard One")

	// Change the metadata.name (uid) in the same file path.
	require.NoError(t, local.UpdateFile("dashboard1.json", string(common.DashboardJSON("name-change-incr-002", "Dashboard One Renamed", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "change dashboard uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

	// The new dashboard should exist with the new name.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-incr-002", metav1.GetOptions{})
		assert.NoError(c, err, "new dashboard should exist")
		if d != nil {
			assert.Equal(c, "name-change-incr-002", d.GetName())
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard with new name should be created")

	// The old dashboard should be deleted — no orphan left behind.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-incr-001", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "old dashboard should be NotFound, got: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "old dashboard should be deleted after name change")

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}
