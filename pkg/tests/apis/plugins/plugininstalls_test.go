package plugins

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var gvrPluginInstalls = schema.GroupVersionResource{
	Group:    "plugins.grafana.app",
	Version:  "v0alpha1",
	Resource: "plugininstalls",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPluginInstalls(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("create plugin install", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-create"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, pluginName, created.GetName())
	})

	t.Run("create plugin install with status is ignored", func(t *testing.T) {
		t.Skip("status is not ignored on create. this might require a change in the SDK. skipping for now")
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-create-with-status"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"},
			"status": {
				"operatorStates": {
					"test-operator": {
						"lastEvaluation": "1",
						"state": "success"
					}
				}
			}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, pluginName, created.GetName())
		// Status should be empty as it's ignored on create
		status, found, err := unstructured.NestedMap(created.Object, "status")
		require.NoError(t, err)
		require.True(t, found)   // status field should exist
		require.Empty(t, status) // but it should be empty
	})

	t.Run("get plugin install", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-get"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)
		fetched, err := client.Resource.Get(ctx, pluginName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)
		require.Equal(t, pluginName, fetched.GetName())
		require.Equal(t, created.Object, fetched.Object)
	})

	t.Run("update plugin install", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-update"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)
		updatedSpec := created.DeepCopy()
		updatedSpec.Object["spec"] = map[string]interface{}{
			"version": "2.0.0",
		}
		updated, err := client.Resource.Update(ctx, updatedSpec, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, "2.0.0", updated.Object["spec"].(map[string]interface{})["version"])
	})

	t.Run("update plugin install with status is ignored", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-update-with-status"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)

		// Try to update the status via a normal update
		withStatus := created.DeepCopy()
		withStatus.Object["status"] = map[string]interface{}{
			"operatorStates": map[string]interface{}{
				"test-operator": map[string]interface{}{
					"lastEvaluation": "1",
					"state":          "success",
				},
			},
		}
		updated, err := client.Resource.Update(ctx, withStatus, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		// The status should not have been updated
		status, found, err := unstructured.NestedMap(updated.Object, "status")
		require.NoError(t, err)
		require.True(t, found)
		require.Empty(t, status)

		// also check with get
		fetched, err := client.Resource.Get(ctx, pluginName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)
		status, found, err = unstructured.NestedMap(fetched.Object, "status")
		require.NoError(t, err)
		require.True(t, found)
		require.Empty(t, status)
	})

	t.Run("update plugin install status", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-status"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)

		// Update the status
		status := created.DeepCopy()
		statusPayload := map[string]interface{}{
			"operatorStates": map[string]interface{}{
				"test-operator": map[string]interface{}{
					"lastEvaluation": "1",
					"state":          "success",
				},
			},
		}
		status.Object["status"] = statusPayload
		updated, err := client.Resource.UpdateStatus(ctx, status, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		// Check the status on the returned object
		actualStatus, found, err := unstructured.NestedMap(updated.Object, "status")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, statusPayload, actualStatus)

		// Get the status to ensure it persisted
		fetched, err := client.Resource.Get(ctx, pluginName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)
		actualStatus, found, err = unstructured.NestedMap(fetched.Object, "status")
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, statusPayload, actualStatus)
	})

	t.Run("list plugin installs", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-list"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)
		list, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		expectedItems := []unstructured.Unstructured{*created}
		require.ElementsMatch(t, expectedItems, list.Items)
	})

	t.Run("delete plugin install", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPluginInstalls,
		})
		pluginName := "test-plugin-delete"
		pluginInstall := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "PluginInstall",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		_, err := client.Resource.Create(ctx, pluginInstall, metav1.CreateOptions{})
		require.NoError(t, err)
		err = client.Resource.Delete(ctx, pluginName, metav1.DeleteOptions{})
		require.NoError(t, err)
		_, err = client.Resource.Get(ctx, pluginName, metav1.GetOptions{})
		statusError := helper.AsStatusError(err)
		require.Equal(t, metav1.StatusReasonNotFound, statusError.Status().Reason)
	})

	t.Run("insufficient permissions", func(t *testing.T) {
		helper := setupHelper(t)
		for _, user := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role: %s", user.Identity.GetOrgRole()), func(t *testing.T) {
				client := helper.GetResourceClient(apis.ResourceClientArgs{
					User: user,
					GVR:  gvrPluginInstalls,
				})
				pluginInstall := helper.LoadYAMLOrJSON(`{
					"apiVersion": "plugins.grafana.app/v0alpha1",
					"kind": "PluginInstall",
					"metadata": {"name": "test-plugin"},
					"spec": {"version": "1.0.0"}
				}`)
				_, err := client.Resource.Create(context.Background(), pluginInstall, metav1.CreateOptions{})
				statusError := helper.AsStatusError(err)
				require.Equal(t, metav1.StatusReasonForbidden, statusError.Status().Reason)
				err = client.Resource.Delete(context.Background(), "test-plugin", metav1.DeleteOptions{})
				statusError = helper.AsStatusError(err)
				require.Equal(t, metav1.StatusReasonForbidden, statusError.Status().Reason)
			})
		}
	})
}

func setupHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{},
	})
	t.Cleanup(func() { helper.Shutdown() })
	return helper
}
