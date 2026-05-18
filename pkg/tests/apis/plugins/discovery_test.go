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
						"resource": "apps",
						"responseKind": {
							"group": "",
							"kind": "App",
							"version": ""
						},
						"scope": "Namespaced",
						"singularResource": "app",
						"verbs": [
							"create",
							"delete",
							"get",
							"list",
							"patch",
							"update"
						]
					},
					{
						"resource": "metas",
						"responseKind": {
							"group": "",
							"kind": "Meta",
							"version": ""
						},
						"scope": "Namespaced",
						"singularResource": "meta",
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
						"singularResource": "plugin",
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
