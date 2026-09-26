package git

import (
	"strings"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

// TestIntegrationProvisioning_IncrementalSync_UnsupportedPath verifies that an
// incremental sync completes with a warning, not an error, when the new
// commit introduces a resource file whose path fails repository path
// validation (here: an unsafe character in the name). The previously-synced
// dashboard must remain untouched.
func TestIntegrationProvisioning_IncrementalSync_UnsupportedPath(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "incr-unsupported-path"
	const unsafeName = "Backend & UI.json"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("incr-unsupported-root", "Root Dashboard", 1),
	})

	// Full sync.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// Add a dashboard whose filename has an unsafe character.
	require.NoError(t, local.CreateFile(unsafeName, string(common.DashboardJSON("incr-unsupported-unsafe", "Unsafe Dashboard", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard with an unsafe filename")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Trigger incremental sync.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("job state: %s message: %s", jobObj.Status.State, jobObj.Status.Message)
	t.Logf("job warnings: %v", jobObj.Status.Warnings)
	t.Logf("job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"an unsafe path must complete the incremental sync as a warning, not an error")
	require.Empty(t, jobObj.Status.Errors,
		"an unsafe path is user-fixable content, not a system failure")
	require.NotEmpty(t, jobObj.Status.Warnings)

	found := false
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, unsafeName) && strings.Contains(w, "cannot be synced") {
			found = true
			break
		}
	}
	require.True(t, found, "expected a warning naming the unsafe file, got: %v", jobObj.Status.Warnings)

	// The previously-synced root dashboard must remain untouched.
	helper.RequireRepoDashboardCount(t, repoName, 1)
}
