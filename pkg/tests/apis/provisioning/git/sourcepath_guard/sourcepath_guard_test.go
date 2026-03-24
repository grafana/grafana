package sourcepathguard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDTakeover verifies
// the deleteOldResource sourcePath guard during an incremental sync. File A
// takes file B's UID while file B moves to a brand-new UID. Incremental sync
// processes changes serially in alphabetical order, so A's write updates
// swap-incr-uid-b's sourcePath annotation to dashboard_a.json before B's
// deleteOldResource runs. The guard detects the mismatch and skips the delete,
// preserving the resource that A just claimed.
//
// This scenario is tested only with incremental sync because full sync
// processes files in parallel, making it impossible to guarantee that A's write
// completes before B's deleteOldResource runs. A unit test in
// resources_test.go covers the guard logic directly.
func TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDTakeover(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-incr-uid-takeover"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": gitcommon.DashboardJSON("takeover-uid-a", "Dashboard A", 1),
		"dashboard_b.json": gitcommon.DashboardJSON("takeover-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWaitWithSuccess(t, helper, repoName)
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"takeover-uid-a": {Title: "Dashboard A", SourcePath: "dashboard_a.json"},
		"takeover-uid-b": {Title: "Dashboard B", SourcePath: "dashboard_b.json"},
	})

	// File A takes B's UID; file B gets a brand-new UID. Because incremental
	// sync processes files sequentially (alphabetical), A runs first: it
	// updates takeover-uid-b so that its sourcePath becomes dashboard_a.json,
	// then deletes its own old UID (takeover-uid-a). When B runs next it
	// writes the new UID and tries to delete takeover-uid-b, but the
	// sourcePath guard skips the delete since dashboard_a.json ≠ dashboard_b.json.
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(gitcommon.DashboardJSON("takeover-uid-b", "Dashboard A Took B", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(gitcommon.DashboardJSON("takeover-uid-new", "Dashboard B New UID", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "file A takes B's UID, B gets new UID")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWaitIncremental(t, repoName)

	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"takeover-uid-b":   {Title: "Dashboard A Took B", SourcePath: "dashboard_a.json"},
		"takeover-uid-new": {Title: "Dashboard B New UID", SourcePath: "dashboard_b.json"},
	})
}
