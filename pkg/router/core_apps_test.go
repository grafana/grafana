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

func TestWithOwnAccessKinds(t *testing.T) {
	manifest := &app.ManifestData{
		Group: "rules.alerting.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v0alpha1", Served: true, Kinds: []app.ManifestVersionKind{
			{Kind: "RuleSequence", Plural: "RuleSequences", Resource: "rulesequences"},
			{Kind: "Other", Plural: "others", Resource: "others"},
		}}},
		ExtraPermissions: &app.Permissions{AccessKinds: []app.KindPermission{
			{Group: "folder.grafana.app", Resource: "folders", Actions: []app.KindPermissionAction{"get"}},
			{Group: "rules.alerting.grafana.app", Resource: "others", Actions: []app.KindPermissionAction{"get"}},
		}},
	}
	got := withOwnAccessKinds(manifest)

	require.ElementsMatch(t, []app.KindPermission{
		{Group: "folder.grafana.app", Resource: "folders", Actions: []app.KindPermissionAction{"get"}},
		{Group: "rules.alerting.grafana.app", Resource: "others", Actions: []app.KindPermissionAction{"get"}},
		{Group: "rules.alerting.grafana.app", Resource: "rulesequences", Actions: ownAccessActions},
	}, got.ExtraPermissions.AccessKinds, "its own kinds are added, and what the manifest asks for is kept")
	require.Len(t, manifest.ExtraPermissions.AccessKinds, 2, "the served manifest is not changed")
}
