package clientmiddleware

import (
	"context"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/prometheus/common/expfmt"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
)

type stubExtraLabels struct {
	names  []string
	values []string
}

func (s stubExtraLabels) Names() []string { return s.names }
func (s stubExtraLabels) Values(context.Context, backend.PluginContext) []string {
	return s.values
}

func TestMetricsMiddlewareExtraLabels(t *testing.T) {
	pCtx := backend.PluginContext{PluginID: pluginID, PluginVersion: "1.0.0"}

	queryDataWith := func(t *testing.T, opts ...MetricsMiddlewareOption) *prometheus.Registry {
		t.Helper()

		promRegistry := prometheus.NewRegistry()
		pluginsRegistry := pluginfakes.NewFakePluginRegistry()
		require.NoError(t, pluginsRegistry.Add(context.Background(), &plugins.Plugin{
			JSONData: plugins.JSONData{ID: pluginID, Backend: true},
		}))

		mw := newMetricsMiddleware(promRegistry, pluginsRegistry, opts...)
		cdt := handlertest.NewHandlerMiddlewareTest(t, handlertest.WithMiddlewares(
			backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
				mw.BaseHandler = backend.NewBaseHandler(next)
				return mw
			}),
		))
		_, err := cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{PluginContext: pCtx})
		require.NoError(t, err)

		return promRegistry
	}

	render := func(t *testing.T, reg *prometheus.Registry, metric string) string {
		t.Helper()

		out, err := testutil.CollectAndFormat(reg, expfmt.TypeTextPlain, metric)
		require.NoError(t, err)
		return string(out)
	}

	t.Run("without a provider the label set is unchanged", func(t *testing.T) {
		got := render(t, queryDataWith(t), metricRequestTotal)

		require.Contains(t, got, metricRequestTotal+"{")
		require.NotContains(t, got, "slug=")
		require.NotContains(t, got, "caller=")
	})

	t.Run("with a provider the values are attached", func(t *testing.T) {
		got := render(t, queryDataWith(t, WithExtraLabels(stubExtraLabels{
			names:  []string{"slug", "caller"},
			values: []string{"some-tenant", "some-service"},
		})), metricRequestTotal)

		require.Contains(t, got, `slug="some-tenant"`)
		require.Contains(t, got, `caller="some-service"`)
	})

	t.Run("unresolved values stay empty so Prometheus drops them", func(t *testing.T) {
		got := render(t, queryDataWith(t, WithExtraLabels(stubExtraLabels{
			names:  []string{"slug", "caller"},
			values: []string{"", ""},
		})), metricRequestTotal)

		require.Contains(t, got, `slug=""`)
		require.Contains(t, got, `caller=""`)
	})

	t.Run("a provider returning too few values cannot panic the request", func(t *testing.T) {
		got := render(t, queryDataWith(t, WithExtraLabels(stubExtraLabels{
			names:  []string{"slug", "caller"},
			values: []string{"some-tenant"},
		})), metricRequestTotal)

		require.Contains(t, got, `slug="some-tenant"`)
		require.Contains(t, got, `caller=""`)
	})

	t.Run("only the counter gains the labels, not the histograms", func(t *testing.T) {
		reg := queryDataWith(t, WithExtraLabels(stubExtraLabels{
			names:  []string{"slug", "caller"},
			values: []string{"some-tenant", "some-service"},
		}))

		for _, metric := range []string{metricRequestDurationMs, metricRequestDurationS, metricRequestSize} {
			got := render(t, reg, metric)
			require.False(t, strings.Contains(got, "slug="),
				"%s must not gain the extra labels:\n%s", metric, got)
		}
	})
}
