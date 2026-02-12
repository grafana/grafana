package dashboards

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationDashboardBOMHandling tests that BOMs are stripped during dashboard operations
func TestIntegrationDashboardBOMHandling(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("v0alpha1 dashboards", func(t *testing.T) {
		testDashboardBOMHandling(t, dashboardV0.DashboardResourceInfo.GroupVersionResource())
	})

	t.Run("v1beta1 dashboards", func(t *testing.T) {
		testDashboardBOMHandling(t, dashboardV1.DashboardResourceInfo.GroupVersionResource())
	})
}

func testDashboardBOMHandling(t *testing.T, gvr schema.GroupVersionResource) {
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:      true,
		DisableDataMigrations: true,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: rest.Mode2,
			},
		},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	t.Run("create dashboard with BOM in title and description", func(t *testing.T) {
		// Create dashboard with BOMs in various fields
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":         "\ufeffDashboard with BOM",
					"description":   "Description\ufeffwith BOM",
					"schemaVersion": 39,
					"panels": []any{
						map[string]any{
							"title": "\ufeffPanel 1",
							"type":  "graph",
						},
						map[string]any{
							"title": "Panel 2\ufeff",
							"type":  "table",
						},
					},
					"tags": []any{},
				},
			},
		}
		obj.SetGenerateName("bom-test-")
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")

		// Create the dashboard
		created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, created.GetName())

		// Retrieve and verify BOMs were stripped
		retrieved, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		spec, ok := retrieved.Object["spec"].(map[string]any)
		require.True(t, ok)

		// Verify title has no BOM
		title, ok := spec["title"].(string)
		require.True(t, ok)
		require.Equal(t, "Dashboard with BOM", title, "BOM should be stripped from title")
		require.NotContains(t, title, "\ufeff", "title should not contain BOM character")

		// Verify description has no BOM
		description, ok := spec["description"].(string)
		require.True(t, ok)
		require.Equal(t, "Descriptionwith BOM", description, "BOM should be stripped from description")
		require.NotContains(t, description, "\ufeff", "description should not contain BOM character")

		// Verify panel titles have no BOMs
		panels, ok := spec["panels"].([]any)
		require.True(t, ok)
		require.Len(t, panels, 2)

		panel1 := panels[0].(map[string]any)
		panel1Title := panel1["title"].(string)
		require.Equal(t, "Panel 1", panel1Title, "BOM should be stripped from panel 1 title")
		require.NotContains(t, panel1Title, "\ufeff")

		panel2 := panels[1].(map[string]any)
		panel2Title := panel2["title"].(string)
		require.Equal(t, "Panel 2", panel2Title, "BOM should be stripped from panel 2 title")
		require.NotContains(t, panel2Title, "\ufeff")

		// Cleanup
		err = client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("patch dashboard with BOMs to remove annotations", func(t *testing.T) {
		// First, create a dashboard without BOMs
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":         "Clean Dashboard",
					"schemaVersion": 39,
					"panels":        []any{},
					"tags":          []any{},
				},
			},
		}
		obj.SetGenerateName("patch-test-")
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		obj.SetAnnotations(map[string]string{
			"test-annotation": "test-value",
		})

		created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Now manually inject BOMs into the stored dashboard by patching with BOMs
		// This simulates a dashboard that was created before the BOM fix
		patchWithBOM := map[string]any{
			"spec": map[string]any{
				"title":       "\ufeffDashboard with injected BOM",
				"description": "\ufeffBOM in description",
			},
		}
		patchBytes, err := json.Marshal(patchWithBOM)
		require.NoError(t, err)

		patched, err := client.Resource.Patch(ctx, created.GetName(), types.MergePatchType, patchBytes, metav1.PatchOptions{})
		require.NoError(t, err)

		// Verify BOMs were stripped by admission mutation during patch
		spec, ok := patched.Object["spec"].(map[string]any)
		require.True(t, ok)

		title := spec["title"].(string)
		require.Equal(t, "Dashboard with injected BOM", title, "BOM should be stripped during patch")
		require.NotContains(t, title, "\ufeff")

		description := spec["description"].(string)
		require.Equal(t, "BOM in description", description)
		require.NotContains(t, description, "\ufeff")

		// Now patch to remove annotations (simulating repository deletion scenario)
		// This should not fail even if the dashboard somehow has BOMs
		removePatch := []byte(`{"metadata":{"annotations":null}}`)
		finalPatched, err := client.Resource.Patch(ctx, created.GetName(), types.MergePatchType, removePatch, metav1.PatchOptions{})
		require.NoError(t, err, "Patching to remove annotations should succeed even with BOMs in spec")

		// Verify annotations were removed
		require.Empty(t, finalPatched.GetAnnotations(), "annotations should be removed")

		// Verify spec still has no BOMs
		finalSpec := finalPatched.Object["spec"].(map[string]any)
		finalTitle := finalSpec["title"].(string)
		require.NotContains(t, finalTitle, "\ufeff", "spec should not have BOMs after annotation removal")

		// Cleanup
		err = client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("update dashboard with BOMs", func(t *testing.T) {
		// Create a dashboard
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":         "Original Title",
					"schemaVersion": 39,
					"panels":        []any{},
					"tags":          []any{},
				},
			},
		}
		obj.SetGenerateName("update-test-")
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")

		created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Update with BOMs in the title
		spec := created.Object["spec"].(map[string]any)
		spec["title"] = "\ufeffUpdated Title with BOM"
		spec["description"] = "New description\ufeffwith BOM"

		updated, err := client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Verify BOMs were stripped during update
		updatedSpec := updated.Object["spec"].(map[string]any)
		updatedTitle := updatedSpec["title"].(string)
		require.Equal(t, "Updated Title with BOM", updatedTitle)
		require.NotContains(t, updatedTitle, "\ufeff")

		updatedDesc := updatedSpec["description"].(string)
		require.Equal(t, "New descriptionwith BOM", updatedDesc)
		require.NotContains(t, updatedDesc, "\ufeff")

		// Cleanup
		err = client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

// TestIntegrationDashboardBOMInJSON tests BOM handling in raw JSON payloads
func TestIntegrationDashboardBOMInJSON(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:      true,
		DisableDataMigrations: true,
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: rest.Mode2,
			},
		},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	gvr := dashboardV1.DashboardResourceInfo.GroupVersionResource()
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	t.Run("create dashboard from JSON with embedded BOMs", func(t *testing.T) {
		// JSON payload with BOMs embedded in string values
		jsonWithBOM := `{
			"apiVersion": "` + gvr.GroupVersion().String() + `",
			"kind": "Dashboard",
			"metadata": {
				"generateName": "json-bom-test-"
			},
			"spec": {
				"title": "\ufeffDashboard from JSON",
				"schemaVersion": 39,
				"panels": [
					{
						"title": "\ufeffPanel Title",
						"type": "graph"
					}
				],
				"tags": []
			}
		}`

		// Unmarshal into unstructured
		obj := &unstructured.Unstructured{}
		err := json.Unmarshal([]byte(jsonWithBOM), obj)
		require.NoError(t, err)

		// Create the dashboard
		created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, created.GetName())

		// Retrieve and verify
		retrieved, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		// Convert back to JSON to check for BOMs
		retrievedJSON, err := json.Marshal(retrieved)
		require.NoError(t, err)
		retrievedStr := string(retrievedJSON)

		// Verify no BOM characters in the JSON
		require.NotContains(t, retrievedStr, "\ufeff", "stored JSON should not contain BOM characters")
		require.NotContains(t, retrievedStr, string([]byte{0xEF, 0xBB, 0xBF}), "stored JSON should not contain UTF-8 BOM")

		// Verify specific fields
		spec := retrieved.Object["spec"].(map[string]any)
		title := spec["title"].(string)
		require.Equal(t, "Dashboard from JSON", title)
		require.False(t, strings.Contains(title, "\ufeff"), "title should not have BOM")

		// Cleanup
		err = client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}
