package router

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIsPluginAPIGroup(t *testing.T) {
	for group, want := range map[string]bool{
		"grafana-example-app":      true,
		"example.ext.grafana.app":  true,
		"a.b.ext.grafana.app":      true,
		".ext.grafana.app":         false,
		"dashboard.grafana.app":    false,
		"folder.grafana.app":       false,
		"apps":                     false,
		"example.grafana.app":      false,
		"grafana-example.app":      false,
		"ext.grafana.app":          false,
		"":                         false,
		"apiextensions.k8s.io":     false,
		"grafana-example-app.evil": false,
	} {
		require.Equal(t, want, isPluginAPIGroup(group), group)
	}
}

func TestReconcileSkipsGroupsNotAccepted(t *testing.T) {
	loader := &mutableLoader{backends: []Backend{
		&fakeBackend{group: metav1.APIGroup{Name: "dashboard.grafana.app"}, key: "1"},
		&fakeBackend{group: metav1.APIGroup{Name: "grafana-example-app"}, key: "1"},
	}}
	router := NewGrafanaRouter(loader)
	router.acceptGroup = isPluginAPIGroup
	require.NoError(t, router.reconcile(t.Context()))
	require.False(t, router.KnownGroup("dashboard.grafana.app"))
	require.True(t, router.KnownGroup("grafana-example-app"))
}

func TestReconcileRecoversFromBackendPanic(t *testing.T) {
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{
		panickingBackend{group: "grafana-broken-app"},
		&fakeBackend{group: metav1.APIGroup{Name: "grafana-example-app"}, key: "1"},
	}})
	err := router.reconcile(t.Context())
	require.ErrorContains(t, err, `group "grafana-broken-app"`)
	require.ErrorContains(t, err, "panic: boom")
	require.False(t, router.KnownGroup("grafana-broken-app"))
	require.True(t, router.KnownGroup("grafana-example-app"))
}

func TestMiddlewareServesOnlyPluginGroups(t *testing.T) {
	for _, tc := range []struct {
		name      string
		target    []string
		flags     []any
		restricts bool
	}{
		{name: "middleware", flags: []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, restricts: true},
		{name: "standalone router target", target: []string{"router"}, restricts: false},
		{name: "standalone target with the middleware flag", target: []string{"router"}, flags: []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, restricts: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Target = tc.target
			svc, err := ProvideService(cfg, featuremgmt.WithFeatures(tc.flags...), stubLoader{}, prometheus.NewRegistry())
			require.NoError(t, err)
			require.Equal(t, tc.restricts, svc.router.acceptGroup != nil)
		})
	}
}

func TestNewPluginBackendRejectsNonPluginGroups(t *testing.T) {
	for _, group := range []string{"dashboard.grafana.app", "example.grafana.app"} {
		t.Run(group, func(t *testing.T) {
			plugin := definition.PluginDefinition{
				JSONData: plugins.JSONData{ID: "test-app"},
				Manifest: &app.ManifestData{
					AppName: "test", Group: group,
					Versions: []app.ManifestVersion{{Name: "v1", Served: true}},
				},
			}
			var backend *PluginBackend
			var err error
			require.NotPanics(t, func() { backend, err = NewPluginBackend(plugin, nil, PluginDependencies{}) })
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
func (b panickingBackend) Group() metav1.APIGroup { return metav1.APIGroup{Name: b.group} }
func (b panickingBackend) Load(context.Context) (http.Handler, error) {
	panic(errors.New("boom"))
}
