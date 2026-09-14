package router

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestPluginBackendKey(t *testing.T) {
	plugin := definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "test-app", Info: plugins.Info{Version: "1.0.0"}},
		Manifest: &app.ManifestData{
			AppName: "test", Group: "test.ext.grafana.app",
			Versions: []app.ManifestVersion{{Name: "v1alpha1", Served: true}},
		},
	}
	key := func(plugin definition.PluginDefinition) string {
		t.Helper()
		backend, err := NewPluginBackend(plugin, nil, PluginDependencies{})
		require.NoError(t, err)
		return backend.Key()
	}
	original := key(plugin)
	require.Equal(t, original, key(plugin), "unchanged definitions must not reload")

	t.Run("plugin routes", func(t *testing.T) {
		changed := plugin
		changed.JSONData.Routes = []*plugins.Route{{Path: "api", URL: "https://example.com"}}
		require.NotEqual(t, original, key(changed))
	})
	t.Run("settings schema", func(t *testing.T) {
		changed := plugin
		changed.Schemas = map[string]*pluginschema.PluginSchema{"v0alpha1": {
			SettingsSchema: &pluginschema.Settings{SecureValues: []pluginschema.SecureValueInfo{{Key: "token"}}},
		}}
		require.NotEqual(t, original, key(changed))
	})
	t.Run("plugin ID and version boundaries", func(t *testing.T) {
		changed := plugin
		changed.JSONData.ID += "1"
		changed.JSONData.Info.Version = ".0.0"
		require.NotEqual(t, original, key(changed))
	})
}

func TestPluginBackendLoad(t *testing.T) {
	plugin := definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "test-app"},
		Manifest: &app.ManifestData{
			AppName: "test", Group: "test.ext.grafana.app", PreferredVersion: "v1alpha1",
			Versions: []app.ManifestVersion{
				{Name: "v1alpha1", Served: true},
				{Name: "v2alpha1", Served: false},
			},
		},
	}
	t.Run("loads an API handler using the plugin's clients", func(t *testing.T) {
		calls := 0
		backend, err := NewPluginBackend(plugin, func(ctx context.Context, id string) (plugins.Client, v3.ClientV3, error) {
			calls++
			require.Equal(t, plugin.JSONData.ID, id)
			return nil, nil, nil
		}, PluginDependencies{
			Unified:       &resource.MockResourceClient{},
			AccessControl: &actest.FakeAccessControl{ExpectedEvaluate: true},
		})
		require.NoError(t, err)
		require.Zero(t, calls)
		handler, err := backend.Load(t.Context())
		require.NoError(t, err)
		require.Equal(t, 1, calls)
		t.Cleanup(handler.(interface{ Destroy() }).Destroy)
		req := httptest.NewRequest(http.MethodGet, "/apis/"+plugin.Manifest.Group, nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type: claims.TypeUser, OrgID: 1, Namespace: "default",
		}))
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var group metav1.APIGroup
		require.NoError(t, json.Unmarshal(res.Body.Bytes(), &group))
		require.Equal(t, backend.Group().Versions, group.Versions)
		require.Equal(t, backend.Group().PreferredVersion, group.PreferredVersion)
	})
	t.Run("propagates client errors", func(t *testing.T) {
		failure := errors.New("plugin unavailable")
		backend, err := NewPluginBackend(plugin, func(context.Context, string) (plugins.Client, v3.ClientV3, error) {
			return nil, nil, failure
		}, PluginDependencies{})
		require.NoError(t, err)
		handler, err := backend.Load(t.Context())
		require.ErrorIs(t, err, failure)
		require.Nil(t, handler)
	})
}
