package plugins

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginMeta(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Run("list plugin metas", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPlugins,
		})

		plugin1Name := "test-plugin-metas-1"
		plugin1 := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"id": "grafana-piechart-panel", "version": "1.0.0"}
		}`, plugin1Name))
		_, err := client.Resource.Create(ctx, plugin1, metav1.CreateOptions{})
		require.NoError(t, err)

		plugin2Name := "test-plugin-metas-2"
		plugin2 := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"id": "grafana-clock-panel", "version": "1.0.0"}
		}`, plugin2Name))
		_, err = client.Resource.Create(ctx, plugin2, metav1.CreateOptions{})
		require.NoError(t, err)

		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/metas", namespace)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.MetaList{})

		require.NotNil(t, response.Result)
		require.NotNil(t, response.Result.Items)
		require.GreaterOrEqual(t, len(response.Result.Items), 2)

		foundIDs := make(map[string]bool)
		for _, item := range response.Result.Items {
			require.NotNil(t, item.Spec.PluginJSON)
			foundIDs[item.Spec.PluginJSON.Id] = true
			require.NotEmpty(t, item.Spec.PluginJSON.Id)
			require.NotEmpty(t, item.Spec.PluginJSON.Type)
			require.NotEmpty(t, item.Spec.PluginJSON.Name)
		}
		require.True(t, foundIDs["grafana-piechart-panel"])
		require.True(t, foundIDs["grafana-clock-panel"])
	})

	t.Run("list plugin metas with no plugins", func(t *testing.T) {
		helper := setupHelper(t)
		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/metas", namespace)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.MetaList{})

		require.NotNil(t, response.Result)
		require.NotNil(t, response.Result.Items)
		require.GreaterOrEqual(t, len(response.Result.Items), 0)
	})

	t.Run("get plugin meta", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPlugins,
		})

		pluginName := "test-plugin-meta"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"id": "grafana-piechart-panel", "version": "1.0.0"}
		}`, pluginName))
		_, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
		require.NoError(t, err)

		namespace := helper.Org1.Admin.Identity.GetNamespace()
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/metas/%s", namespace, pluginName)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.Meta{})

		require.NotNil(t, response.Result)
		require.NotNil(t, response.Result.Spec.PluginJSON)
		require.Equal(t, "grafana-piechart-panel", response.Result.Spec.PluginJSON.Id)
		require.NotEmpty(t, response.Result.Spec.PluginJSON.Name)
		require.NotEmpty(t, response.Result.Spec.PluginJSON.Type)
	})

	t.Run("get plugin meta for non-existent plugin", func(t *testing.T) {
		helper := setupHelper(t)
		namespace := helper.Org1.Admin.Identity.GetNamespace()
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/metas/non-existent-plugin", namespace)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.Meta{})

		require.NotNil(t, response.Status)
		require.Equal(t, int32(404), response.Status.Code)
	})

	t.Run("get plugin meta for plugin with non-existent metadata", func(t *testing.T) {
		helper := setupHelper(t)
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrPlugins,
		})

		pluginName := "test-plugin-meta-not-found"
		plugin := helper.LoadYAMLOrJSON(fmt.Sprintf(`{
			"apiVersion": "plugins.grafana.app/v0alpha1",
			"kind": "Plugin",
			"metadata": {"name": "%s"},
			"spec": {"id": "non-existent-plugin-id", "version": "1.0.0"}
		}`, pluginName))
		_, err := client.Resource.Create(ctx, plugin, metav1.CreateOptions{})
		require.NoError(t, err)

		namespace := helper.Org1.Admin.Identity.GetNamespace()
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/metas/%s", namespace, pluginName)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.Meta{})

		require.NotNil(t, response.Status)
		require.Equal(t, int32(404), response.Status.Code)
	})
}
