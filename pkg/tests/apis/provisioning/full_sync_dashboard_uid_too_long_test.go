package provisioning

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FullSync_DashboardUIDTooLong verifies that a
// dashboard whose metadata.name exceeds the 40-character limit is surfaced
// as a sync warning rather than a hard error or retryable failure. The
// pre-flight check in the parser must reject the file before any apiserver
// PUT, so the dashboard service is never asked to validate it.
func TestIntegrationProvisioning_FullSync_DashboardUIDTooLong(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "dashboard-uid-too-long-repo"
	const tooLongUID = "a0123456789012345678901234567890123456789"
	require.Equal(t, 41, len(tooLongUID), "test fixture must be exactly one over the 40-char limit")

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	common.WriteToProvisioningPath(t, helper, "valid-dashboard.yaml", common.DashboardYAML("valid-uid", "Valid Dashboard"))
	common.WriteToProvisioningPath(t, helper, "too-long-dashboard.yaml", common.DashboardYAML(tooLongUID, "Too Long Dashboard"))

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
		"dashboard uid-too-long must be a warning so the sync is not retried")
	require.Empty(t, jobObj.Status.Errors,
		"dashboard uid-too-long must not contribute to Status.Errors")
	require.NotEmpty(t, jobObj.Status.Warnings, "expected a uid-too-long warning")

	matched := 0
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, tooLongUID) || strings.Contains(w, "40-character") {
			matched++
		}
	}
	require.Equal(t, 1, matched,
		"expected exactly one uid-too-long warning; warnings: %v", jobObj.Status.Warnings)

	// The valid dashboard must still be synced — one bad file must not block
	// the rest of the repository.
	helper.RequireRepoDashboardCount(t, repo, 1)

	helper.WaitForConditionReason(t, repo,
		provisioning.ConditionTypePullStatus,
		provisioning.ReasonCompletedWithWarnings)

	// Re-running must reproduce the same outcome.
	rerun := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	rerunObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(rerun.Object, rerunObj))
	require.Equal(t, provisioning.JobStateWarning, rerunObj.Status.State)
	require.Empty(t, rerunObj.Status.Errors)
	helper.RequireRepoDashboardCount(t, repo, 1)
}
