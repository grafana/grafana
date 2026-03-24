package foldermetadataincremental

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDSwap verifies that
// when two files swap their dashboard UIDs in a single commit, incremental sync
// preserves both resources. The deleteOldResource sourcePath guard detects that
// the old UID is now managed by the other file and skips the delete, preventing
// accidental destruction of a resource that was just written by the other file
// in the same sync.
func TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDSwap(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incr-uid-swap"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": gitcommon.DashboardJSON("swap-incr-uid-a", "Dashboard A", 1),
		"dashboard_b.json": gitcommon.DashboardJSON("swap-incr-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWaitWithSuccess(t, helper, repoName)
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"swap-incr-uid-a": {Title: "Dashboard A", SourcePath: "dashboard_a.json"},
		"swap-incr-uid-b": {Title: "Dashboard B", SourcePath: "dashboard_b.json"},
	})

	// Swap the UIDs between the two files in a single commit:
	//   dashboard_a.json: uid-a -> uid-b
	//   dashboard_b.json: uid-b -> uid-a
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(gitcommon.DashboardJSON("swap-incr-uid-b", "Dashboard A Swapped", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(gitcommon.DashboardJSON("swap-incr-uid-a", "Dashboard B Swapped", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "swap dashboard UIDs between files")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// The sync job will report an error for the "skipping delete" branch, but
	// the important invariant is that both dashboards survive with correct state.
	helper.SyncAndWaitIncremental(t, repoName)

	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"swap-incr-uid-a": {Title: "Dashboard B Swapped", SourcePath: "dashboard_b.json"},
		"swap-incr-uid-b": {Title: "Dashboard A Swapped", SourcePath: "dashboard_a.json"},
	})
}
