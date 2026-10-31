package router

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	collectionsmanifest "github.com/grafana/grafana/apps/collections/pkg/apis/manifestdata"
)

// The generated manifests carry deprecated routes, which the router refuses, so
// each is served from a migrated copy.
func TestBuiltinCoreAppManifestsAreServable(t *testing.T) {
	for pluginID, generated := range map[string]*app.ManifestData{
		collectionsPluginID: collectionsmanifest.LocalManifest().ManifestData,
	} {
		t.Run(pluginID, func(t *testing.T) {
			before, err := json.Marshal(generated)
			require.NoError(t, err)

			manifest, err := routerManifest(generated)
			require.NoError(t, err)
			_, err = newPluginBackend(pluginID, manifest, nil, PluginDependencies{}, nil)
			require.NoError(t, err)

			after, err := json.Marshal(generated)
			require.NoError(t, err)
			require.JSONEq(t, string(before), string(after), "the shared generated manifest is left as it is")
		})
	}
}
