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
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvrPlugins = schema.GroupVersionResource{
	Group:    "plugins.grafana.app",
	Version:  "v0alpha1",
	Resource: "plugins",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPlugins(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("create plugin", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPlugins,
		})
		pluginName := "test-plugin-create"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, pluginName, created.GetName())
	})

	t.Run("get plugin install", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPlugins,
		})
		pluginName := "test-plugin-get"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
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
			GVR:  gvrPlugins,
		})
		pluginName := "test-plugin-update"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
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

	t.Run("list plugin installs", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPlugins,
		})
		pluginName := "test-plugin-list"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		created, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
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
			GVR:  gvrPlugins,
		})
		pluginName := "test-plugin-delete"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"version": "1.0.0"}
		}`, pluginName))
		_, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
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
					GVR:  gvrPlugins,
				})
				plugin := helper.LoadYAMLOrJSON(`{
					"apiVersion": "plugins.grafana.app/v0alpha1",
					"kind": "Plugin",
					"metadata": {"name": "test-plugin"},
					"spec": {"version": "1.0.0"}
				}`)
				_, err := client.Resource.Create(context.Background(), plugin, metav1.CreateOptions{})
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
		AppModeProduction:      true,
		DisableAnonymous:       true,
		APIServerRuntimeConfig: "plugins.grafana.app/v0alpha1=true",
	})
	t.Cleanup(func() { helper.Shutdown() })
	return helper
}
