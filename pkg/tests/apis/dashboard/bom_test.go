package dashboards

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationDashboard_BOMs tests that BOMs in dashboards are handled correctly
// during CREATE, UPDATE, and PATCH operations via the admission mutation hook.
func TestIntegrationDashboard_BOMs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
	})
	t.Cleanup(helper.Shutdown)

	t.Run("v0alpha1 dashboard with BOMs in spec - CREATE", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv0.DashboardResourceInfo.GroupVersionResource(),
		})

		// Create dashboard with BOMs in various fields using unstructured
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv0.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-v0-create",
				},
				"spec": map[string]interface{}{
					"uid":           "bom-test-v0-create",
					"title":         "\ufeffDashboard with BOM",
					"description":   "Description\ufeffwith BOM in middle",
					"schemaVersion": 39,
					"panels": []interface{}{
						map[string]interface{}{
							"title": "\ufeffPanel 1",
							"type":  "graph",
						},
						map[string]interface{}{
							"title": "Panel 2\ufeff",
							"type":  "table",
						},
					},
					"tags": []interface{}{},
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "dashboard creation should succeed")

		// Verify BOMs were stripped
		spec, ok := created.Object["spec"].(map[string]interface{})
		require.True(t, ok)

		title, _ := spec["title"].(string)
		require.Equal(t, "Dashboard with BOM", title)
		require.NotContains(t, title, "\ufeff", "title should not contain BOMs")

		description, _ := spec["description"].(string)
		require.Equal(t, "Descriptionwith BOM in middle", description)
		require.NotContains(t, description, "\ufeff", "description should not contain BOMs")

		panels, _ := spec["panels"].([]interface{})
		require.Len(t, panels, 2)

		panel1 := panels[0].(map[string]interface{})
		panel1Title, _ := panel1["title"].(string)
		require.Equal(t, "Panel 1", panel1Title)
		require.NotContains(t, panel1Title, "\ufeff", "panel 1 title should not contain BOMs")

		panel2 := panels[1].(map[string]interface{})
		panel2Title, _ := panel2["title"].(string)
		require.Equal(t, "Panel 2", panel2Title)
		require.NotContains(t, panel2Title, "\ufeff", "panel 2 title should not contain BOMs")
	})

	t.Run("v0alpha1 dashboard - UPDATE and PATCH with BOMs", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv0.DashboardResourceInfo.GroupVersionResource(),
		})

		// First, create a dashboard without BOMs
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv0.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-v0-patch",
					"annotations": map[string]interface{}{
						"test-annotation": "test-value",
					},
				},
				"spec": map[string]interface{}{
					"uid":           "bom-test-v0-patch",
					"title":         "Original Title",
					"schemaVersion": 39,
					"panels":        []interface{}{},
					"tags":          []interface{}{},
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		// Update with BOMs (simulating what the mutation hook will clean up)
		spec := created.Object["spec"].(map[string]interface{})
		spec["title"] = "\ufeffTitle with BOM"
		spec["description"] = "Description\ufeffwith BOM"

		updated, err := client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Verify BOMs were stripped by the mutation hook during UPDATE
		spec = updated.Object["spec"].(map[string]interface{})
		title, _ := spec["title"].(string)
		require.NotContains(t, title, "\ufeff", "UPDATE should strip BOMs via mutation hook")

		// Now do a PATCH to remove an annotation (simulating provisioning finalizer behavior)
		patchData := []byte(`[{"op": "remove", "path": "/metadata/annotations/test-annotation"}]`)
		patched, err := client.Resource.Patch(ctx, "bom-test-v0-patch", types.JSONPatchType, patchData, metav1.PatchOptions{})
		require.NoError(t, err, "PATCH should succeed even if dashboard had BOMs")

		// Verify the annotation was removed
		annotations := patched.GetAnnotations()
		require.NotContains(t, annotations, "test-annotation", "annotation should be removed")

		// Verify BOMs remain stripped in the patched dashboard
		spec = patched.Object["spec"].(map[string]interface{})
		title, _ = spec["title"].(string)
		require.NotContains(t, title, "\ufeff", "PATCH should maintain BOM stripping")
	})

	t.Run("v1 dashboard with BOMs - CREATE and PATCH", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv1.DashboardResourceInfo.GroupVersionResource(),
		})

		// Create dashboard with BOMs
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv1.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-v1",
					"annotations": map[string]interface{}{
						"grafana.app/managedBy": "provisioning",
						"grafana.app/managerId": "test-repo",
					},
				},
				"spec": map[string]interface{}{
					"uid":           "bom-test-v1",
					"title":         "\ufeffDashboard V1 with BOM",
					"description":   "Description\ufeffwith BOM",
					"schemaVersion": 39,
					"panels": []interface{}{
						map[string]interface{}{
							"title": "\ufeffPanel Title",
							"type":  "graph",
						},
					},
					"tags": []interface{}{},
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		// Verify BOMs were stripped on CREATE
		spec := created.Object["spec"].(map[string]interface{})
		title, _ := spec["title"].(string)
		require.Equal(t, "Dashboard V1 with BOM", title)
		require.NotContains(t, title, "\ufeff")

		// PATCH to remove provisioning annotations (simulating finalizer)
		patchData := []byte(`[
			{"op": "remove", "path": "/metadata/annotations/grafana.app~1managedBy"},
			{"op": "remove", "path": "/metadata/annotations/grafana.app~1managerId"}
		]`)
		patched, err := client.Resource.Patch(ctx, "bom-test-v1", types.JSONPatchType, patchData, metav1.PatchOptions{})
		require.NoError(t, err, "PATCH to remove annotations should succeed")

		// Verify annotations were removed
		annotations := patched.GetAnnotations()
		require.NotContains(t, annotations, "grafana.app/managedBy")
		require.NotContains(t, annotations, "grafana.app/managerId")

		// Verify BOMs remain stripped
		spec = patched.Object["spec"].(map[string]interface{})
		title, _ = spec["title"].(string)
		require.NotContains(t, title, "\ufeff")
	})

	t.Run("v2alpha1 dashboard with BOMs in title and description", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv2alpha1.DashboardResourceInfo.GroupVersionResource(),
		})

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv2alpha1.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-v2alpha1",
				},
				"spec": map[string]interface{}{
					"title":       "\ufeffDashboard V2alpha1",
					"description": "Description\ufeffwith BOM",
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		// Verify BOMs were stripped
		spec := created.Object["spec"].(map[string]interface{})
		title, _ := spec["title"].(string)
		require.Equal(t, "Dashboard V2alpha1", title)
		require.NotContains(t, title, "\ufeff")

		description, _ := spec["description"].(string)
		require.Equal(t, "Descriptionwith BOM", description)
		require.NotContains(t, description, "\ufeff")
	})

	t.Run("v2beta1 dashboard with BOMs in title and description", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv2beta1.DashboardResourceInfo.GroupVersionResource(),
		})

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv2beta1.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-v2beta1",
				},
				"spec": map[string]interface{}{
					"title":       "\ufeffDashboard V2beta1",
					"description": "Description\ufeffwith BOM",
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		// Verify BOMs were stripped
		spec := created.Object["spec"].(map[string]interface{})
		title, _ := spec["title"].(string)
		require.Equal(t, "Dashboard V2beta1", title)
		require.NotContains(t, title, "\ufeff")

		description, _ := spec["description"].(string)
		require.Equal(t, "Descriptionwith BOM", description)
		require.NotContains(t, description, "\ufeff")
	})

	t.Run("PATCH operation strips BOMs from existing dashboard", func(t *testing.T) {
		// This test simulates the exact error scenario from provisioning:
		// 1. Dashboard exists (potentially with BOMs in spec)
		// 2. Repository is deleted with release-orphan-resources finalizer
		// 3. Finalizer PATCHes dashboard to remove ownership annotations
		// 4. Mutation hook should strip BOMs during PATCH
		// 5. Validation should pass

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv0.DashboardResourceInfo.GroupVersionResource(),
		})

		// Create a dashboard with provisioning annotations
		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv0.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-finalizer-simulation",
					"annotations": map[string]interface{}{
						"grafana.app/managedBy":      "provisioning",
						"grafana.app/managerId":      "test-repo",
						"grafana.app/sourcePath":     "/dashboards/test.json",
						"grafana.app/sourceChecksum": "abc123",
					},
				},
				"spec": map[string]interface{}{
					"uid":           "bom-test-finalizer",
					"title":         "\ufeffDashboard for Finalizer Test",
					"description":   "Description\ufeffwith BOM",
					"schemaVersion": 39,
					"panels": []interface{}{
						map[string]interface{}{
							"title": "\ufeffPanel with BOM",
							"type":  "graph",
						},
					},
					"tags": []interface{}{},
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		// Verify dashboard was created with BOMs stripped and annotations present
		annotations := created.GetAnnotations()
		require.Contains(t, annotations, "grafana.app/managedBy")
		require.Contains(t, annotations, "grafana.app/managerId")

		spec := created.Object["spec"].(map[string]interface{})
		title, _ := spec["title"].(string)
		require.NotContains(t, title, "\ufeff", "BOMs should be stripped on CREATE")

		// Now simulate the finalizer PATCH operation to remove ownership annotations
		// This is what was failing with "illegal byte order mark" error
		patchData := []byte(`[
			{"op": "remove", "path": "/metadata/annotations/grafana.app~1managedBy"},
			{"op": "remove", "path": "/metadata/annotations/grafana.app~1managerId"},
			{"op": "remove", "path": "/metadata/annotations/grafana.app~1sourcePath"},
			{"op": "remove", "path": "/metadata/annotations/grafana.app~1sourceChecksum"}
		]`)

		patched, err := client.Resource.Patch(ctx, "bom-test-finalizer-simulation", types.JSONPatchType, patchData, metav1.PatchOptions{})
		require.NoError(t, err, "PATCH should succeed without 'illegal byte order mark' error")

		// Verify annotations were removed (finalizer succeeded)
		annotations = patched.GetAnnotations()
		require.NotContains(t, annotations, "grafana.app/managedBy")
		require.NotContains(t, annotations, "grafana.app/managerId")
		require.NotContains(t, annotations, "grafana.app/sourcePath")
		require.NotContains(t, annotations, "grafana.app/sourceChecksum")

		// Verify dashboard spec still has no BOMs after PATCH
		spec = patched.Object["spec"].(map[string]interface{})
		title, _ = spec["title"].(string)
		require.NotContains(t, title, "\ufeff", "BOMs should remain stripped after PATCH")

		description, _ := spec["description"].(string)
		require.NotContains(t, description, "\ufeff", "BOMs should remain stripped after PATCH")
	})

	t.Run("verify JSON marshaling produces no BOMs", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv0.DashboardResourceInfo.GroupVersionResource(),
		})

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": dashv0.DashboardResourceInfo.GroupVersion().String(),
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name": "bom-test-json-marshal",
				},
				"spec": map[string]interface{}{
					"uid":           "bom-test-marshal",
					"title":         "\ufeffDashboard Title",
					"description":   "Description\ufeffwith BOM",
					"schemaVersion": 39,
					"panels":        []interface{}{},
					"tags":          []interface{}{},
				},
			},
		}

		created, err := client.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err)

		// Marshal to JSON and verify no BOMs in the serialized form
		jsonBytes, err := json.Marshal(created)
		require.NoError(t, err)
		require.NotContains(t, string(jsonBytes), "\ufeff", "JSON marshaling should not contain BOMs")

		// Verify the actual stored values don't have BOMs
		spec := created.Object["spec"].(map[string]interface{})
		title, _ := spec["title"].(string)
		assert.Equal(t, "Dashboard Title", title)
		assert.NotContains(t, title, "\ufeff")
	})
}
