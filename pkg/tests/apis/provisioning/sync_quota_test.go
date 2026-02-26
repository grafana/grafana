package provisioning

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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
			SkipSync:               true, // Prevent controller auto-sync racing with file copy
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)
		helper.SyncAndWait(t, repo, nil)

		// Wait for quota condition to be exceeded
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// Now delete one file to test that deletions work even when over quota
		err := os.Remove(filepath.Join(repoPath, "dashboard2.json"))
		require.NoError(t, err, "should be able to delete file")

		// Trigger full sync - deletion should proceed even though repo is over quota
		helper.SyncAndWait(t, repo, nil)

		// Verify the deletion succeeded by checking that only 1 dashboard remains
		helper.RequireRepoDashboardCount(t, repo, 1)

		// Verify pull status condition is successful after deletion sync
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonSuccess)
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
			SkipSync:               true,
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)
		helper.SyncAndWait(t, repo, nil)

		// Verify 1 dashboard was created
		helper.RequireRepoDashboardCount(t, repo, 1)

		// Verify quota condition is WithinQuota
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Verify pull status condition is successful after initial sync
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonSuccess)

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

		// Verify pull status condition is still successful after second sync
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonSuccess)
	})

	// Is only possible to set the first sync to exceed quota when the repo is created.
	// It should be possible to get that situation when https://github.com/grafana/git-ui-sync-project/issues/832 is implemented.
	t.Run("on the limit repo blocks new resource creation on subsequent sync", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 2 // Only allow 1 resource
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
			SkipSync:               true,
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)
		helper.SyncAndWait(t, repo, nil)

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

		// Should fail due to quota (net change +1, final count 3 > limit 2)
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

		// Verify pull status condition reflects quota exceeded after blocked sync
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonQuotaExceeded)
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
			SkipSync:               true,
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)
		helper.SyncAndWait(t, repo, nil)

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

	t.Run("full sync with nested folders counts folders toward quota and skips resources", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			// Allow 6 total resources: 1 root folder + 2 nested folders + 2 dashboards + 1 new folder = 6
			opts.ProvisioningMaxResourcesPerRepository = 6
		})

		const repo = "quota-nested-folders-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)

		// Total: 5 resources → 5/6, within quota.
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json":   "subfolder/dashboard1.json",
				"testdata/text-options.json": "subfolder/nested/dashboard2.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)
		helper.SyncAndWait(t, repo, nil)

		helper.RequireRepoDashboardCount(t, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Verify we have 3 folders (root + subfolder + subfolder/nested)
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		var managedFolderCount int
		for _, f := range folders.Items {
			managerID, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if managerID == repo {
				managedFolderCount++
			}
		}
		require.Equal(t, 3, managedFolderCount, "should have 3 folders: root + subfolder + subfolder/nested")

		// Step 2: Add 2 dashboards in new subfolders (each creates a folder + a dashboard).
		// This would bring total to 9 (5 existing + 2 folders + 2 dashboards), exceeding limit of 6.
		newDash1Content := helper.LoadFile("testdata/timeline-demo.json")
		err = os.MkdirAll(filepath.Join(repoPath, "new_a"), 0o750)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(repoPath, "new_a", "dashboard_new1.json"), newDash1Content, 0o600)
		require.NoError(t, err, "should be able to write new_a/dashboard_new1.json")

		newDash2Content := strings.Replace(string(helper.LoadFile("testdata/timeline-demo.json")), `"uid": "mIJjFy8Kz"`, `"uid": "quota-nested-extra"`, 1)
		err = os.MkdirAll(filepath.Join(repoPath, "new_b"), 0o750)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(repoPath, "new_b", "dashboard_new2.json"), []byte(newDash2Content), 0o600)
		require.NoError(t, err, "should be able to write new_b/dashboard_new2.json")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		t.Logf("Job state: %s", jobObj.Status.State)
		t.Logf("Job message: %s", jobObj.Status.Message)
		t.Logf("Job warnings: %v", jobObj.Status.Warnings)
		t.Logf("Job errors: %v", jobObj.Status.Errors)
		for _, s := range jobObj.Status.Summary {
			t.Logf("Summary: group=%s kind=%s create=%d warning=%d error=%d warnings=%v",
				s.Group, s.Kind, s.Create, s.Warning, s.Error, s.Warnings)
		}

		// Step 4: Verify job completed with warning (resources skipped due to quota)
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"job should finish with warning when some resources are skipped due to quota")
		require.Empty(t, jobObj.Status.Errors, "quota-skipped resources should produce warnings, not errors")
		require.NotEmpty(t, jobObj.Status.Warnings, "should have warnings for skipped resources")

		quotaWarningCount := 0
		for _, w := range jobObj.Status.Warnings {
			// TODO: Using contains for now, this will be easier once jobs contain top-level warning reasons.
			if strings.Contains(w, "resource quota exceeded") {
				quotaWarningCount++
			}
		}
		require.Equal(t, 3, quotaWarningCount,
			"should have 3 quota warnings: 1 skipped folder + 2 skipped dashboards")

		// Step 5: Verify no new dashboards were created (both skipped because the new folder consumed the last quota slot)
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			var repoDashboardCount int
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboardCount++
				}
			}
			assert.Equal(collect, 2, repoDashboardCount,
				"should still have only 2 dashboards: both new dashboards were skipped due to quota")
		}, waitTimeoutDefault, waitIntervalDefault)

		// Verify 1 new folder was created and 1 was skipped (4 total managed folders)
		folders, err = helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		managedFolderCount = 0
		for _, f := range folders.Items {
			managerID, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if managerID == repo {
				managedFolderCount++
			}
		}
		require.Equal(t, 4, managedFolderCount,
			"should have 4 folders: root + subfolder + subfolder/nested + 1 new (the other was skipped)")

		// Step 6: Verify the repo is now at quota (4 folders + 2 dashboards = 6/6)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	// Is it not possible to set the repo out of limit in this test.
	// It should be possible to get that situation when https://github.com/grafana/git-ui-sync-project/issues/832 is implemented.
	t.Run("out of limit repo allows delete-only sync", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 3 // Only allow 3 resource
		})

		const repo = "quota-net-change-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				// Adding 3 dashboards (plus 1 folder) will exceed the limit of 3
				"testdata/all-panels.json":    "dashboard1.json",
				"testdata/text-options.json":  "dashboard2.json",
				"testdata/timeline-demo.json": "dashboard3.json",
			},
			SkipSync:               true,
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)
		helper.SyncAndWait(t, repo, nil)

		// Wait for quota condition to be exceeded after initial sync
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// Verify 3 dashboards were created by the initial sync
		helper.RequireRepoDashboardCount(t, repo, 3)

		// Delete two dashboard files - deletion-only syncs are always allowed even when over quota
		err := os.Remove(filepath.Join(repoPath, "dashboard3.json"))
		require.NoError(t, err, "should be able to delete dashboard3.json")

		// Trigger full sync - should succeed because it's a delete-only sync
		helper.SyncAndWait(t, repo, nil)

		// Verify the deletion succeeded - only 2 dashboards should remain
		helper.RequireRepoDashboardCount(t, repo, 2)

		// Repository is still over quota (2 dashboards + 1 folder = 3 = limit of 3)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// Verify pull status condition is successful after deletion sync (delete-only syncs succeed)
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonSuccess)
	})
}
