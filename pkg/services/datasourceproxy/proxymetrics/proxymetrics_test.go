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

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
)

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

	m.Observe(Observation{PluginID: "prometheus", Status: 200, Source: SourceServer, Duration: time.Second})
	m.Observe(Observation{PluginID: "prometheus", Status: 200, Source: SourceServer, Duration: time.Second})
	m.Observe(Observation{PluginID: "prometheus", Status: 502, Source: SourceDownstream, Duration: time.Second})
	m.Observe(Observation{Status: 42, Source: "bogus", Duration: time.Millisecond})

	require.Equal(t, 2.0, testutil.ToFloat64(m.requests.WithLabelValues("prometheus", "200", SourceServer)))
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("prometheus", "502", SourceDownstream)))
	require.Equal(t, 1.0, testutil.ToFloat64(m.requests.WithLabelValues("unknown", "0", SourceServer)))

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

func TestMetrics_Logging(t *testing.T) {
	newMetrics := func() (*Metrics, *logtest.Fake) {
		fake := &logtest.Fake{}
		m := New(prometheus.NewPedanticRegistry(), VariantMT)
		m.log = fake
		return m, fake
	}
	obs := Observation{
		PluginID: "prometheus", DatasourceUID: "ds1", Namespace: "stacks-1", Method: http.MethodPost,
		Path: "api/v1/query_range?query=secret_metric", Status: 200, Source: SourceServer,
	}

	t.Run("a datasource failure is always logged, without the query string", func(t *testing.T) {
		m, fake := newMetrics()
		o := obs
		o.Status, o.Source = 502, SourceDownstream
		m.Observe(o)
		require.Equal(t, 1, fake.WarnLogs.Calls)
		require.Contains(t, fake.WarnLogs.Ctx, "datasourceUid")
		require.Contains(t, fake.WarnLogs.Ctx, "api/v1/query_range")
		require.NotContains(t, fmt.Sprint(fake.WarnLogs.Ctx...), "secret_metric")
	})

	t.Run("a Grafana 5xx and a client cancel are logged", func(t *testing.T) {
		m, fake := newMetrics()
		o := obs
		o.Status = 500
		m.Observe(o)
		o.Status, o.Source = 499, SourceClient
		m.Observe(o)
		require.Equal(t, 2, fake.WarnLogs.Calls)
	})

	t.Run("successes and datasource 4xx are only sampled", func(t *testing.T) {
		m, fake := newMetrics()
		o := obs
		for range sampleEvery - 1 {
			m.Observe(o)
		}
		o.Status = 404
		m.Observe(o)
		require.Equal(t, 1, fake.InfoLogs.Calls, "one request in sampleEvery is logged")
		require.Zero(t, fake.WarnLogs.Calls)
	})
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
