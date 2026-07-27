package git

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_IncrementalGitSync_DuplicateUIDAcrossFiles verifies
// that when a second file introduces a UID already owned by a first file in a
// later sync, the sync warns and skips the second write instead of silently
// hijacking the resource.
//
// Provisioned resources are keyed by the UID in their content (metadata.name),
// not by file path. The in-run duplicate guard only catches two files colliding
// within the same sync's change set, so when file A is unchanged and file B is
// added declaring A's UID in a separate sync, B's write would otherwise upsert
// A's resource in place and flip its sourcePath annotation to B — turning A into
// an invisible zombie. The cross-file discriminator detects this and preserves
// the original owner.
//
// Two files at the repo root (not nested directories) exercise the exact
// per-file mechanism without involving folder creation.
func TestIntegrationProvisioning_IncrementalGitSync_DuplicateUIDAcrossFiles(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName  = "git-incr-dup-uid-across-files"
		sharedUID = "shared-uid"
		fileA     = "dashboard-a.json"
		fileB     = "dashboard-b.json"
	)

	// c1: only file A declares shared-uid.
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		fileA: common.DashboardJSON(sharedUID, "Dashboard A", 1),
	})

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
		sharedUID: {Title: "Dashboard A", SourcePath: fileA},
	})

	// c2: add file B declaring the SAME uid. File A is untouched, so its UID is
	// never re-written this sync and the in-run duplicate guard cannot see it.
	require.NoError(t, local.CreateFile(fileB, string(common.DashboardJSON(sharedUID, "Dashboard B", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add second file with duplicate uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors,
		"accidental duplicate is surfaced as a warning, not a hard error")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"incremental sync should finish in warning state when a second file declares an existing UID")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"incremental sync should produce a warning naming the duplicate")
	common.RequireJobWarningContains(t, jobObj, "duplicate resource name")

	// The original owner keeps the UID and file B's dashboard is not created, so
	// exactly one dashboard exists, still owned by file A.
	common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
		sharedUID: {Title: "Dashboard A", SourcePath: fileA},
	})
	helper.RequireRepoDashboardCount(t, repoName, 1)
}

// TestIntegrationProvisioning_FullSync_RenameWithDuplicateUID verifies that a full
// sync where the file owning a UID is renamed (content unchanged) AND a new file
// declares that same UID in the same sync "passes fine": the rename applies
// (UID re-homed to the new path) and the new file is flagged as a duplicate
// warning rather than hard-failing the job.
//
// DetectRenames pairs the delete+create of the moved file by content hash, so it
// becomes a rename (keeping the UID); the new file is a plain create that the
// in-run duplicate guard rejects once the rename has claimed the UID.
func TestIntegrationProvisioning_FullSync_RenameWithDuplicateUID(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName  = "git-full-rename-dup-uid"
		sharedUID = "shared-uid"
		fileA     = "dashboard-a.json"
		fileA2    = "dashboard-a2.json"
		fileB     = "dashboard-b.json"
	)

	// Seed with file A (UID shared-uid) and run an initial full sync.
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		fileA: common.DashboardJSON(sharedUID, "Dashboard A", 1),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
		sharedUID: {Title: "Dashboard A", SourcePath: fileA},
	})

	// In one commit: rename A → A2 (content/UID unchanged) AND add B declaring the
	// same UID. git mv preserves the blob so DetectRenames sees a rename.
	_, err := local.Git("mv", fileA, fileA2)
	require.NoError(t, err)
	require.NoError(t, local.CreateFile(fileB, string(common.DashboardJSON(sharedUID, "Dashboard B", 1))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename A to A2 and add B with duplicate uid")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Full pull (no Incremental).
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Empty(t, jobObj.Status.Errors,
		"the duplicate should be a warning, not a hard error — the rename must apply")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"full sync should finish in warning state (rename applied, duplicate flagged)")
	require.NotEmpty(t, jobObj.Status.Warnings)
	common.RequireJobWarningContains(t, jobObj, "duplicate resource name")

	// The rename re-homed the UID to A2; B was not created. Exactly one dashboard.
	common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
		sharedUID: {Title: "Dashboard A", SourcePath: fileA2},
	})
	helper.RequireRepoDashboardCount(t, repoName, 1)
}
