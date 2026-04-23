package jobs

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_JobWarningResult(t *testing.T) {
	helper := sharedHelper(t)

	// Create a test repository with a malformed dashboard file
	const repo = "job-warning-test-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/invalid.json": "dashboard1.json",
		},
		SkipSync:               true, // Skip initial sync so we can add the malformed file first
		SkipResourceAssertions: true, // will check both at the same time below to reduce duration of this test
	}
	helper.CreateLocalRepo(t, testRepo)

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
	expectedWarningMsg := "writing resource from file dashboard1.json: failed to parse file: resource validation failed: file does not contain a valid resource: unable to read file (file: dashboard1.json, action: created)"
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

func TestIntegrationProvisioning_JobWarningResult_MissingName(t *testing.T) {
	helper := sharedHelper(t)

	// Create a test repository with a dashboard file missing the name field
	const repo = "job-warning-missing-name-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/dashboard-missing-name.json": "dashboard-no-name.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Execute a pull job - this should process the dashboard and result in a warning
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	// Verify the job completed with warning state
	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning state for missing name validation error")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"job should have warnings for the missing name error")
	require.Empty(t, jobObj.Status.Errors,
		"missing name validation error should be treated as warning, not error")

	// Verify the warning message contains the missing name error
	found := false
	for _, warningMsg := range jobObj.Status.Warnings {
		if strings.Contains(warningMsg, "missing name in resource") {
			found = true
			break
		}
	}
	require.True(t, found,
		"should have warning message mentioning missing name validation error")
}

func TestIntegrationProvisioning_JobWarningResult_DashboardRefreshInterval(t *testing.T) {
	helper := sharedHelper(t)

	// Create a test repository with a dashboard file with refresh interval too low
	const repo = "job-warning-refresh-interval-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/dashboard-refresh-too-low.json": "dashboard-refresh-low.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Execute a pull job - this should process the dashboard and result in a warning
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	// Verify the job completed with warning state
	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning state for refresh interval validation error")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"job should have warnings for the refresh interval error")
	require.Empty(t, jobObj.Status.Errors,
		"refresh interval validation error should be treated as warning, not error")

	// Verify the warning message contains the refresh interval error
	found := false
	for _, warningMsg := range jobObj.Status.Warnings {
		if strings.Contains(warningMsg, "Dashboard refresh interval is too low") {
			found = true
			break
		}
	}
	require.True(t, found,
		"should have warning message mentioning refresh interval validation error")
}

// TestIntegrationProvisioning_JobWarningResult_DashboardSchemaInvalid verifies
// that Kubernetes apiserver "Invalid" (HTTP 422, StatusReasonInvalid) errors
// produced by dashboard schema validation during a sync are treated as
// warnings, not hard errors.
func TestIntegrationProvisioning_JobWarningResult_DashboardSchemaInvalid(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "job-warning-invalid-schema-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/dashboard-v2-schema-invalid.json": "dashboard-v2-invalid.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Execute a pull job - this should process the dashboard, hit the v2 CUE
	// validator via apiserver admission, and classify the resulting IsInvalid
	// error as a warning rather than a hard error.
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	t.Logf("job status: state=%s message=%s", jobObj.Status.State, jobObj.Status.Message)
	for i, w := range jobObj.Status.Warnings {
		t.Logf("  warning[%d]: %s", i, w)
	}
	for i, e := range jobObj.Status.Errors {
		t.Logf("  error[%d]: %s", i, e)
	}

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning state for dashboard schema validation (IsInvalid) error")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"job should have warnings for the schema validation error")
	require.Empty(t, jobObj.Status.Errors,
		"dashboard schema validation errors should be treated as warnings, not errors")

	// The expected warning shape is produced by apierrors.NewInvalid, wrapped
	// by the provisioning writer. It contains:
	//   - the source file path (so users know which file to fix)
	//   - the "is invalid" marker from StatusReasonInvalid
	found := false
	for _, warningMsg := range jobObj.Status.Warnings {
		if strings.Contains(warningMsg, "dashboard-v2-invalid.json") &&
			strings.Contains(warningMsg, "is invalid") {
			found = true
			break
		}
	}
	require.True(t, found,
		"should have a warning message mentioning the file and an IsInvalid schema validation error, got: %v",
		jobObj.Status.Warnings)
}

func TestIntegrationProvisioning_JobWarningResult_DuplicateName(t *testing.T) {
	helper := sharedHelper(t)

	// Create a test repository with two dashboard files that share the same metadata.name.
	// The second file processed should trigger a "duplicate resource name" validation warning.
	const repo = "job-warning-duplicate-name-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/dashboard-duplicate-name.json":      "dashboard-dup1.json",
			"../testdata/dashboard-duplicate-name-copy.json": "dashboard-dup2.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Execute a pull job - this should detect the duplicate name and produce a warning
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	// Verify the job completed with warning state
	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning state for duplicate resource name")
	require.NotEmpty(t, jobObj.Status.Warnings,
		"job should have warnings for the duplicate resource name")
	require.Empty(t, jobObj.Status.Errors,
		"duplicate resource name should be treated as warning, not error")

	// Verify the warning message contains the duplicate name error
	found := false
	for _, warningMsg := range jobObj.Status.Warnings {
		if strings.Contains(warningMsg, "duplicate resource name") {
			found = true
			break
		}
	}
	require.True(t, found,
		"should have warning message mentioning duplicate resource name")
}
