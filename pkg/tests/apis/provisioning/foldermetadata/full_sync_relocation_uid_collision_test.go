package foldermetadata

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_RelocationExemptionDoesNotLeakToChild
// guards the path-binding of relocation exemptions (PR review comment
// discussion_r3750652263).
//
// A single commit relocates a parent folder (keeping its stable _folder.json
// UID) while a folder nested under it accidentally declares that same parent
// UID. The parent is a legitimate stable-UID move, so its UID is exempted from
// the duplicate-UID guard for its own ancestor walk. The exemption must be bound
// to the parent's destination path only: when the child leaf resolves the parent
// UID at a different path, the guard must still fire.
//
// Before the fix the exemption was UID-only, so the guard was bypassed at the
// child leaf too and EnsureFolderExists silently repointed the parent's folder
// object to the child path — a genuine collision swallowed as success. After the
// fix the collision surfaces as a warning (never a hard error, so the job does
// not retry forever) and the parent folder stays at its own relocated path.
//
// NOTE: written but not run in this change set (integration tests on this branch
// are added but executed only on request).
func TestIntegrationProvisioning_FullSync_RelocationExemptionDoesNotLeakToChild(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "folder-relocation-uid-collision"
	const (
		parentUID = "alpha-folder-uid"
		childUID  = "services-folder-uid"
	)

	writeToProvisioningPath(t, helper, "alpha/_folder.json", folderMetadataJSON(parentUID, "Alpha Team"))
	writeToProvisioningPath(t, helper, "alpha/services/_folder.json", folderMetadataJSON(childUID, "Services Group"))

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "alpha/dashboard.json",
			"../testdata/text-options.json": "alpha/services/dashboard.json",
		},
		SkipSync: true,
	})

	helper.SyncAndWait(t, repo, nil)

	// Initial state: both folders at their original paths under their stable UIDs.
	common.RequireFolderState(t, helper.Folders, parentUID, "Alpha Team", "alpha", repo)
	common.RequireFolderState(t, helper.Folders, childUID, "Services Group", "alpha/services", parentUID)

	// Relocate the parent (alpha -> gamma), keeping its stable UID so it is a
	// legitimate move that earns a relocation exemption. In the same commit the
	// nested folder moves (services -> workers) but its _folder.json is rewritten
	// to accidentally claim the parent's UID.
	moveInProvisioningPath(t, helper, "alpha", "gamma")
	moveInProvisioningPath(t, helper, "gamma/services", "gamma/workers")
	writeToProvisioningPath(t, helper, "gamma/workers/_folder.json", folderMetadataJSON(parentUID, "Workers Group"))

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("Job state: %s", jobObj.Status.State)
	t.Logf("Job warnings: %v", jobObj.Status.Warnings)
	t.Logf("Job errors: %v", jobObj.Status.Errors)

	// The accidental UID reuse is a genuine collision: it must be a warning (so
	// the job queue does not retry forever), never a silent success.
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"a child reusing a relocating parent's UID must surface as a warning, not silent success")
	require.Empty(t, jobObj.Status.Errors,
		"the collision must not contribute to Status.Errors; treating it as an error triggers a retry loop")

	collisionWarnings := 0
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, "already used by folder") {
			collisionWarnings++
		}
	}
	require.GreaterOrEqual(t, collisionWarnings, 1,
		"expected a duplicate-UID collision warning; got warnings: %v", jobObj.Status.Warnings)

	// The parent relocated to its own destination path and was NOT hijacked to the
	// child path. Under the pre-fix behaviour the parent object would be repointed
	// to gamma/workers, so this assertion fails on the leaked-exemption bug.
	common.RequireFolderState(t, helper.Folders, parentUID, "Alpha Team", "gamma", repo)
	require.Equal(t, parentUID, findFolderUIDBySourcePath(t, helper, repo, "gamma"),
		"parent UID must remain bound to its own relocated path")
}
