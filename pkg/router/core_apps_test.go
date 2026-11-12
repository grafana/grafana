package router

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
)

func TestCoreAppPluginID(t *testing.T) {
	require.Equal(t, "grafana-playlist-app", coreAppPluginID("playlist.grafana.app"))
	require.Equal(t, "grafana-advisor-app", coreAppPluginID("advisor.grafana.app"))
}

func TestCoreAppsLoader(t *testing.T) {
	base := noRoutesLoader{}

	t.Run("no apps returns the base loader", func(t *testing.T) {
		require.Equal(t, RoutesLoader(base), newCoreAppsLoader(base, PluginDependencies{}, nil))
	})

	t.Run("serves a group that is not routable for plugins", func(t *testing.T) {
		manifest := &app.ManifestData{
			Group:            "advisor.grafana.app",
			AppName:          "advisor",
			PreferredVersion: "v0alpha1",
			Versions:         []app.ManifestVersion{{Name: "v0alpha1", Served: true}},
		}
		loader := newCoreAppsLoader(base, PluginDependencies{}, []CoreApp{
			{PluginID: "grafana-advisor-app", Manifest: manifest, Client: struct{ appclientv3.Client }{}},
		})
		_, berr := loader.(*coreAppsLoader).backend(loader.(*coreAppsLoader).apps[0])
		require.NoError(t, berr)
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Len(t, backends, 1)
		require.Equal(t, sourceCore, backends[0].Source())
		require.Equal(t, "advisor.grafana.app", backends[0].Group().Name)

		// A plugin may not claim it.
		_, err = newPluginBackend("grafana-advisor-app", manifest, nil, PluginDependencies{}, nil)
		require.Error(t, err)
	})

	t.Run("a core app without a client is skipped", func(t *testing.T) {
		loader := newCoreAppsLoader(base, PluginDependencies{}, []CoreApp{{PluginID: "grafana-x-app"}})
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Empty(t, backends)
	})
}
