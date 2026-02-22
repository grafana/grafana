package provisioning

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_SyncQuotaHandling(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("out of limit repo works fine with deletions", func(t *testing.T) {
		// Set a limit and create repo that exceeds it
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 2 // Only allow 2 resources, 1 folder and 1 dashboard
		})

		const repo = "quota-deletion-test-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				// Adding 2 dashboards will exceed the limit of 1
				"testdata/all-panels.json":   "dashboard1.json",
				"testdata/text-options.json": "dashboard2.json",
			},
			SkipResourceAssertions: true, // We'll check quota condition instead
		}
		helper.CreateRepo(t, testRepo)

		// Wait for quota condition to be exceeded
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// Now delete one file to test that deletions work even when over quota
		err := os.Remove(filepath.Join(repoPath, "dashboard2.json"))
		require.NoError(t, err, "should be able to delete file")

		// Trigger full sync - deletion should proceed even though repo is over quota
		helper.SyncAndWait(t, repo, nil)

		// Verify the deletion succeeded by checking that only 1 dashboard remains
		helper.RequireRepoDashboardCount(t, repo, 1)
	})

	t.Run("within limit repo syncs successfully and allows adding more resources", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 5
		})

		const repo = "quota-within-limit-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)

		// Verify 1 dashboard was created
		helper.RequireRepoDashboardCount(t, repo, 1)

		// Verify quota condition is WithinQuota
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Add a second dashboard (still within limit of 5)
		dashboard2Content := helper.LoadFile("testdata/text-options.json")
		err := os.WriteFile(filepath.Join(repoPath, "dashboard2.json"), dashboard2Content, 0o600)
		require.NoError(t, err, "should be able to write dashboard2.json")

		// Should succeed since within quota
		helper.SyncAndWait(t, repo, nil)

		// Verify 2 dashboards exist
		helper.RequireRepoDashboardCount(t, repo, 2)

		// Verify quota condition is still WithinQuota
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)
	})

	t.Run("out of limit repo blocks new resource creation on subsequent sync", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1 // Only allow 1 resource
		})

		const repo = "quota-blocks-creation-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				// Adding 2 dashboards will exceed the limit of 1
				"testdata/all-panels.json":   "dashboard1.json",
				"testdata/text-options.json": "dashboard2.json",
			},
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for quota condition to be exceeded after initial sync
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// Verify the repo is over quota using the quotas package
		repoObj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		require.NoError(t, err)
		typedRepo := unstructuredToRepository(t, repoObj)
		require.True(t, quotas.IsQuotaExceeded(typedRepo.Status.Conditions), "quota should be exceeded")

		// Verify 2 dashboards were created by the initial sync (first sync always succeeds)
		helper.RequireRepoDashboardCount(t, repo, 2)

		// Now add a 3rd dashboard - this should be blocked by quota on the next full sync
		dashboard3Content := helper.LoadFile("testdata/timeline-demo.json")
		err = os.WriteFile(filepath.Join(repoPath, "dashboard3.json"), dashboard3Content, 0o600)
		require.NoError(t, err, "should be able to write dashboard3.json")

		// Should fail due to quota (net change +1, final count 3 > limit 1)
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Verify job has warning state
		jobObj := &provisioning.Job{}
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State, "Sync job should fail due to quota when adding resources over limit")
		require.NotEmpty(t, jobObj.Status.Message, "Sync job should have a message when failing due to quota")
		require.Contains(t, jobObj.Status.Message, "sync skipped: repository is already over quota and incoming changes do not free enough resources", "Sync job should fail due to quota when adding resources over limit")
		// Verify only 2 dashboards exist (3rd was not created)
		helper.RequireRepoDashboardCount(t, repo, 2)
	})
	t.Run("full sync that exceeds quota creates some resources and skips others with warnings", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			// Allow 3 total resources: 1 folder + 2 dashboards
			opts.ProvisioningMaxResourcesPerRepository = 3
		})

		const repo = "quota-partial-sync-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)

		// Step 1: Create a repo with 1 dashboard (2 resources total: 1 root folder + 1 dashboard)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)

		helper.RequireRepoDashboardCount(t, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Step 2: Add 2 more dashboard files (would bring total to 4, exceeding limit of 3)
		for _, file := range []struct {
			src, dst string
		}{
			{"testdata/text-options.json", "dashboard2.json"},
			{"testdata/timeline-demo.json", "dashboard3.json"},
		} {
			content := helper.LoadFile(file.src)
			err := os.WriteFile(filepath.Join(repoPath, file.dst), content, 0o600)
			require.NoError(t, err, "should be able to write %s", file.dst)
		}

		// Step 3: Trigger a full sync — the QuotaTracker starts at 2/3 so only 1 more creation is allowed
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		t.Logf("Job state: %s", jobObj.Status.State)
		t.Logf("Job message: %s", jobObj.Status.Message)
		t.Logf("Job warnings: %v", jobObj.Status.Warnings)
		t.Logf("Job errors: %v", jobObj.Status.Errors)
		for _, s := range jobObj.Status.Summary {
			t.Logf("Summary: group=%s kind=%s create=%d warning=%d error=%d warnings=%v",
				s.Group, s.Kind, s.Create, s.Warning, s.Error, s.Warnings)
		}

		// Step 4: Verify job completed with warning state (some resources were skipped)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"job should finish with warning when some resources are skipped due to quota")
		require.Empty(t, jobObj.Status.Errors, "quota-skipped resources should produce warnings, not errors")
		require.NotEmpty(t, jobObj.Status.Warnings, "should have warnings for skipped resources")

		quotaWarningCount := 0
		for _, w := range jobObj.Status.Warnings {
			if strings.Contains(w, "resource quota exceeded") {
				quotaWarningCount++
			}
		}
		require.Equal(t, 1, quotaWarningCount,
			"exactly 1 of the 2 new dashboards should be skipped due to quota")

		// Step 5: Verify partial sync — 1 new dashboard was created (total 2), 1 was skipped
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			assert.Len(collect, dashboards.Items, 2,
				"should have 2 dashboards: the original + 1 new (the other was skipped)")
		}, waitTimeoutDefault, waitIntervalDefault)

		// Step 6: Verify the repo is now at quota (1 folder + 2 dashboards = 3/3)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	t.Run("out of limit repo allows delete-only sync even when still over quota", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 2 // Only allow 2 resource
		})

		const repo = "quota-net-change-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				// Adding 3 dashboards (plus 1 folder) will exceed the limit of 2
				"testdata/all-panels.json":    "dashboard1.json",
				"testdata/text-options.json":  "dashboard2.json",
				"testdata/timeline-demo.json": "dashboard3.json",
			},
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for quota condition to be exceeded after initial sync
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// Verify 3 dashboards were created by the initial sync
		helper.RequireRepoDashboardCount(t, repo, 3)

		// Delete one dashboard file - deletion-only syncs are always allowed even when over quota
		err := os.Remove(filepath.Join(repoPath, "dashboard3.json"))
		require.NoError(t, err, "should be able to delete dashboard3.json")

		// Trigger full sync - should succeed because it's a delete-only sync
		helper.SyncAndWait(t, repo, nil)

		// Verify the deletion succeeded - only 2 dashboards should remain
		helper.RequireRepoDashboardCount(t, repo, 2)

		// Repository is still over quota (2 dashboards + 1 folder = 3 > limit of 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)
	})
}
