package apis

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const pluginsDiscoveryJSON = `[
{
	"version": "v0alpha1",
	"freshness": "Current",
	"resources": [
		{
			"resource": "metas",
			"responseKind": {
				"group": "",
				"kind": "Meta",
				"version": ""
			},
			"scope": "Namespaced",
			"singularResource": "meta",
			"subresources": [
				{
					"responseKind": {
						"group": "",
						"kind": "Meta",
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
]`

func setupHelper(t *testing.T, openFeatureAPIEnabled bool) *K8sTestHelper {
	t.Helper()
	helper := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:      true,
		DisableAnonymous:       true,
		APIServerRuntimeConfig: "plugins.grafana.app/v0alpha1=true",
		OpenFeatureAPIEnabled:  openFeatureAPIEnabled,
	})
	t.Cleanup(func() { helper.Shutdown() })
	return helper
}

func TestIntegrationAPIServerRuntimeConfig(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("discovery with openfeature api enabled", func(t *testing.T) {
		helper := setupHelper(t, true)
		disco, err := helper.GetGroupVersionInfoJSON("features.grafana.app")
		require.NoError(t, err)
		require.JSONEq(t, `[
              {
                "freshness": "Current",
                "resources": [
                  {
                    "resource": "noop",
                    "responseKind": {
                      "group": "",
                      "kind": "Status",
                      "version": ""
                    },
                    "scope": "Namespaced",
                    "singularResource": "noop",
                    "verbs": [
                      "get"
                    ]
                  }
                ],
                "version": "v0alpha1"
              }
            ]`, disco)

		// plugins should still be discoverable
		disco, err = helper.GetGroupVersionInfoJSON("plugins.grafana.app")
		require.NoError(t, err)
		require.JSONEq(t, pluginsDiscoveryJSON, disco)
		require.NoError(t, err)
	})

	t.Run("discovery with openfeature api false", func(t *testing.T) {
		helper := setupHelper(t, false)
		_, err := helper.GetGroupVersionInfoJSON("features.grafana.app")
		require.Error(t, err, "expected error when openfeature api is disabled")

		// plugins should still be discoverable
		disco, err := helper.GetGroupVersionInfoJSON("plugins.grafana.app")
		require.NoError(t, err)
		require.JSONEq(t, pluginsDiscoveryJSON, disco)
		require.NoError(t, err)
	})
}
