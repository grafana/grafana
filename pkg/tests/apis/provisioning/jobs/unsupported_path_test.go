package jobs

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_PullJobUnsupportedPath verifies that a full sync
// completes with a warning, not an error, when it finds a resource file whose
// path fails repository path validation (here: an unsafe character in the
// name). It also verifies the rest of the sync is unaffected -- a sibling
// dashboard with a valid path must still be created.
func TestIntegrationProvisioning_PullJobUnsupportedPath(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "unsupported-path-full-sync-repo"
	const unsafeName = "folder/Backend & UI.json"

	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "folder/dashboard1.json",
			"../testdata/text-options.json": unsafeName,
		},
		SkipSync: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("job state: %s message: %s", jobObj.Status.State, jobObj.Status.Message)
	t.Logf("job warnings: %v", jobObj.Status.Warnings)
	t.Logf("job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"an unsafe path must complete the sync as a warning, not an error")
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

	// The valid sibling dashboard must still sync despite the unsupported
	// path elsewhere in the same pass.
	helper.RequireRepoDashboardCount(t, repo, 1)
}
