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

// TestIntegrationProvisioning_FullSync_FolderInvalidUIDChars verifies that a
// repository whose _folder.json declares a UID containing illegal characters
// surfaces the rejection as a generic FolderValidationFailed warning. This
// exercises the catch-all path in IsFolderValidationAPIError — the rejection
// is neither depth-exceeded nor uid-too-long, but it is a folder-API
// validation 4xx the sync cannot fix by retrying.
//
// The folder API validates that names match the DNS subdomain rules
// (a-z, 0-9, -, .). A name containing a space therefore triggers
// pkg/registry/apis/folders.ErrAPIInvalidUIDChars, which carries the
// "folder.invalid-uid-chars" message ID.
func TestIntegrationProvisioning_FullSync_FolderInvalidUIDChars(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-invalid-uid-chars-repo"
	// Contains a space — illegal per the folder API's DNS-name validation.
	const illegalUID = "hello world"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Shallow folder with a valid UID — must be created normally despite
	// the bad sibling branch.
	writeToProvisioningPath(t, helper, "shallow/_folder.json", folderMetadataJSON("shallow-uid", "Shallow"))
	writeToProvisioningPath(t, helper, "shallow/dashboard1.json", common.DashboardJSON("shallow-dash", "Shallow Dashboard", 1))

	// Folder with an illegal UID — the folder API must reject it; the
	// sync must surface the rejection as a warning, not an error.
	writeToProvisioningPath(t, helper, "bad-folder/_folder.json", folderMetadataJSON(illegalUID, "Bad folder"))
	writeToProvisioningPath(t, helper, "bad-folder/dashboard2.json", common.DashboardJSON("bad-folder-dash", "Bad Folder Dashboard", 1))

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
		"folder validation rejections must be reported as warnings so the job queue does not retry the sync forever")
	require.Empty(t, jobObj.Status.Errors,
		"folder validation rejections must not contribute to Status.Errors; treating them as errors triggers a retry loop")
	require.NotEmpty(t, jobObj.Status.Warnings, "expected at least one warning describing the validation rejection")

	// Exactly one validation warning is expected: the offending folder
	// itself. Sibling resources under the same folder must be suppressed
	// by the failedCreations short-circuit.
	validationWarnings := 0
	for _, w := range jobObj.Status.Warnings {
		// Match either the legacy human-readable message or the structured
		// errutil messageID embedded in the wrapped error.
		if strings.Contains(w, "uid contains illegal characters") ||
			strings.Contains(w, "folder.invalid-uid-chars") ||
			strings.Contains(w, "validation error") {
			validationWarnings++
		}
	}
	require.Equal(t, 1, validationWarnings,
		"expected exactly one folder-validation warning; saw %d. Warnings: %v",
		validationWarnings, jobObj.Status.Warnings)

	// The shallow folder (outside the failing subtree) must still be
	// created — a validation rejection in one branch must not block the
	// rest of the sync.
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
		"the shallow folder must be created normally despite the validation rejection in another branch; got managed paths: %v",
		managedSourcePaths)

	// Pull condition must be a warning state, not Failure. The condition
	// reason currently buckets generic warnings under
	// ReasonCompletedWithWarnings; we assert that explicitly so a future
	// change to surface ReasonFolderValidationFailed on the condition has
	// to update this assertion intentionally.
	helper.WaitForConditionReason(t, repo,
		provisioning.ConditionTypePullStatus,
		provisioning.ReasonCompletedWithWarnings)

	// Re-running the sync must reproduce the same outcome (warning, not
	// error) without crashing or losing the previously-synced shallow
	// dashboard.
	rerun := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	rerunObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(rerun.Object, rerunObj))
	require.Equal(t, provisioning.JobStateWarning, rerunObj.Status.State,
		"second pull should also surface the validation rejection as a warning, not an error")
	require.Empty(t, rerunObj.Status.Errors)
	helper.RequireRepoDashboardCount(t, repo, 1)
}
