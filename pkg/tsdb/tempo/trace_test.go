package tempo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTempo(t *testing.T) {
	t.Run("createRequest v1 without time range - success", func(t *testing.T) {
		service := &Service{logger: backend.NewLoggerWith("logger", "tempo-test")}
		req, err := service.createRequest(context.Background(), &DatasourceInfo{}, TraceRequestApiVersionV1, "traceID", 0, 0)
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
		assert.Equal(t, "/api/traces/traceID", req.URL.String())
	})

	t.Run("createRequest v1 with time range - success", func(t *testing.T) {
		service := &Service{logger: backend.NewLoggerWith("logger", "tempo-test")}
		req, err := service.createRequest(context.Background(), &DatasourceInfo{}, TraceRequestApiVersionV1, "traceID", 1, 2)
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
		assert.Equal(t, "/api/traces/traceID?start=1&end=2", req.URL.String())
	})

	t.Run("createRequest v2 without time range - success", func(t *testing.T) {
		service := &Service{logger: backend.NewLoggerWith("logger", "tempo-test")}
		req, err := service.createRequest(context.Background(), &DatasourceInfo{}, TraceRequestApiVersionV2, "traceID", 0, 0)
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
		assert.Equal(t, "/api/v2/traces/traceID", req.URL.String())
	})

	t.Run("createRequest v2 with time range - success", func(t *testing.T) {
		service := &Service{logger: backend.NewLoggerWith("logger", "tempo-test")}
		req, err := service.createRequest(context.Background(), &DatasourceInfo{}, TraceRequestApiVersionV2, "traceID", 1, 2)
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
		assert.Equal(t, "/api/v2/traces/traceID?start=1&end=2", req.URL.String())
	})

	t.Run("getTrace v1 empty ResourceSpans returns downstream error", func(t *testing.T) {
		v1Called := false
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.Contains(r.URL.Path, "/api/v2/traces/") {
				w.WriteHeader(http.StatusNotFound) // trigger v1 fallback
			} else if strings.Contains(r.URL.Path, "/api/traces/") {
				v1Called = true
				w.WriteHeader(http.StatusOK) // empty body → empty ResourceSpans → nil frame
			}
		}))
		defer server.Close()

		im := datasource.NewInstanceManager(func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return &DatasourceInfo{URL: server.URL, HTTPClient: server.Client()}, nil
		})

		service := &Service{
			im:     im,
			logger: backend.NewLoggerWith("logger", "tempo-test"),
		}

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{URL: server.URL},
		}
		query := backend.DataQuery{JSON: []byte(`{"query": "abc123"}`)}

		res, err := service.getTrace(context.Background(), pluginCtx, query)

		assert.True(t, v1Called, "expected v1 endpoint (/api/traces/) to be called")
		assert.Nil(t, res)
		require.Error(t, err)
		assert.True(t, backend.IsDownstreamError(err))
	})
}
