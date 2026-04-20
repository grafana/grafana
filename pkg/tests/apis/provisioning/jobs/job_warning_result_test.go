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

// assertJobWarningWith asserts that a completed job landed in JobStateWarning
// with at least one warning whose text contains every expected substring and
// no error entries. Returns the matching warning for additional assertions.
func assertJobWarningWith(t *testing.T, job map[string]any, expectedSubs ...string) string {
	t.Helper()
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job, jobObj))

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning state; warnings=%v errors=%v", jobObj.Status.Warnings, jobObj.Status.Errors)
	require.NotEmpty(t, jobObj.Status.Warnings, "job should have at least one warning")
	require.Empty(t, jobObj.Status.Errors, "validation errors should be surfaced as warnings, not errors")

	for _, warning := range jobObj.Status.Warnings {
		match := true
		for _, sub := range expectedSubs {
			if !strings.Contains(warning, sub) {
				match = false
				break
			}
		}
		if match {
			return warning
		}
	}
	require.Failf(t, "warning not found",
		"expected a warning containing all of %v; warnings=%v", expectedSubs, jobObj.Status.Warnings)
	return ""
}

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

// Dashboard validation errors (K8s apierrors.IsInvalid) must surface as
// sync warnings so a single broken dashboard does not abort the whole repo.

// TestIntegrationProvisioning_JobWarningResult_DashboardCUEEditableBool covers
// the CUE-scalar-type-mismatch error shape (bool field populated with a string,
// producing "mismatched types" via the dashboard Validate hook).
func TestIntegrationProvisioning_JobWarningResult_DashboardCUEEditableBool(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "job-warning-cue-editable-bool"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/dashboard-invalid-editable.json": "dashboard-editable.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	assertJobWarningWith(t, job.Object,
		"writing resource from file dashboard-editable.json",
		"editable",
	)
}

// TestIntegrationProvisioning_JobWarningResult_DashboardCUEPreloadBool covers
// a second CUE-type-mismatch shape: a field declared as bool in the schema
// populated with a string value. Paired with the editable-bool test, it
// exercises two distinct CUE paths through the admission Validate hook.
func TestIntegrationProvisioning_JobWarningResult_DashboardCUEPreloadBool(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "job-warning-cue-preload-bool"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/dashboard-invalid-preload.json": "dashboard-preload.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	assertJobWarningWith(t, job.Object,
		"writing resource from file dashboard-preload.json",
		"preload",
	)
}

// TestIntegrationProvisioning_JobWarningResult_InvalidDashboardsDoNotConsumeErrorBudget
// verifies that apierrors.IsInvalid failures are classified as warnings, not
// hard errors — so they do not count toward StrictMaxErrors(20). Without this
// behaviour, any repo with more than 20 malformed dashboards would abort sync
// with JobStateError; with it, the sync completes as JobStateWarning regardless
// of how many invalid dashboards are present.
//
// The test pulls 25 dashboards (strictly more than StrictMaxErrors) where each
// one triggers a CUE type mismatch via the dashboard admission Validate hook.
// All 25 must surface as warnings, errorCount must stay at zero, and the job
// must reach JobStateWarning rather than JobStateError.
func TestIntegrationProvisioning_JobWarningResult_InvalidDashboardsDoNotConsumeErrorBudget(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "job-warning-error-budget"
	// StrictMaxErrors is 20 (jobs/sync/worker.go). We emit strictly more so a
	// regression that reclassifies IsInvalid as a hard error would trip it.
	const invalidDashboardCount = 25

	testRepo := common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Emit N distinct v2beta1 dashboards, each with a CUE type mismatch on
	// "editable" (bool field populated with a string). Each write produces
	// apierrors.NewInvalid from the dashboard admission Validate hook. The
	// classifier must route every one of them to a warning; any reclassified
	// as an error would be counted in errorCount and, past the 20th, would
	// cause StrictMaxErrors to abort the sync with JobStateError.
	for i := range invalidDashboardCount {
		body := fmt.Appendf(nil, `{
  "apiVersion": "dashboard.grafana.app/v2beta1",
  "kind": "Dashboard",
  "metadata": {"name": "strict-max-%d"},
  "spec": {
    "title": "strict max dashboard %d",
    "editable": "maybe",
    "layout": {"kind": "GridLayout", "spec": {"items": []}}
  }
}
`, i, i)
		helper.WriteToProvisioningPath(t, fmt.Sprintf("dashboard-strict-%02d.json", i), body)
	}

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job must complete with warning state — a JobStateError here means %d IsInvalid failures consumed the error budget and tripped StrictMaxErrors; state=%s errors=%v",
		invalidDashboardCount, jobObj.Status.State, jobObj.Status.Errors)
	require.Empty(t, jobObj.Status.Errors,
		"errorCount must stay at zero — IsInvalid failures should never consume the error budget")
	require.GreaterOrEqual(t, len(jobObj.Status.Warnings), invalidDashboardCount,
		"expected at least %d warnings (one per invalid dashboard); got %d: %v",
		invalidDashboardCount, len(jobObj.Status.Warnings), jobObj.Status.Warnings)
}
