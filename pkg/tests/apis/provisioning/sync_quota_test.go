package provisioning

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
		helper.WaitForRepoDashboardCount(t, repo, 1)
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
		helper.WaitForRepoDashboardCount(t, repo, 1)

		// Verify quota condition is WithinQuota
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Add a second dashboard (still within limit of 5)
		dashboard2Content := helper.LoadFile("testdata/text-options.json")
		err := os.WriteFile(filepath.Join(repoPath, "dashboard2.json"), dashboard2Content, 0o600)
		require.NoError(t, err, "should be able to write dashboard2.json")

		// Should succeed since within quota
		helper.SyncAndWait(t, repo, nil)

		// Verify 2 dashboards exist
		helper.WaitForRepoDashboardCount(t, repo, 2)

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
		helper.WaitForRepoDashboardCount(t, repo, 2)

		// Now add a 3rd dashboard - this should be blocked by quota on the next full sync
		dashboard3Content := helper.LoadFile("testdata/timeline-demo.json")
		err = os.WriteFile(filepath.Join(repoPath, "dashboard3.json"), dashboard3Content, 0o600)
		require.NoError(t, err, "should be able to write dashboard3.json")

		// Should fail due to quota (net change +1, final count 3 > limit 1)
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Verify job has error state
		state := mustNestedString(job.Object, "status", "state")
		require.Equal(t, string(provisioning.JobStateError), state, "Sync job should fail due to quota when adding resources over limit")

		// Verify only 2 dashboards exist (3rd was not created)
		helper.WaitForRepoDashboardCount(t, repo, 2)
	})

	t.Run("out of limit repo blocks sync when net change still exceeds quota", func(t *testing.T) {
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
		helper.WaitForRepoDashboardCount(t, repo, 3)

		// Delete one dashboard file - net change is -1, but 4-1=3 still > limit of 2
		err := os.Remove(filepath.Join(repoPath, "dashboard3.json"))
		require.NoError(t, err, "should be able to delete dashboard3.json")

		// Trigger full sync - should fail
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Verify job has error state
		state := mustNestedString(job.Object, "status", "state")
		require.Equal(t, string(provisioning.JobStateError), state, "Sync job should fail because net change still exceeds quota")

		// Verify all 3 dashboards still exist (entire sync was blocked, including the deletion)
		helper.WaitForRepoDashboardCount(t, repo, 3)
	})
}
