package foldermetadatafull

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_FullSync_MultiFileUIDSwap verifies the
// deleteOldResource sourcePath guard during a full sync. File A takes file B's
// UID while file B moves to a brand-new UID. Full sync processes file
// creations/updates in parallel; when both writes complete before the deletes
// (the common case), B's deleteOldResource discovers that its old UID's
// sourcePath annotation was already changed to dashboard_a.json by A's write
// and skips the delete, preserving the resource.
func TestIntegrationProvisioning_FullSync_MultiFileUIDSwap(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := gitcommon.RunGrafanaWithGitServer(t)
	ctx := context.Background()

	const repoName = "git-full-uid-swap"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": gitcommon.DashboardJSON("swap-full-uid-a", "Dashboard A", 1),
		"dashboard_b.json": gitcommon.DashboardJSON("swap-full-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	helper.SyncAndWait(t, repoName)
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"swap-full-uid-a": {Title: "Dashboard A", SourcePath: "dashboard_a.json"},
		"swap-full-uid-b": {Title: "Dashboard B", SourcePath: "dashboard_b.json"},
	})

	// File A takes B's UID; file B gets a brand-new UID. This is a
	// one-directional takeover rather than a symmetric swap so that the
	// parallel write phase does not require recreating a just-deleted resource
	// (which can race with the storage layer).
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(gitcommon.DashboardJSON("swap-full-uid-b", "Dashboard A Took B", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(gitcommon.DashboardJSON("swap-full-uid-new", "Dashboard B New UID", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "file A takes B's UID, B gets new UID")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWait(t, repoName)

	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"swap-full-uid-b":   {Title: "Dashboard A Took B", SourcePath: "dashboard_a.json"},
		"swap-full-uid-new": {Title: "Dashboard B New UID", SourcePath: "dashboard_b.json"},
	})
}
