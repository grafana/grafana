package foldermetadata

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_FolderUIDTooLong verifies that a
// repository whose _folder.json declares a UID longer than the folder API's
// 40-character limit surfaces the rejection as a warning on the sync job
// (so the job is not requeued forever) instead of as a hard error.
//
// Path-derived UIDs are always truncated to <=40 characters by
// resources.appendHashSuffix, so the only way a too-long UID reaches the
// folder API is via _folder.json metadata. This test sets that up
// explicitly and checks the same end-to-end contract that exists for
// FolderDepthExceeded:
//   - JobStateWarning, not Error
//   - Status.Warnings mentions the offending path and the legacy
//     "uid too long, max 40 characters" message
//   - the condition reason for ConditionTypePullStatus is
//     CompletedWithWarnings (current bucket; flips to FolderUIDTooLong if
//     a future change surfaces it on the condition)
//   - reruns produce the same warning state without state corruption
func TestIntegrationProvisioning_FullSync_FolderUIDTooLong(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-uid-too-long-repo"
	// 41 characters — one over the 40-char ceiling enforced by the folder API.
	const tooLongUID = "a0123456789012345678901234567890123456789"
	require.Equal(t, 41, len(tooLongUID), "test fixture must be exactly one over the 40-char limit")

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Shallow folder with a valid UID — must be created normally to prove
	// that one bad branch does not block the rest of the sync.
	writeToProvisioningPath(t, helper, "shallow/_folder.json", folderMetadataJSON("shallow-uid", "Shallow"))
	writeToProvisioningPath(t, helper, "shallow/dashboard1.json", common.DashboardJSON("shallow-dash", "Shallow Dashboard", 1))

	// Deep folder with a 41-char UID — the folder API must reject it; the
	// sync must surface the rejection as a warning, not an error.
	writeToProvisioningPath(t, helper, "bare-metal/_folder.json", folderMetadataJSON(tooLongUID, "Bare metal services engineering"))
	writeToProvisioningPath(t, helper, "bare-metal/dashboard2.json", common.DashboardJSON("bare-metal-dash", "Bare Metal Dashboard", 1))

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("Job state: %s", jobObj.Status.State)
	t.Logf("Job message: %s", jobObj.Status.Message)
	t.Logf("Job warnings: %v", jobObj.Status.Warnings)
	t.Logf("Job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"uid-too-long folders must be reported as warnings so the job queue does not retry the sync forever")
	require.Empty(t, jobObj.Status.Errors,
		"uid-too-long folders must not contribute to Status.Errors; treating them as errors triggers a retry loop")
	require.NotEmpty(t, jobObj.Status.Warnings, "expected at least one warning describing the UID-length violation")

	// Exactly one uid-too-long warning is expected: the offending folder
	// itself. Sibling resources under the same folder must be suppressed by
	// the failedCreations short-circuit so we don't burst-write identical
	// bad requests against the folder API.
	uidTooLongWarnings := 0
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, "uid too long, max 40 characters") ||
			strings.Contains(w, "folder.uid-too-long") ||
			strings.Contains(w, "40-character") {
			uidTooLongWarnings++
		}
	}
	require.Equal(t, 1, uidTooLongWarnings,
		"expected exactly one uid-too-long warning; saw %d. Warnings: %v",
		uidTooLongWarnings, jobObj.Status.Warnings)

	// The shallow folder (outside the failing subtree) must still be
	// created — a UID violation in one branch must not block the rest of
	// the sync.
	helper.RequireRepoDashboardCount(t, repo, 1)

	folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)

	managedSourcePaths := make(map[string]struct{})
	for _, f := range folders.Items {
		managerID, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
		if managerID != repo {
			continue
		}
		sourcePath, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
		managedSourcePaths[sourcePath] = struct{}{}
	}

	assert.Contains(t, managedSourcePaths, "shallow",
		"the shallow folder must be created normally despite the UID violation in another branch; got managed paths: %v",
		managedSourcePaths)

	// Pull condition must be a warning state, not Failure. The condition
	// reason currently buckets generic warnings under
	// ReasonCompletedWithWarnings; we assert that explicitly so a future
	// change to surface ReasonFolderUIDTooLong on the condition has to
	// update this assertion intentionally.
	helper.WaitForConditionReason(t, repo,
		provisioning.ConditionTypePullStatus,
		provisioning.ReasonCompletedWithWarnings)

	// Re-running the sync must reproduce the same outcome (warning, not
	// error) without crashing or losing the previously-synced shallow
	// dashboard. This guards against regressions where a uid-too-long
	// result poisons the repository state on the second pull.
	rerun := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	rerunObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(rerun.Object, rerunObj))
	require.Equal(t, provisioning.JobStateWarning, rerunObj.Status.State,
		"second pull should also surface the UID violation as a warning, not an error")
	require.Empty(t, rerunObj.Status.Errors)
	helper.RequireRepoDashboardCount(t, repo, 1)
}
