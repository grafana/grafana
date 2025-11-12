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

		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/plugins/%s/meta", namespace, pluginName)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.GetMeta{})

		require.NotNil(t, response.Result)
		require.Equal(t, "grafana-piechart-panel", response.Result.Id)
		require.NotEmpty(t, response.Result.Name)
		require.NotEmpty(t, response.Result.Type)
	})

	t.Run("get plugin meta for non-existent plugin", func(t *testing.T) {
		helper := setupHelper(t)
		namespace := helper.Org1.Admin.Identity.GetOrgID()
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/plugins/non-existent-plugin/meta", namespace)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.GetMeta{})

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

		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
		path := fmt.Sprintf("/apis/plugins.grafana.app/v0alpha1/namespaces/%s/plugins/%s/meta", namespace, pluginName)
		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, &pluginsv0alpha1.GetMeta{})

		require.NotNil(t, response.Status)
		require.Equal(t, int32(404), response.Status.Code)
	})
}
