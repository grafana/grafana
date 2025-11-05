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
		disco := helper.GetGroupVersionInfoJSON("plugins.grafana.app")
		require.JSONEq(t, `[
			{
				"version": "v0alpha1",
				"freshness": "Current",
				"resources": [
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
									"kind": "ResourceCallOptions",
									"version": ""
								},
								"subresource": "meta",
								"verbs": [
									"get"
								]
							},
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
