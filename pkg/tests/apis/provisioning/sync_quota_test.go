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
}

// unstructuredNestedStringSlice gets a nested string slice from an unstructured object
func unstructuredNestedStringSlice(obj map[string]interface{}, fields ...string) ([]string, bool, error) {
	val, found, err := nestedField(obj, fields...)
	if !found || err != nil {
		return nil, found, err
	}
	slice, ok := val.([]interface{})
	if !ok {
		return nil, false, nil
	}
	result := make([]string, 0, len(slice))
	for _, v := range slice {
		if str, ok := v.(string); ok {
			result = append(result, str)
		}
	}
	return result, true, nil
}
