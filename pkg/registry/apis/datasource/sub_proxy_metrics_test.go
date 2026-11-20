package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestSubProxyREST_RecordsProxyMetrics(t *testing.T) {
	const proxyURL = "/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-ds/proxy/api/v1/query_range"

	type series struct {
		status int
		source string
	}

	captureRequests := func(t *testing.T, builder *DataSourceAPIBuilder) *[]series {
		t.Helper()
		var calls []series
		builder.cfg.RecordProxyRequest = func(_ context.Context, pluginID string, status int, source string) {
			require.Equal(t, "test", pluginID)
			calls = append(calls, series{status, source})
		}
		return &calls
	}

	serve := func(t *testing.T, provider *proxyMockDatasourceProvider, ctx context.Context) ([]series, *resourceMockResponder, *httptest.ResponseRecorder) {
		t.Helper()
		builder := newProxyTestBuilder(provider)
		calls := captureRequests(t, builder)
		r := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		responder := &resourceMockResponder{}
		handler, err := r.Connect(ctx, "test-ds", nil, responder)
		require.NoError(t, err)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, proxyURL, nil))
		return *calls, responder, rec
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

	for _, tc := range []series{{200, "server"}, {404, "server"}, {500, "downstream"}} {
		t.Run(http.StatusText(tc.status), func(t *testing.T) {
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
			}))
			t.Cleanup(target.Close)
			calls, _, rec := serve(t, providerFor(target.URL), proxyTestContext())
			require.Equal(t, tc.status, rec.Code)
			require.Equal(t, []series{tc}, calls)
		})
	}

	t.Run("outer middleware sees the same downstream 503 as the proxy", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
		}))
		defer target.Close()

		ctx := requestmeta.SetRequestMetaData(proxyTestContext(), requestmeta.RequestMetaData{StatusSource: requestmeta.StatusSourceServer})
		calls, _, rec := serve(t, providerFor(target.URL), ctx)

		require.Equal(t, http.StatusServiceUnavailable, rec.Code)
		require.Equal(t, []series{{503, "downstream"}}, calls)
		require.Equal(t, requestmeta.StatusSourceDownstream, requestmeta.GetRequestMetaData(ctx).StatusSource)
	})

	t.Run("an unreachable datasource is downstream", func(t *testing.T) {
		target := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
		url := target.URL
		target.Close()

		calls, _, rec := serve(t, providerFor(url), proxyTestContext())
		require.Equal(t, http.StatusBadGateway, rec.Code)
		require.Equal(t, []series{{502, "downstream"}}, calls)
	})

	t.Run("a missing datasource is a Grafana 404", func(t *testing.T) {
		calls, responder, _ := serve(t, &proxyMockDatasourceProvider{dsErr: datasources.ErrDataSourceNotFound}, proxyTestContext())
		require.Error(t, responder.lastErr)
		require.Equal(t, []series{{404, "server"}}, calls)
	})

	t.Run("a canceled request is the client's, not the datasource's", func(t *testing.T) {
		ctx, cancel := context.WithCancel(proxyTestContext())
		cancel()
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{})
		builder.proxyDependencies = func(context.Context, *http.Request) (*ProxyDependencies, error) {
			return nil, context.Canceled
		}
		calls := captureRequests(t, builder)
		r := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		handler, err := r.Connect(ctx, "test-ds", nil, &resourceMockResponder{})
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, proxyURL, nil))
		require.Equal(t, []series{{499, "client"}}, *calls)
	})

	t.Run("missing proxy configuration is counted once", func(t *testing.T) {
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{})
		builder.proxyDependencies = nil
		calls := captureRequests(t, builder)
		r := &subProxyREST{builder: builder}
		_, err := r.Connect(proxyTestContext(), "test-ds", nil, &resourceMockResponder{})
		require.Error(t, err)
		require.Equal(t, []series{{500, "server"}}, *calls)
	})
}
