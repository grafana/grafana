package plugins

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginsIntegrationDiscovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode()

	t.Run("discovery", func(t *testing.T) {
		helper := setupHelper(t)
		disco := helper.GetGroupVersionInfoJSON("plugins.grafana.app")
		require.JSONEq(t, `[
			{
				"version": "v0alpha1",
				"freshness": "Current",
				"resources": [
					{
						"resource": "plugininstalls",
						"responseKind": {
							"group": "",
							"kind": "PluginInstall",
							"version": ""
						},
						"scope": "Namespaced",
						"singularResource": "plugininstalls",
						"subresources": [
							{
								"responseKind": {
									"group": "",
									"kind": "PluginInstall",
									"version": ""
								},
								"subresource": "status",
								"verbs": [
									"get",
									"patch",
									"update"
								]
							}
						],
						"verbs": [
							"create",
							"delete",
							"deletecollection",
							"get",
							"list",
							"patch",
							"update",
							"watch"
						]
					},
					{
						"resource": "pluginmetas",
						"responseKind": {
							"group": "",
							"kind": "PluginMeta",
							"version": ""
						},
						"scope": "Namespaced",
						"singularResource": "pluginmeta",
						"subresources": [
							{
								"responseKind": {
									"group": "",
									"kind": "PluginMeta",
									"version": ""
								},
								"subresource": "status",
								"verbs": [
									"get",
									"patch",
									"update"
								]
							}
						],
						"verbs": [
							"get",
							"list"
						]
					}
				]
			}
		]`, disco)
	})
}
