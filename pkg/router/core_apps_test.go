package router

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
)

type fixedLoader struct {
	backends []Backend
	err      error
}

func (s fixedLoader) Load(context.Context) ([]Backend, error) { return s.backends, s.err }

func (fixedLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

type stubClientV3 struct{ appclientv3.Client }

func coreAppFor(group string, client appclientv3.Client) CoreApp {
	return CoreApp{
		PluginID: "grafana-test-app",
		Manifest: &app.ManifestData{AppName: "test", Group: group, Versions: []app.ManifestVersion{{Name: "v1", Served: true}}},
		Client:   client,
	}
}

func TestCoreAppsLoader(t *testing.T) {
	base := fixedLoader{backends: []Backend{&fakeBackend{group: metav1.APIGroup{Name: "other.grafana.app"}, key: "base"}}}

	t.Run("no apps leaves the base loader", func(t *testing.T) {
		require.Equal(t, RoutesLoader(base), newCoreAppsLoader(base, PluginDependencies{}, nil))
	})

	t.Run("serves the apps next to the base groups", func(t *testing.T) {
		loader := newCoreAppsLoader(base, PluginDependencies{}, []CoreApp{
			coreAppFor("collections.grafana.app", stubClientV3{}),
		})
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Len(t, backends, 2)
		require.Equal(t, "other.grafana.app", backends[0].Group().Name)
		require.Equal(t, "collections.grafana.app", backends[1].Group().Name)
		require.Equal(t, sourceCore, backends[1].Source())
	})

	t.Run("a bad app does not keep the others from loading", func(t *testing.T) {
		loader := newCoreAppsLoader(base, PluginDependencies{}, []CoreApp{
			coreAppFor("dashboard.grafana.app", stubClientV3{}), // not a routable group
			coreAppFor("preferences.grafana.app", nil),          // no client
			coreAppFor("preferences.grafana.app", stubClientV3{}),
		})
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Len(t, backends, 2)
		require.Equal(t, "preferences.grafana.app", backends[1].Group().Name)
	})

	t.Run("the base loader's error is returned", func(t *testing.T) {
		boom := errors.New("boom")
		loader := newCoreAppsLoader(fixedLoader{err: boom}, PluginDependencies{}, []CoreApp{coreAppFor("collections.grafana.app", stubClientV3{})})
		_, err := loader.Load(t.Context())
		require.ErrorIs(t, err, boom)
	})
}
