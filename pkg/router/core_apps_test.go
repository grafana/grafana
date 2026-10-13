package router

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPluginLoaderServesCoreAppsOnlyInMiddleware(t *testing.T) {
	source := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource { return nil }}
	load := func(t *testing.T, features ...any) []Backend {
		t.Helper()
		loader, err := ProvideRoutesLoader(setting.NewCfg(), PluginLoaderDependencies{
			PluginSources:      source,
			PluginDependencies: PluginDependencies{Features: featuremgmt.WithFeatures(features...)},
		})
		require.NoError(t, err)
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		return backends
	}

	require.Empty(t, load(t), "core apps are intercepted only in middleware mode")

	backends := load(t, featuremgmt.FlagGrafanaUseRouterMiddleware)
	require.Len(t, backends, 1)
	playlist := backends[0]
	require.Equal(t, "playlist.grafana.app", playlist.Group().Name)
	require.Equal(t, "v1", playlist.Group().PreferredVersion.Version)
	require.Equal(t, sourceCoreApp, playlist.Source())
	require.True(t, strings.HasPrefix(playlist.Key(), "coreapp:playlist:"), playlist.Key())
	require.Equal(t, playlist.Key(), load(t, featuremgmt.FlagGrafanaUseRouterMiddleware)[0].Key(),
		"an unchanged core app must keep its key, or every reconcile rebuilds it")
}

func TestCoreAppBackendsSkipInvalidApps(t *testing.T) {
	newApp := func(app.ManifestData) (app.App, error) { return nil, errors.New("not called") }
	backends := coreAppBackends(t.Context(), []coreApp{
		{id: "dashboard", manifest: app.ManifestData{Group: "dashboard.grafana.app",
			Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}, newApp: newApp},
		coreApps()[0],
	}, PluginDependencies{})
	require.Len(t, backends, 1, "a core group outside routableCoreGroups is refused")
	require.Equal(t, "playlist.grafana.app", backends[0].Group().Name)
}

func TestCoreAppPlaylistRunsHooksInProcess(t *testing.T) {
	storage := &manifestKindResourceClient{}
	backends := coreAppBackends(t.Context(), coreApps(), PluginDependencies{
		Unified:        storage,
		TokenExchanger: failingTokenExchanger{},
	})
	require.Len(t, backends, 1)
	handler, err := backends[0].Load(t.Context())
	require.NoError(t, err)
	t.Cleanup(handler.(interface{ Destroy() }).Destroy)

	request := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := newAuthenticatedRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		return res
	}

	// Admission runs on create; a remote client would fail the token exchange.
	res := request(http.MethodPost, "/apis/playlist.grafana.app/v1/namespaces/default/playlists",
		`{"apiVersion":"playlist.grafana.app/v1","kind":"Playlist","metadata":{"name":"example"},"spec":{"title":"Example","interval":"5m","items":[]}}`)
	require.Equal(t, http.StatusCreated, res.Code, res.Body.String())
	require.NotNil(t, storage.created)
	require.Equal(t, "playlists", storage.created.Key.Resource)

	// Reading the stored v1 object through v0alpha1 runs the app's converter.
	res = request(http.MethodGet, "/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists/example", "")
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var got struct {
		APIVersion string `json:"apiVersion"`
		Spec       struct {
			Title string `json:"title"`
		} `json:"spec"`
	}
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &got))
	require.Equal(t, "playlist.grafana.app/v0alpha1", got.APIVersion)
	require.Equal(t, "Example", got.Spec.Title)

	for _, version := range manifestdata.LocalManifest().ManifestData.Versions {
		for _, kind := range version.Kinds {
			require.Nil(t, kind.FolderScoped, "the embedded server's manifest must not change")
		}
	}
}

type failingTokenExchanger struct{}

func (failingTokenExchanger) Exchange(context.Context, authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	return nil, errors.New("in-process core apps must not exchange tokens")
}
