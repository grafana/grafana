package foldermetadataincremental

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_IncrementalGitSync_MetadataNameChange verifies
// that when a resource's metadata.name (uid) changes in a file at the same
// path, incremental sync creates a new resource with the new name and deletes
// the old one to prevent orphans.
func TestIntegrationProvisioning_IncrementalGitSync_MetadataNameChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incremental-name-change"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard1.json": gitcommon.DashboardJSON("name-change-incr-001", "Dashboard One", 1),
	}, "write", "branch")

	common.SyncAndWaitWithSuccess(t, helper, repoName)
	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
	common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "name-change-incr-001", "Dashboard One")

	// Change the metadata.name (uid) in the same file path.
	require.NoError(t, local.UpdateFile("dashboard1.json", string(gitcommon.DashboardJSON("name-change-incr-002", "Dashboard One Renamed", 2))))
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
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault, "dashboard with new name should be created")

	// The old dashboard should be deleted — ReplaceResourceFromFileByRef detects
	// the name change and removes the previous resource.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, "name-change-incr-001", metav1.GetOptions{})
		assert.True(c, apierrors.IsNotFound(err), "old dashboard should be NotFound, got: %v", err)
	}, gitcommon.WaitTimeoutDefault, gitcommon.WaitIntervalDefault, "old dashboard should be deleted after name change")

	common.RequireDashboardCount(t, helper.DashboardsV1, ctx, 1)
}
