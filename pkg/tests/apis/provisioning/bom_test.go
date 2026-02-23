package provisioning

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_BOMs tests that BOMs in provisioned files are handled correctly
func TestIntegrationProvisioning_BOMs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "bom-test-repo"

	t.Run("dashboard JSON file with UTF-8 BOM prefix", func(t *testing.T) {
		// Create repository first
		helper.CreateRepo(t, TestRepo{
			Name:                   repo,
			Path:                   helper.ProvisioningPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		// Create a dashboard JSON file with UTF-8 BOM prefix (EF BB BF)
		dashboardWithBOM := []byte{0xEF, 0xBB, 0xBF} //nolint:prealloc // UTF-8 BOM
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
		t.Cleanup(func() { _ = os.Remove(testFile) })

		// Trigger sync to provision the dashboard
		helper.SyncAndWait(t, repo, nil)

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
		// Create repository first (reuse from previous test)
		// Note: Repository already exists from previous test

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
		t.Cleanup(func() { _ = os.Remove(testFile) })

		// Create repository
		repoName := "bom-embedded-repo"
		helper.CreateRepo(t, TestRepo{
			Name:                   repoName,
			Path:                   helper.ProvisioningPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		// Trigger sync to provision the dashboard
		helper.SyncAndWait(t, repoName, nil)

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
		// 2. Repository gets release-orphan-resources finalizer
		// 3. Repository is deleted
		// 4. Finalizer patches dashboard to remove ownership annotations (should succeed without BOM errors)
		// 5. Dashboard remains but annotations are removed

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

		// Create repository first
		repoName := "bom-deletion-repo"
		helper.CreateRepo(t, TestRepo{
			Name:                   repoName,
			Path:                   helper.ProvisioningPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		// Now create the dashboard file with BOMs
		testFile := filepath.Join(helper.ProvisioningPath, "bom-deletion-dashboard.json")
		err := os.WriteFile(testFile, []byte(dashboardJSON), 0644)
		require.NoError(t, err)
		t.Cleanup(func() { _ = os.Remove(testFile) })

		// Trigger sync to provision the dashboard
		helper.SyncAndWait(t, repoName, nil)

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
		require.Contains(t, annotations, "grafana.app/managedBy", "dashboard should have managedBy annotation")
		require.Contains(t, annotations, "grafana.app/managerId", "dashboard should have managerId annotation")

		// Patch repository to add release-orphan-resources finalizer
		// This causes dashboards to be released (annotations removed) rather than deleted
		patchData := []byte(`[
			{"op": "replace", "path": "/metadata/finalizers", "value": ["cleanup", "release-orphan-resources"]}
		]`)
		_, err = helper.Repositories.Resource.Patch(ctx, repoName, types.JSONPatchType, patchData, metav1.PatchOptions{})
		require.NoError(t, err, "should successfully patch finalizers")

		// Delete the repository - finalizer will patch dashboard to remove annotations
		// The key test: PATCH should succeed even though dashboard has BOMs in spec
		err = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Wait for repository to be deleted (finalizer has completed)
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
			if err == nil {
				collect.Errorf("repository should be deleted")
				return
			}
			// Repository not found - good!
		}, waitTimeoutDefault, waitIntervalDefault, "repository should be deleted")

		// Verify dashboard STILL EXISTS (released, not deleted)
		dashboard, err = helper.DashboardsV1.Resource.Get(ctx, "bom-deletion-test", metav1.GetOptions{})
		require.NoError(t, err, "dashboard should still exist after repository deletion")

		// Verify ownership annotations were REMOVED by the finalizer
		annotations = dashboard.GetAnnotations()
		require.NotContains(t, annotations, "grafana.app/managedBy", "managedBy annotation should be removed")
		require.NotContains(t, annotations, "grafana.app/managerId", "managerId annotation should be removed")
		require.NotContains(t, annotations, "grafana.app/sourcePath", "sourcePath annotation should be removed")
		require.NotContains(t, annotations, "grafana.app/sourceChecksum", "sourceChecksum annotation should be removed")

		// Verify dashboard spec still has no BOMs
		spec = dashboard.Object["spec"].(map[string]any)
		title = spec["title"].(string)
		require.NotContains(t, title, "\ufeff", "dashboard should not have BOMs after release")
	})

	t.Run("YAML file with BOM", func(t *testing.T) {
		// Create a YAML dashboard file with UTF-8 BOM
		yamlWithBOM := []byte{0xEF, 0xBB, 0xBF} //nolint:prealloc // UTF-8 BOM
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

		// Create repository first
		repoName := "bom-yaml-repo"
		helper.CreateRepo(t, TestRepo{
			Name:                   repoName,
			Path:                   helper.ProvisioningPath,
			Target:                 "folder",
			SkipResourceAssertions: true,
		})

		testFile := filepath.Join(helper.ProvisioningPath, "bom-yaml-dashboard.yaml")
		err := os.WriteFile(testFile, yamlWithBOM, 0644)
		require.NoError(t, err)
		t.Cleanup(func() { _ = os.Remove(testFile) })

		// Trigger sync to provision the dashboard
		helper.SyncAndWait(t, repoName, nil)

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
