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

	require.NotEmpty(t, jobObj.Status.Errors,
		"accidental duplicate is user misuse and must be a errors, not warnings")
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"incremental sync should finish in warning state when a second file declares an existing UID")
	common.RequireJobErrorContains(t, jobObj, "duplicate resource name")

	// The original owner keeps the UID and file B's dashboard is not created, so
	// exactly one dashboard exists, still owned by file A.
	common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
		sharedUID: {Title: "Dashboard A", SourcePath: fileA},
	})
	helper.RequireRepoDashboardCount(t, repoName, 1)
}
