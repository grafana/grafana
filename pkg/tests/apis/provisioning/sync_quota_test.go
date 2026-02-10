package provisioning

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_SyncQuotaHandling(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("out of limit repo works fine with deletions", func(t *testing.T) {
		// Set a limit and create repo that exceeds it
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1 // Only allow 1 resource
		})
		ctx := context.Background()

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
		helper.SyncAndWait(t, repo, nil)

		// Wait for quota condition to be exceeded
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			conditions, found, err := unstructuredNestedSlice(repoObj.Object, "status", "conditions")
			if err != nil || !found {
				collect.Errorf("conditions not found: %v", err)
				return
			}

			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeResourceQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionFalse), quotaCondition["status"], "Quota condition should be False when exceeded")
			assert.Equal(collect, provisioning.ReasonQuotaExceeded, quotaCondition["reason"], "Quota reason should be QuotaExceeded")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be set to QuotaExceeded")

		// Now delete one file to test that deletions work even when over quota
		dashboard2Path := filepath.Join(repoPath, "dashboard2.json")
		err := os.Remove(dashboard2Path)
		require.NoError(t, err, "should be able to delete file")

		// Trigger sync - deletion should proceed even though repo is over quota
		helper.SyncAndWait(t, repo, nil)

		// Verify the deletion succeeded by checking that only 1 dashboard remains
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			// Count dashboards managed by this repo
			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 1, repoDashboards, "should have 1 dashboard after deletion")
		}, waitTimeoutDefault, waitIntervalDefault, "Deletion should succeed even when over quota")
	})

	t.Run("within limit repo syncs successfully and allows adding more resources", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 5 // Allow 5 resources
		})
		ctx := context.Background()

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
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 1, repoDashboards, "should have 1 dashboard after initial sync")
		}, waitTimeoutDefault, waitIntervalDefault, "should have 1 dashboard after initial sync")

		// Verify quota condition is WithinQuota
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			conditions, found, err := unstructuredNestedSlice(repoObj.Object, "status", "conditions")
			if err != nil || !found {
				collect.Errorf("conditions not found: %v", err)
				return
			}

			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeResourceQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionTrue), quotaCondition["status"], "Quota should be True when within limit")
			assert.Equal(collect, provisioning.ReasonWithinQuota, quotaCondition["reason"], "Quota reason should be WithinQuota")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be WithinQuota after initial sync")

		// Add a second dashboard (still within limit of 5)
		dashboard2Content := helper.LoadFile("testdata/text-options.json")
		err := os.WriteFile(filepath.Join(repoPath, "dashboard2.json"), dashboard2Content, 0o600)
		require.NoError(t, err, "should be able to write dashboard2.json")

		// Trigger sync and wait for completion - should succeed since within quota
		helper.SyncAndWait(t, repo, nil)

		// Verify 2 dashboards exist
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 2, repoDashboards, "should have 2 dashboards after adding second one")
		}, waitTimeoutDefault, waitIntervalDefault, "should have 2 dashboards after second sync")

		// Verify quota condition is still WithinQuota
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			conditions, found, err := unstructuredNestedSlice(repoObj.Object, "status", "conditions")
			if err != nil || !found {
				collect.Errorf("conditions not found: %v", err)
				return
			}

			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeResourceQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionTrue), quotaCondition["status"], "Quota should still be True after adding resources within limit")
			assert.Equal(collect, provisioning.ReasonWithinQuota, quotaCondition["reason"], "Quota reason should still be WithinQuota")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should still be WithinQuota after adding resources")
	})

	t.Run("out of limit repo blocks new resource creation on subsequent sync", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1 // Only allow 1 resource
		})
		ctx := context.Background()

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
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			conditions, found, err := unstructuredNestedSlice(repoObj.Object, "status", "conditions")
			if err != nil || !found {
				collect.Errorf("conditions not found: %v", err)
				return
			}

			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeResourceQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionFalse), quotaCondition["status"], "Quota condition should be False when exceeded")
			assert.Equal(collect, provisioning.ReasonQuotaExceeded, quotaCondition["reason"], "Quota reason should be QuotaExceeded")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be set to QuotaExceeded")

		// Verify 2 dashboards were created by the initial sync (first sync always succeeds)
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 2, repoDashboards, "should have 2 dashboards from initial sync")
		}, waitTimeoutDefault, waitIntervalDefault, "should have 2 dashboards from initial sync")

		// Now add a 3rd dashboard - this should be blocked by quota on the next sync
		dashboard3Content := helper.LoadFile("testdata/timeline-demo.json")
		err := os.WriteFile(filepath.Join(repoPath, "dashboard3.json"), dashboard3Content, 0o600)
		require.NoError(t, err, "should be able to write dashboard3.json")

		// Trigger sync - should fail due to quota (net change +1, final count 3 > limit 1)
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Verify job has error state
		state := mustNestedString(job.Object, "status", "state")
		require.Equal(t, string(provisioning.JobStateError), state, "Sync job should fail due to quota when adding resources over limit")

		// Verify only 2 dashboards exist (3rd was not created)
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 2, repoDashboards, "should still have 2 dashboards - 3rd should not be created due to quota")
		}, waitTimeoutDefault, waitIntervalDefault, "3rd dashboard should not be created when over quota")
	})

	t.Run("out of limit repo blocks sync when net change still exceeds quota", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1 // Only allow 1 resource
		})
		ctx := context.Background()

		const repo = "quota-net-change-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		testRepo := TestRepo{
			Name:   repo,
			Path:   repoPath,
			Target: "folder",
			Copies: map[string]string{
				// Adding 3 dashboards will exceed the limit of 1
				"testdata/all-panels.json":    "dashboard1.json",
				"testdata/text-options.json":  "dashboard2.json",
				"testdata/timeline-demo.json": "dashboard3.json",
			},
			SkipResourceAssertions: true,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for quota condition to be exceeded after initial sync
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			conditions, found, err := unstructuredNestedSlice(repoObj.Object, "status", "conditions")
			if err != nil || !found {
				collect.Errorf("conditions not found: %v", err)
				return
			}

			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeResourceQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionFalse), quotaCondition["status"], "Quota condition should be False when exceeded")
			assert.Equal(collect, provisioning.ReasonQuotaExceeded, quotaCondition["reason"], "Quota reason should be QuotaExceeded")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be set to QuotaExceeded")

		// Verify 3 dashboards were created by the initial sync
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 3, repoDashboards, "should have 3 dashboards from initial sync")
		}, waitTimeoutDefault, waitIntervalDefault, "should have 3 dashboards from initial sync")

		// Delete one dashboard file - net change is -1, but 3-1=2 still > limit of 1
		err := os.Remove(filepath.Join(repoPath, "dashboard3.json"))
		require.NoError(t, err, "should be able to delete dashboard3.json")

		// Trigger sync - should fail because final count (2) still exceeds quota (1)
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		// Verify job has error state
		state := mustNestedString(job.Object, "status", "state")
		require.Equal(t, string(provisioning.JobStateError), state, "Sync job should fail because net change still exceeds quota")

		// Verify all 3 dashboards still exist (entire sync was blocked, including the deletion)
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				collect.Errorf("failed to list dashboards: %v", err)
				return
			}

			repoDashboards := 0
			for _, d := range dashboards.Items {
				managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
				if managerID == repo {
					repoDashboards++
				}
			}

			assert.Equal(collect, 3, repoDashboards, "should still have 3 dashboards - entire sync blocked because net change still exceeds quota")
		}, waitTimeoutDefault, waitIntervalDefault, "All 3 dashboards should remain when sync is blocked")
	})
}
