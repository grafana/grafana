package provisioning

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_BOMs tests that BOMs in provisioned files are handled correctly
func TestIntegrationProvisioning_BOMs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "bom-test-repo"

	t.Run("dashboard JSON file with UTF-8 BOM prefix", func(t *testing.T) {
		// Create a dashboard JSON file with UTF-8 BOM prefix (EF BB BF)
		dashboardWithBOM := []byte{0xEF, 0xBB, 0xBF} // UTF-8 BOM
		dashboardWithBOM = append(dashboardWithBOM, []byte(`{
			"uid": "bom-prefix-test",
			"title": "Dashboard with BOM Prefix",
			"schemaVersion": 39,
			"panels": [],
			"tags": []
		}`)...)

		testFile := filepath.Join(helper.ProvisioningPath, "bom-prefix-dashboard.json")
		err := os.WriteFile(testFile, dashboardWithBOM, 0644)
		require.NoError(t, err)
		t.Cleanup(func() { os.Remove(testFile) })

		// Create repository that provisions this file
		helper.CreateRepo(t, TestRepo{
			Name:   repo,
			Path:   helper.ProvisioningPath,
			Target: "instance",
			Copies: map[string]string{
				"bom-prefix-dashboard.json": "bom-prefix-dashboard.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for dashboard to be provisioned
		var dashboard *unstructured.Unstructured
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err = helper.DashboardsV1.Resource.Get(ctx, "bom-prefix-test", metav1.GetOptions{})
			if err != nil {
				collect.Errorf("could not get dashboard: %s", err.Error())
				return
			}
			assert.NotNil(collect, dashboard)
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard should be provisioned")

		// Verify BOM was stripped from the stored dashboard
		spec, ok := dashboard.Object["spec"].(map[string]any)
		require.True(t, ok)

		title, ok := spec["title"].(string)
		require.True(t, ok)
		require.Equal(t, "Dashboard with BOM Prefix", title)
		require.NotContains(t, title, "\ufeff", "title should not contain BOM")

		// Convert to JSON and verify no BOM in the entire object
		dashboardJSON, err := json.Marshal(dashboard)
		require.NoError(t, err)
		require.NotContains(t, string(dashboardJSON), "\ufeff", "stored dashboard should not contain any BOMs")

		// Cleanup - delete repository
		err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("dashboard JSON file with embedded BOMs in strings", func(t *testing.T) {
		// Create dashboard with BOMs embedded in string values
		dashboardJSON := `{
			"uid": "bom-embedded-test",
			"title": "\ufeffDashboard with Embedded BOMs",
			"description": "Description\ufeffwith BOM in middle",
			"schemaVersion": 39,
			"panels": [
				{
					"title": "\ufeffPanel 1",
					"type": "graph"
				},
				{
					"title": "Panel 2\ufeff",
					"type": "table"
				}
			],
			"tags": []
		}`

		testFile := filepath.Join(helper.ProvisioningPath, "bom-embedded-dashboard.json")
		err := os.WriteFile(testFile, []byte(dashboardJSON), 0644)
		require.NoError(t, err)
		t.Cleanup(func() { os.Remove(testFile) })

		// Create repository
		repoName := "bom-embedded-repo"
		helper.CreateRepo(t, TestRepo{
			Name:   repoName,
			Path:   helper.ProvisioningPath,
			Target: "instance",
			Copies: map[string]string{
				"bom-embedded-dashboard.json": "bom-embedded-dashboard.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for dashboard to be provisioned
		var dashboard *unstructured.Unstructured
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err = helper.DashboardsV1.Resource.Get(ctx, "bom-embedded-test", metav1.GetOptions{})
			if err != nil {
				collect.Errorf("could not get dashboard: %s", err.Error())
				return
			}
			assert.NotNil(collect, dashboard)
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard should be provisioned")

		// Verify all BOMs were stripped
		spec := dashboard.Object["spec"].(map[string]any)

		// Check title
		title := spec["title"].(string)
		require.Equal(t, "Dashboard with Embedded BOMs", title)
		require.NotContains(t, title, "\ufeff")

		// Check description
		description := spec["description"].(string)
		require.Equal(t, "Descriptionwith BOM in middle", description)
		require.NotContains(t, description, "\ufeff")

		// Check panel titles
		panels := spec["panels"].([]any)
		require.Len(t, panels, 2)

		panel1 := panels[0].(map[string]any)
		panel1Title := panel1["title"].(string)
		require.Equal(t, "Panel 1", panel1Title)
		require.NotContains(t, panel1Title, "\ufeff")

		panel2 := panels[1].(map[string]any)
		panel2Title := panel2["title"].(string)
		require.Equal(t, "Panel 2", panel2Title)
		require.NotContains(t, panel2Title, "\ufeff")

		// Cleanup
		err = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("repository deletion with BOM dashboards succeeds", func(t *testing.T) {
		// This test simulates the original error scenario:
		// 1. Dashboard with BOMs is provisioned
		// 2. Repository is deleted
		// 3. Controller patches dashboard to remove ownership annotations
		// 4. Patch should succeed (BOM stripped by admission mutation)

		dashboardJSON := `{
			"uid": "bom-deletion-test",
			"title": "\ufeffDashboard for Deletion Test",
			"schemaVersion": 39,
			"panels": [{
				"title": "\ufeffPanel with BOM",
				"type": "graph"
			}],
			"tags": []
		}`

		testFile := filepath.Join(helper.ProvisioningPath, "bom-deletion-dashboard.json")
		err := os.WriteFile(testFile, []byte(dashboardJSON), 0644)
		require.NoError(t, err)
		t.Cleanup(func() { os.Remove(testFile) })

		// Create repository
		repoName := "bom-deletion-repo"
		helper.CreateRepo(t, TestRepo{
			Name:   repoName,
			Path:   helper.ProvisioningPath,
			Target: "instance",
			Copies: map[string]string{
				"bom-deletion-dashboard.json": "bom-deletion-dashboard.json",
			},
			SkipResourceAssertions: true,
		})

		// Wait for dashboard to be provisioned
		var dashboard *unstructured.Unstructured
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err = helper.DashboardsV1.Resource.Get(ctx, "bom-deletion-test", metav1.GetOptions{})
			if err != nil {
				collect.Errorf("could not get dashboard: %s", err.Error())
				return
			}
			assert.NotNil(collect, dashboard)
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard should be provisioned")

		// Verify dashboard was provisioned with BOMs stripped
		spec := dashboard.Object["spec"].(map[string]any)
		title := spec["title"].(string)
		require.NotContains(t, title, "\ufeff", "provisioned dashboard should not have BOMs")

		// Verify dashboard has ownership annotations from provisioning
		annotations := dashboard.GetAnnotations()
		require.NotEmpty(t, annotations, "dashboard should have annotations from provisioning")

		// Now delete the repository - this should succeed without BOM errors
		// The controller will patch dashboards to remove ownership annotations
		err = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Verify dashboard still exists but annotations might be removed
		// (depending on the finalizer implementation)
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err = helper.DashboardsV1.Resource.Get(ctx, "bom-deletion-test", metav1.GetOptions{})
			// Dashboard might be deleted or might exist without provisioning annotations
			// Either case is valid - we just verify no error occurred
			if err != nil {
				// Dashboard was deleted - that's fine
				return
			}
			// Dashboard still exists - verify no BOMs in spec
			if dashboard != nil {
				spec := dashboard.Object["spec"].(map[string]any)
				if title, ok := spec["title"].(string); ok {
					assert.NotContains(collect, title, "\ufeff", "dashboard should not have BOMs after repo deletion")
				}
			}
		}, waitTimeoutDefault, waitIntervalDefault, "repository deletion should complete without BOM errors")
	})

	t.Run("YAML file with BOM", func(t *testing.T) {
		// Create a YAML dashboard file with UTF-8 BOM
		yamlWithBOM := []byte{0xEF, 0xBB, 0xBF} // UTF-8 BOM
		yamlWithBOM = append(yamlWithBOM, []byte(`
apiVersion: dashboard.grafana.app/v1beta1
kind: Dashboard
metadata:
  name: bom-yaml-test
spec:
  uid: bom-yaml-test
  title: Dashboard from YAML with BOM
  schemaVersion: 39
  panels: []
  tags: []
`)...)

		testFile := filepath.Join(helper.ProvisioningPath, "bom-yaml-dashboard.yaml")
		err := os.WriteFile(testFile, yamlWithBOM, 0644)
		require.NoError(t, err)
		t.Cleanup(func() { os.Remove(testFile) })

		// Create repository
		repoName := "bom-yaml-repo"
		helper.CreateRepo(t, TestRepo{
			Name:   repoName,
			Path:   helper.ProvisioningPath,
			Target: "instance",
			Copies: map[string]string{
				"bom-yaml-dashboard.yaml": "bom-yaml-dashboard.yaml",
			},
			SkipResourceAssertions: true,
		})

		// Wait for dashboard to be provisioned
		var dashboard *unstructured.Unstructured
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err = helper.DashboardsV1.Resource.Get(ctx, "bom-yaml-test", metav1.GetOptions{})
			if err != nil {
				collect.Errorf("could not get dashboard: %s", err.Error())
				return
			}
			assert.NotNil(collect, dashboard)
		}, waitTimeoutDefault, waitIntervalDefault, "dashboard from YAML should be provisioned")

		// Verify BOM was stripped
		spec := dashboard.Object["spec"].(map[string]any)
		title := spec["title"].(string)
		require.Equal(t, "Dashboard from YAML with BOM", title)
		require.NotContains(t, title, "\ufeff")

		// Cleanup
		err = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// Helper function to check if a string or nested structure contains BOMs
func containsBOM(v any) bool {
	switch val := v.(type) {
	case string:
		return strings.Contains(val, "\ufeff")
	case map[string]any:
		for _, v := range val {
			if containsBOM(v) {
				return true
			}
		}
	case []any:
		for _, item := range val {
			if containsBOM(item) {
				return true
			}
		}
	}
	return false
}
