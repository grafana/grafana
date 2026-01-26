package provisioning

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_JobWarningResult(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)

	// Create a test repository with a malformed dashboard file
	const repo = "job-warning-test-repo"
	testRepo := TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/invalid.json": "dashboard1.json",
		},
		SkipSync:               true, // Skip initial sync so we can add the malformed file first
		SkipResourceAssertions: true, // will check both at the same time below to reduce duration of this test
	}
	helper.CreateRepo(t, testRepo)

	// Execute a pull job - this should process the malformed dashboard and result in warnings
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	// Verify the job completed with warning state (not error, not success)
	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	// The job should complete with "warning" state when there are validation errors
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning state when parsing malformed dashboard")
	require.NotEqual(t, provisioning.JobStateSuccess, jobObj.Status.State,
		"job should not be in success state")
	require.NotEqual(t, provisioning.JobStateError, jobObj.Status.State,
		"job should not be in error state (validation errors are warnings)")

	// Verify the job has warnings (not errors)
	require.NotEmpty(t, jobObj.Status.Warnings,
		"job should have warnings for the malformed dashboard resource")
	require.Empty(t, jobObj.Status.Errors,
		"job should not have errors (validation errors are treated as warnings)")

	// Verify that the warning message mentions the malformed resource
	found := false
	expectedWarningMsg := "writing resource from file dashboard1.json: failed to parse file: resource validation failed: unable to read file (file: dashboard1.json, name: , action: created)"
	for _, warningMsg := range jobObj.Status.Warnings {
		fmt.Println(warningMsg)
		if warningMsg == expectedWarningMsg {
			found = true
			break
		}
	}
	require.True(t, found,
		"should have warning message mentioning the malformed dashboard file or validation failure")
}
