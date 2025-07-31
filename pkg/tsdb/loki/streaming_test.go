package loki

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/featuretoggles"
	"github.com/stretchr/testify/require"
)

func TestSubscribeStream(t *testing.T) {
	// Create a service instance with required dependencies
	service := &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpclient.NewProvider())),
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
		cfg := backend.NewGrafanaCfg(map[string]string{
			featuretoggles.EnabledFeatures: flagLokiExperimentalStreaming,
		})
		ctx := backend.WithGrafanaConfig(context.Background(), cfg)

		resp, err := service.SubscribeStream(ctx, req)

		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusOK, resp.Status)
	})
}
