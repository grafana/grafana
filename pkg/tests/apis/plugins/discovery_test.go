package plugins

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginsIntegrationDiscovery(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("discovery", func(t *testing.T) {
		helper := setupHelper(t)
		disco, err := helper.GetGroupVersionInfoJSON("plugins.grafana.app")
		require.NoError(t, err)
		require.JSONEq(t, `[
			{
				"version": "v0alpha1",
				"freshness": "Current",
				"resources": [
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
					},
					{
						"resource": "plugins",
						"responseKind": {
							"group": "",
							"kind": "Plugin",
							"version": ""
						},
						"scope": "Namespaced",
						"singularResource": "plugins",
						"subresources": [
							{
								"responseKind": {
									"group": "",
									"kind": "Plugin",
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
					}
				]
			}
		]`, disco)
	})
}
