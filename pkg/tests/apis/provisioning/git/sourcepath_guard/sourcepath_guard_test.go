package sourcepathguard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDTakeover verifies
// the deleteOldResource sourcePath guard during an incremental sync. File A
// takes file B's UID while file B moves to a brand-new UID. Incremental sync
// processes changes serially in alphabetical order, so A's write updates
// takeover-uid-b's sourcePath annotation to dashboard_a.json before B's
// deleteOldResource runs. The guard detects the mismatch and skips the delete,
// preserving the resource that A just claimed.
func TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDTakeover(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incr-uid-takeover"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": common.DashboardJSON("takeover-uid-a", "Dashboard A", 1),
		"dashboard_b.json": common.DashboardJSON("takeover-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
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
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(common.DashboardJSON("takeover-uid-b", "Dashboard A Took B", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(common.DashboardJSON("takeover-uid-new", "Dashboard B New UID", 2))))
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

// TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDSwap verifies the
// deleteOldResource sourcePath guard during a symmetric UID swap in incremental
// sync. File A takes B's UID and file B takes A's UID simultaneously.
//
// Incremental sync processes files alphabetically, so the execution is
// deterministic:
//  1. A runs first: writes swap-uid-b (UPDATE → sourcePath becomes
//     dashboard_a.json), then deletes swap-uid-a (sourcePath still points to
//     dashboard_a.json → match → delete proceeds).
//  2. B runs next: writes swap-uid-a (CREATE, since A just deleted it), then
//     tries to delete swap-uid-b — but its sourcePath is now dashboard_a.json
//     (set by A's write), which ≠ dashboard_b.json → guard fires, skip delete.
//
// Both dashboards survive with their UIDs swapped.
func TestIntegrationProvisioning_IncrementalGitSync_MultiFileUIDSwap(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-incr-uid-swap"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": common.DashboardJSON("swap-uid-a", "Dashboard A", 1),
		"dashboard_b.json": common.DashboardJSON("swap-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"swap-uid-a": {Title: "Dashboard A", SourcePath: "dashboard_a.json"},
		"swap-uid-b": {Title: "Dashboard B", SourcePath: "dashboard_b.json"},
	})

	// Symmetric swap: A gets B's UID, B gets A's UID.
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(common.DashboardJSON("swap-uid-b", "Dashboard A Swapped", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(common.DashboardJSON("swap-uid-a", "Dashboard B Swapped", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "swap UIDs between A and B")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	helper.SyncAndWaitIncremental(t, repoName)

	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"swap-uid-a": {Title: "Dashboard B Swapped", SourcePath: "dashboard_b.json"},
		"swap-uid-b": {Title: "Dashboard A Swapped", SourcePath: "dashboard_a.json"},
	})
}

// TestIntegrationProvisioning_FullSync_MultiFileUIDTakeover_Recovery verifies
// that a second full sync recovers the correct dashboard state after a
// multi-file UID takeover.
//
// FIXME: Full sync processes file changes in parallel (applyResourcesInParallel),
// so there is no ordering guarantee between goroutines. During a UID takeover
// (file A claims file B's old UID while file B moves to a new UID), a race
// exists: if B's goroutine completes its write+delete cycle before A's write
// starts, B deletes the old UID before A can claim it. A's subsequent
// create-after-delete then fails against the storage layer, leaving one
// dashboard missing. This is a known bug — the first full sync may produce an
// inconsistent state.
//
// The second full sync recovers because it compares the git tree against the
// current Grafana resources and re-creates any missing dashboards. This test
// exists to document the bug and verify the recovery path.
func TestIntegrationProvisioning_FullSync_MultiFileUIDTakeover_Recovery(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-full-uid-takeover-recovery"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": common.DashboardJSON("full-uid-a", "Dashboard A", 1),
		"dashboard_b.json": common.DashboardJSON("full-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"full-uid-a": {Title: "Dashboard A", SourcePath: "dashboard_a.json"},
		"full-uid-b": {Title: "Dashboard B", SourcePath: "dashboard_b.json"},
	})

	// File A takes B's UID; file B gets a brand-new UID.
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(common.DashboardJSON("full-uid-b", "Dashboard A Took B", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(common.DashboardJSON("full-uid-new", "Dashboard B New UID", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "file A takes B's UID, B gets new UID")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// FIXME: The first full sync is non-deterministic due to parallel
	// processing. Depending on goroutine scheduling, the UID takeover race
	// may cause one dashboard to be lost. We intentionally do not assert
	// dashboard state here because the outcome varies between runs.
	helper.SyncAndWait(t, repoName)

	// A second full sync compares the git tree against the current Grafana
	// state and re-creates any resources that went missing in the first sync.
	// After this, the state must converge to the correct result.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"full-uid-b":   {Title: "Dashboard A Took B", SourcePath: "dashboard_a.json"},
		"full-uid-new": {Title: "Dashboard B New UID", SourcePath: "dashboard_b.json"},
	})
}

// TestIntegrationProvisioning_FullSync_MultiFileUIDSwap_Recovery verifies that
// a second full sync recovers the correct dashboard state after a symmetric UID
// swap (file A takes B's UID, file B takes A's UID).
//
// FIXME: The same parallel-processing race described in
// TestIntegrationProvisioning_FullSync_MultiFileUIDTakeover_Recovery applies
// here. With a symmetric swap, the race is even more pronounced: whichever
// goroutine completes its write+delete first destroys the UID the other
// goroutine needs. The first full sync may leave one or both dashboards in an
// inconsistent state. This is a known bug.
//
// The second full sync recovers because it compares the git tree against the
// current Grafana resources and re-creates any missing dashboards.
func TestIntegrationProvisioning_FullSync_MultiFileUIDSwap_Recovery(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "git-full-uid-swap-recovery"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard_a.json": common.DashboardJSON("fswap-uid-a", "Dashboard A", 1),
		"dashboard_b.json": common.DashboardJSON("fswap-uid-b", "Dashboard B", 1),
	}, "write", "branch")

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"fswap-uid-a": {Title: "Dashboard A", SourcePath: "dashboard_a.json"},
		"fswap-uid-b": {Title: "Dashboard B", SourcePath: "dashboard_b.json"},
	})

	// Symmetric swap: A gets B's UID, B gets A's UID.
	require.NoError(t, local.UpdateFile("dashboard_a.json", string(common.DashboardJSON("fswap-uid-b", "Dashboard A Swapped", 2))))
	require.NoError(t, local.UpdateFile("dashboard_b.json", string(common.DashboardJSON("fswap-uid-a", "Dashboard B Swapped", 2))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "swap UIDs between A and B")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// FIXME: The first full sync is non-deterministic due to parallel
	// processing. The symmetric swap race may cause one or both dashboards
	// to be lost. We do not assert state here.
	helper.SyncAndWait(t, repoName)

	// A second full sync re-compares the git tree and recovers any missing
	// resources, converging to the correct state.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	common.RequireDashboards(t, helper.DashboardsV1, ctx, map[string]common.ExpectedDashboard{
		"fswap-uid-a": {Title: "Dashboard B Swapped", SourcePath: "dashboard_b.json"},
		"fswap-uid-b": {Title: "Dashboard A Swapped", SourcePath: "dashboard_a.json"},
	})
}
