package loki

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
)

func TestSubscribeStream(t *testing.T) {
	// Create a service instance with required dependencies
	service := &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpclient.NewProvider(), backend.NewLoggerWith("logger", "loki test"), tracing.DefaultTracer())),
		tracer: tracing.DefaultTracer(),
		logger: backend.NewLoggerWith("logger", "loki test"),
	}

	// Create a test request
	req := &backend.SubscribeStreamRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				ID:   1,
				UID:  "test",
				Type: "loki",
				URL:  "http://localhost:3100",
			},
		},
		Path: "tail/test",
		Data: []byte(`{"expr": "test"}`),
	}

	t.Run("when feature toggle is disabled", func(t *testing.T) {
		// Create a context without the feature toggle enabled
		ctx := context.Background()

		resp, err := service.SubscribeStream(ctx, req)

		require.Error(t, err)
		require.Equal(t, "streaming is not supported", err.Error())
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, resp.Status)
	})

	t.Run("when feature toggle is enabled", func(t *testing.T) {
		// Create a context with the feature toggle enabled
		cfg := config.NewGrafanaCfg(map[string]string{
			featuretoggles.EnabledFeatures: flagLokiExperimentalStreaming,
		})
		ctx := config.WithGrafanaConfig(context.Background(), cfg)

		resp, err := service.SubscribeStream(ctx, req)

		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusOK, resp.Status)
	})

	t.Run("grafana sql payload is rejected when streaming is enabled", func(t *testing.T) {
		cfg := config.NewGrafanaCfg(map[string]string{
			featuretoggles.EnabledFeatures: flagLokiExperimentalStreaming,
		})
		ctx := config.WithGrafanaConfig(context.Background(), cfg)

		grafanaSQLReq := &backend.SubscribeStreamRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID:   1,
					UID:  "test",
					Type: "loki",
					URL:  "http://localhost:3100",
				},
			},
			Path: "tail/test",
			Data: []byte(`{"grafanaSql":true,"table":"svc","refId":"A"}`),
		}

		resp, err := service.SubscribeStream(ctx, grafanaSQLReq)
		require.ErrorIs(t, err, ErrGrafanaSQLStreamingNotSupported)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, resp.Status)
	})
}

func TestRejectGrafanaSQLStreamPayload(t *testing.T) {
	t.Run("allows normal query JSON", func(t *testing.T) {
		require.NoError(t, rejectGrafanaSQLStreamPayload([]byte(`{"expr":"{job=\"x\"}"}`)))
	})
	t.Run("rejects grafana sql envelope", func(t *testing.T) {
		err := rejectGrafanaSQLStreamPayload([]byte(`{"grafanaSql":true,"table":"carts"}`))
		require.ErrorIs(t, err, ErrGrafanaSQLStreamingNotSupported)
	})
	t.Run("malformed JSON passes through", func(t *testing.T) {
		require.NoError(t, rejectGrafanaSQLStreamPayload([]byte(`not json`)))
	})
	t.Run("empty payload passes through", func(t *testing.T) {
		require.NoError(t, rejectGrafanaSQLStreamPayload(nil))
		require.NoError(t, rejectGrafanaSQLStreamPayload([]byte{}))
	})
}
