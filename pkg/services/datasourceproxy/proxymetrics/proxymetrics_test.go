package proxymetrics

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/middleware/requestmeta"
)

func TestRouteClass(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"", "/"},
		{"/", "/"},
		{"api/v1/query_range", "/api/v1/query_range"},
		{"/api/v1/query_range?query=up", "/api/v1/query_range"},
		{"api/v1/label/job/values", "/api/v1/label/job"},
		{"apis/apps/v1beta1/things", "/apis/apps/v1beta1/things"},
		{"version/x", "/version/x"},
		{"api/v1/series", "/api/v1/series"},
		{"loki/api/v1/query", "/loki/api/v1/query"},
		{"logs-2026.11.12/_search", "/:id/_search"},
		{"api/datasources/12/query", "/api/datasources/:id"},
		{"a1b2c3d4-0000-4000-8000-000000000000/info", "/:id/info"},
		{"metrics/find", "/metrics/find"},
		{"name%20with%20space/x", "/:id/x"},
		{"averyveryveryveryveryveryverylongsegmentname/x", "/:id/x"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			require.Equal(t, tt.want, RouteClass(tt.path))
		})
	}
}

func TestClassifySource(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		recorded requestmeta.StatusSource
		want     string
	}{
		{"ok", 200, requestmeta.StatusSourceServer, SourceServer},
		{"datasource 4xx", 404, requestmeta.StatusSourceServer, SourceServer},
		{"datasource 500", 500, requestmeta.StatusSourceDownstream, SourceDownstream},
		{"bad gateway", 502, requestmeta.StatusSourceDownstream, SourceDownstream},
		{"gateway timeout", 504, requestmeta.StatusSourceDownstream, SourceDownstream},
		{"grafana 500", 500, requestmeta.StatusSourceServer, SourceServer},
		{"client canceled is not downstream", 499, requestmeta.StatusSourceDownstream, SourceClient},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, ClassifySource(tt.status, tt.recorded))
		})
	}
}

func TestMetrics_Observe(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	m := New(reg, VariantMT)

	m.Observe(Observation{PluginID: "prometheus", Method: http.MethodPost, Path: "api/v1/query_range", Status: 200, Source: SourceServer, Duration: time.Second})
	m.Observe(Observation{PluginID: "prometheus", Method: http.MethodPost, Path: "api/v1/query_range", Status: 200, Source: SourceServer, Duration: time.Second})
	m.Observe(Observation{PluginID: "prometheus", Method: http.MethodPost, Path: "api/v1/query_range", Status: 502, Source: SourceDownstream, Duration: time.Second})
	m.Observe(Observation{Method: "BREW", Path: "x", Status: 42, Source: "bogus", Duration: time.Millisecond})

	require.Equal(t, 2.0, testutil.ToFloat64(m.requests.WithLabelValues("prometheus", "/api/v1/query_range", "POST", "200", SourceServer)))
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("prometheus", "/api/v1/query_range", "POST", "502", SourceDownstream)))
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("unknown", "/x", "other", "0", SourceServer)))

	families, err := reg.Gather()
	require.NoError(t, err)
	for _, f := range families {
		for _, metric := range f.GetMetric() {
			var variant string
			for _, l := range metric.GetLabel() {
				if l.GetName() == "variant" {
					variant = l.GetValue()
				}
			}
			require.Equal(t, VariantMT, variant, f.GetName())
		}
	}
}

func TestMetrics_VariantsShareNamesInOneRegistry(t *testing.T) {
	reg := prometheus.NewPedanticRegistry()
	require.NotPanics(t, func() {
		New(reg, VariantLegacy)
		New(reg, VariantST)
	})
}

func TestMetrics_BoundsRouteClasses(t *testing.T) {
	m := New(prometheus.NewPedanticRegistry(), VariantLegacy)
	m.Observe(Observation{PluginID: "q", Path: "known", Status: 200})
	for i := range maxRouteClassesPerPlugin {
		m.Observe(Observation{PluginID: "p", Path: fmt.Sprintf("r%c%c", 'a'+i%26, 'a'+i/26), Status: 200})
	}
	m.Observe(Observation{PluginID: "p", Path: "overflow", Status: 200})
	m.Observe(Observation{PluginID: "p", Path: "overflow", Status: 200})

	require.Equal(t, 2.0, testutil.ToFloat64(m.requests.WithLabelValues("p", otherRoute, "other", "200", SourceServer)))
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("p", "/raa", "other", "200", SourceServer)),
		"a route seen before the limit keeps its own label")
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("q", "/known", "other", "200", SourceServer)),
		"a plugin at its limit must not affect another plugin")
}

func TestNilMetricsIsNoop(t *testing.T) {
	var m *Metrics
	require.NotPanics(t, func() { m.Observe(Observation{Status: 200}) })
}

func TestStatusRecorder(t *testing.T) {
	t.Run("defaults to 200 when nothing is written", func(t *testing.T) {
		require.Equal(t, http.StatusOK, NewStatusRecorder(httptest.NewRecorder()).Status())
	})

	t.Run("records the first final status", func(t *testing.T) {
		rec := NewStatusRecorder(httptest.NewRecorder())
		rec.WriteHeader(http.StatusBadGateway)
		require.Equal(t, http.StatusBadGateway, rec.Status())
	})

	t.Run("ignores informational statuses", func(t *testing.T) {
		rec := NewStatusRecorder(httptest.NewRecorder())
		rec.WriteHeader(http.StatusContinue)
		rec.WriteHeader(http.StatusTeapot)
		require.Equal(t, http.StatusTeapot, rec.Status())
	})

	t.Run("a body write implies 200", func(t *testing.T) {
		rec := NewStatusRecorder(httptest.NewRecorder())
		_, err := rec.Write([]byte("x"))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, rec.Status())
	})

	t.Run("keeps flushing and unwrapping available to the reverse proxy", func(t *testing.T) {
		inner := httptest.NewRecorder()
		rec := NewStatusRecorder(inner)
		require.NoError(t, http.NewResponseController(rec).Flush())
		require.True(t, inner.Flushed)
		require.Same(t, inner, rec.Unwrap())
	})
}
