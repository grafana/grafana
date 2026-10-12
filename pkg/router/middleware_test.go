package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIsAppPluginID(t *testing.T) {
	for id, want := range map[string]bool{
		"grafana-example-app":      true,
		"example.ext.grafana.app":  false,
		"dashboard.grafana.app":    false,
		"apps":                     false,
		"grafana-example.app":      false,
		"":                         false,
		"grafana-example-app.evil": false,
	} {
		require.Equal(t, want, isAppPluginID(id), id)
	}
}

func TestReconcileRecoversFromBackendPanic(t *testing.T) {
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{
		panickingBackend{group: "grafana-broken-app"},
		&fakeBackend{group: metav1.APIGroup{Name: "grafana-example-app"}, key: "1"},
	}}, nil)
	err := router.reconcile(t.Context())
	require.ErrorContains(t, err, `group "grafana-broken-app"`)
	require.ErrorContains(t, err, "panic: boom")
	require.False(t, router.KnownGroup("grafana-broken-app"))
	require.True(t, router.KnownGroup("grafana-example-app"))
}

// The router gradually takes over groups from the embedded API server, so in
// middleware mode a group it serves replaces the embedded server's, core
// groups included.
func TestMiddlewareReplacesEmbeddedGroups(t *testing.T) {
	served := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	loader := &mutableLoader{backends: []Backend{
		&fakeBackend{group: metav1.APIGroup{Name: "playlist.grafana.app"}, key: "1", handler: served},
	}}
	svc, err := ProvideService(setting.NewCfg(), featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	require.True(t, svc.middleware)
	require.NoError(t, svc.router.reconcile(t.Context()))

	embedded := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	serve := func(target string) int {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{}))
		svc.HandleFunc(recorder, req, embedded)
		return recorder.Code
	}
	require.Equal(t, http.StatusNoContent, serve("/apis/playlist.grafana.app/v0alpha1/namespaces/default/playlists"))
	require.Equal(t, http.StatusTeapot, serve("/apis/dashboard.grafana.app/v1/namespaces/default/dashboards"))
}

func TestNewPluginBackendRejectsInvalidManifestGroups(t *testing.T) {
	for _, group := range []string{"dashboard.grafana.app", "folder.grafana.app"} {
		t.Run(group, func(t *testing.T) {
			plugin := definition.PluginDefinition{
				JSONData: plugins.JSONData{ID: "test-app"},
				Manifests: []*app.ManifestData{{
					AppName: "test", Group: group,
					Versions: []app.ManifestVersion{{Name: "v1", Served: true}},
				}},
			}
			var backend *PluginBackend
			var err error
			require.NotPanics(t, func() { backend, err = testPluginBackend(t, plugin, nil, PluginDependencies{}) })
			require.Error(t, err)
			require.Nil(t, backend)
		})
	}
}

type mutableLoader struct{ backends []Backend }

func (l *mutableLoader) Load(context.Context) ([]Backend, error) { return l.backends, nil }
func (l *mutableLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

type panickingBackend struct{ group string }

func (b panickingBackend) Key() string            { return "1" }
func (b panickingBackend) Source() string         { return "test" }
func (b panickingBackend) Group() metav1.APIGroup { return metav1.APIGroup{Name: b.group} }
func (b panickingBackend) Load(context.Context) (http.Handler, error) {
	panic(errors.New("boom"))
}
