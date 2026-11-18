package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/component-base/metrics/legacyregistry"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasourceproxy/proxymetrics"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestProxyVariant(t *testing.T) {
	require.Equal(t, proxymetrics.VariantST, DataSourceAPIBuilderConfig{HandlerOrigin: "local"}.proxyVariant())
	require.Equal(t, proxymetrics.VariantST, DataSourceAPIBuilderConfig{}.proxyVariant())
	require.Equal(t, proxymetrics.VariantMT, DataSourceAPIBuilderConfig{HandlerOrigin: "remote"}.proxyVariant())
}

func TestProxyMetricsForSharesOneSetPerVariant(t *testing.T) {
	require.Same(t, proxyMetricsFor(proxymetrics.VariantMT), proxyMetricsFor(proxymetrics.VariantMT))
	require.NotSame(t, proxyMetricsFor(proxymetrics.VariantMT), proxyMetricsFor(proxymetrics.VariantST))
}

func TestProxyMetricsRegisterWithTheLegacyProxy(t *testing.T) {
	proxyMetricsFor(proxymetrics.VariantMT).Observe(proxymetrics.Observation{PluginID: "registry-test", Status: 200})

	names := func(g prometheus.Gatherer) map[string]bool {
		families, err := g.Gather()
		require.NoError(t, err)
		found := map[string]bool{}
		for _, f := range families {
			found[f.GetName()] = true
		}
		return found
	}
	require.True(t, names(legacyregistry.DefaultGatherer)["grafana_datasource_proxy_requests_total"],
		"the legacy proxy registers on this registry, and a name present in two registries fails the scrape")
	require.False(t, names(prometheus.DefaultGatherer)["grafana_datasource_proxy_requests_total"])
}

func TestSubProxyREST_RecordsProxyMetrics(t *testing.T) {
	const proxyURL = "/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-ds/proxy/api/v1/query_range"

	type series struct {
		status, source string
	}

	serve := func(t *testing.T, provider *proxyMockDatasourceProvider, ctx context.Context) (*prometheus.Registry, *resourceMockResponder, *httptest.ResponseRecorder) {
		t.Helper()
		reg := prometheus.NewPedanticRegistry()
		builder := newProxyTestBuilder(provider)
		builder.proxyMetrics = proxymetrics.New(reg, proxymetrics.VariantST)
		r := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		responder := &resourceMockResponder{}
		handler, err := r.Connect(ctx, "test-ds", nil, responder)
		require.NoError(t, err)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, proxyURL, nil))
		return reg, responder, rec
	}

	providerFor := func(targetURL string) *proxyMockDatasourceProvider {
		ds := &datasourceV0.DataSource{}
		ds.Spec.SetURL(targetURL)
		provider := &proxyMockDatasourceProvider{ds: ds}
		provider.instanceSettings = &backend.DataSourceInstanceSettings{
			UID: "test-ds", Type: "test", URL: targetURL, JSONData: []byte("{}"),
		}
		return provider
	}

	requireSeries := func(t *testing.T, reg *prometheus.Registry, want series) {
		t.Helper()
		families, err := reg.Gather()
		require.NoError(t, err)
		var got []series
		for _, f := range families {
			if f.GetName() != "grafana_datasource_proxy_requests_total" {
				continue
			}
			for _, m := range f.GetMetric() {
				labels := map[string]string{}
				for _, l := range m.GetLabel() {
					labels[l.GetName()] = l.GetValue()
				}
				require.Equal(t, proxymetrics.VariantST, labels["variant"])
				require.Equal(t, "test", labels["plugin_id"])
				got = append(got, series{labels["status_code"], labels["status_source"]})
				require.Equal(t, 1.0, m.GetCounter().GetValue())
			}
		}
		require.Equal(t, []series{want}, got)
	}

	t.Run("a successful request", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) }))
		defer target.Close()

		reg, _, rec := serve(t, providerFor(target.URL), proxyTestContext())
		require.Equal(t, http.StatusOK, rec.Code)
		requireSeries(t, reg, series{"200", proxymetrics.SourceServer})
	})

	t.Run("a datasource 4xx is not a downstream failure", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNotFound) }))
		defer target.Close()

		reg, _, _ := serve(t, providerFor(target.URL), proxyTestContext())
		requireSeries(t, reg, series{"404", proxymetrics.SourceServer})
	})

	t.Run("a datasource 5xx is downstream", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) }))
		defer target.Close()

		reg, _, rec := serve(t, providerFor(target.URL), proxyTestContext())
		require.Equal(t, http.StatusInternalServerError, rec.Code, "the response status is not rewritten")
		requireSeries(t, reg, series{"500", proxymetrics.SourceDownstream})
	})

	t.Run("an unreachable datasource is downstream", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
		url := target.URL
		target.Close()

		reg, _, rec := serve(t, providerFor(url), proxyTestContext())
		require.Equal(t, http.StatusBadGateway, rec.Code)
		requireSeries(t, reg, series{"502", proxymetrics.SourceDownstream})
	})

	t.Run("a missing datasource is a Grafana 404", func(t *testing.T) {
		reg, responder, _ := serve(t, &proxyMockDatasourceProvider{dsErr: datasources.ErrDataSourceNotFound}, proxyTestContext())
		require.Error(t, responder.lastErr)
		requireSeries(t, reg, series{"404", proxymetrics.SourceServer})
	})

	t.Run("a canceled request is the client's, not the datasource's", func(t *testing.T) {
		ctx, cancel := context.WithCancel(proxyTestContext())
		cancel()
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{})
		builder.proxyDependencies = func(context.Context, *http.Request) (*ProxyDependencies, error) {
			return nil, context.Canceled
		}
		reg := prometheus.NewPedanticRegistry()
		builder.proxyMetrics = proxymetrics.New(reg, proxymetrics.VariantST)
		r := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		handler, err := r.Connect(ctx, "test-ds", nil, &resourceMockResponder{})
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, proxyURL, nil))
		requireSeries(t, reg, series{"499", proxymetrics.SourceClient})
	})

	t.Run("records a duration observation with the status class", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusBadGateway) }))
		defer target.Close()

		reg, _, _ := serve(t, providerFor(target.URL), proxyTestContext())
		require.Equal(t, 1, testutil.CollectAndCount(reg, "grafana_datasource_proxy_request_duration_seconds"))
	})
}
