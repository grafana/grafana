package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_QuotaCondition(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("quota condition is QuotaUnlimited when no limit is configured", func(t *testing.T) {
		helper := runGrafana(t)
		ctx := context.Background()

		const repo = "quota-unlimited-repo"
		testRepo := TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			ExpectedDashboards: 1,
			ExpectedFolders:    1,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for the repository to be synced and check the Quota condition
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

			// Find the Quota condition
			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionTrue), quotaCondition["status"], "Quota condition should be True")
			assert.Equal(collect, provisioning.ReasonQuotaUnlimited, quotaCondition["reason"], "Quota reason should be QuotaUnlimited")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be set to QuotaUnlimited")
	})

	t.Run("quota condition is ResourceQuotaExceeded when limit is exceeded", func(t *testing.T) {
		// Set a low resource limit
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1 // Only allow 1 resource
		})
		ctx := context.Background()

		const repo = "quota-exceeded-repo"
		testRepo := TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Adding 2 dashboards will exceed the limit of 1
				"testdata/all-panels.json":   "dashboard1.json",
				"testdata/text-options.json": "dashboard2.json",
			},
			ExpectedDashboards: 2,
			ExpectedFolders:    1,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for the repository to be synced and check the Quota condition
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

			// Find the Quota condition
			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionFalse), quotaCondition["status"], "Quota condition should be False when exceeded")
			assert.Equal(collect, provisioning.ReasonResourceQuotaExceeded, quotaCondition["reason"], "Quota reason should be ResourceQuotaExceeded")
			assert.Contains(collect, quotaCondition["message"], "exceeded", "Message should mention exceeded")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be set to ResourceQuotaExceeded")
	})

	t.Run("quota condition is WithinQuota when resources are below limit", func(t *testing.T) {
		// Set a limit higher than resources
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 10 // Allow 10 resources
		})
		ctx := context.Background()

		const repo = "quota-within-repo"
		testRepo := TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				// Adding 1 dashboard, well under the limit of 10
				"testdata/all-panels.json": "dashboard1.json",
			},
			ExpectedDashboards: 1,
			ExpectedFolders:    1,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for the repository to be synced and check the Quota condition
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

			// Find the Quota condition
			var quotaCondition map[string]interface{}
			for _, c := range conditions {
				cond, ok := c.(map[string]interface{})
				if !ok {
					continue
				}
				if cond["type"] == provisioning.ConditionTypeQuota {
					quotaCondition = cond
					break
				}
			}

			if quotaCondition == nil {
				collect.Errorf("Quota condition not found")
				return
			}

			assert.Equal(collect, string(metav1.ConditionTrue), quotaCondition["status"], "Quota condition should be True when within quota")
			assert.Equal(collect, provisioning.ReasonWithinQuota, quotaCondition["reason"], "Quota reason should be WithinQuota")
		}, waitTimeoutDefault, waitIntervalDefault, "Quota condition should be set to WithinQuota")
	})
}

// unstructuredNestedSlice gets a nested slice from an unstructured object
func unstructuredNestedSlice(obj map[string]interface{}, fields ...string) ([]interface{}, bool, error) {
	val, found, err := nestedField(obj, fields...)
	if !found || err != nil {
		return nil, found, err
	}
	slice, ok := val.([]interface{})
	if !ok {
		return nil, false, nil
	}
	return slice, true, nil
}

// nestedField returns the value of a nested field
func nestedField(obj map[string]interface{}, fields ...string) (interface{}, bool, error) {
	var val interface{} = obj
	for _, field := range fields {
		m, ok := val.(map[string]interface{})
		if !ok {
			return nil, false, nil
		}
		val, ok = m[field]
		if !ok {
			return nil, false, nil
		}
	}
	return val, true, nil
}

func TestIntegrationProvisioning_QuotaStatus(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("quota status shows configured limits", func(t *testing.T) {
		// Set specific quota limits
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 50
			opts.ProvisioningMaxRepositories = 5
		})
		ctx := context.Background()

		const repo = "quota-status-configured-repo"
		testRepo := TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			ExpectedDashboards: 1,
			ExpectedFolders:    1,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for the repository to be reconciled and check the QuotaStatus
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			quota, found, err := nestedField(repoObj.Object, "status", "quota")
			if err != nil || !found {
				collect.Errorf("quota status not found: %v", err)
				return
			}

			quotaMap, ok := quota.(map[string]interface{})
			if !ok {
				collect.Errorf("quota status is not a map")
				return
			}

			// Check maxResourcesPerRepository
			maxResources, ok := quotaMap["maxResourcesPerRepository"]
			if !ok {
				collect.Errorf("maxResourcesPerRepository not found in quota status")
				return
			}
			assert.EqualValues(collect, 50, maxResources, "maxResourcesPerRepository should be 50")

			// Check maxRepositories
			maxRepos, ok := quotaMap["maxRepositories"]
			if !ok {
				collect.Errorf("maxRepositories not found in quota status")
				return
			}
			assert.EqualValues(collect, 5, maxRepos, "maxRepositories should be 5")
		}, waitTimeoutDefault, waitIntervalDefault, "QuotaStatus should show configured limits")
	})

	t.Run("quota status shows unlimited when no limits configured", func(t *testing.T) {
		// Don't set any quota limits (defaults to 0 = unlimited)
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 0
			opts.ProvisioningMaxRepositories = 0
		})
		ctx := context.Background()

		const repo = "quota-status-unlimited-repo"
		testRepo := TestRepo{
			Name:   repo,
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			ExpectedDashboards: 1,
			ExpectedFolders:    1,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for the repository to be reconciled and check the QuotaStatus
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("failed to get repository: %v", err)
				return
			}

			quota, found, err := nestedField(repoObj.Object, "status", "quota")
			if err != nil {
				collect.Errorf("error getting quota status: %v", err)
				return
			}

			// Quota status should exist but values should be 0 (unlimited)
			if !found {
				// If quota is not found at all, that's also acceptable for unlimited
				return
			}

			quotaMap, ok := quota.(map[string]interface{})
			if !ok {
				collect.Errorf("quota status is not a map")
				return
			}

			// Check maxResourcesPerRepository is 0 or not present (both mean unlimited)
			if maxResources, ok := quotaMap["maxResourcesPerRepository"]; ok {
				assert.EqualValues(collect, 0, maxResources, "maxResourcesPerRepository should be 0 (unlimited)")
			}

			// Check maxRepositories is 0 or not present (both mean unlimited)
			if maxRepos, ok := quotaMap["maxRepositories"]; ok {
				assert.EqualValues(collect, 0, maxRepos, "maxRepositories should be 0 (unlimited)")
			}
		}, waitTimeoutDefault, waitIntervalDefault, "QuotaStatus should show unlimited (0) values")
	})
}
