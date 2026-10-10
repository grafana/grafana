package router

import (
	"context"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/setting"
)

func TestParsePluginGRPCConfig(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(setting.NewCfg())
		require.NoError(t, err)
		require.Equal(t, defaultPluginGRPCConfig(), cfg)
	})

	t.Run("configured", func(t *testing.T) {
		cfg, err := parsePluginGRPCConfig(cfgWithBackendGRPCSection(t, map[string]string{
			"retry_max":     "3",
			"retry_backoff": "1s",
			"retry_jitter":  "0.5",
		}))
		require.NoError(t, err)
		require.Equal(t, pluginGRPCRetryConfig{Max: 3, Backoff: time.Second, Jitter: 0.5}, cfg.Retry)
	})

	for key, value := range map[string]string{
		"retry_max":     "-1",
		"retry_backoff": "soon",
		"retry_jitter":  "1.5",
	} {
		t.Run("invalid "+key, func(t *testing.T) {
			cfg := cfgWithBackendGRPCSection(t, map[string]string{key: value})
			cfg.Raw.Section(cloudRouterSection).Key("plugins_url").SetValue("http://plugins.invalid/plugins")
			_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
			require.ErrorContains(t, err, backendGRPCSection+": "+key+" must be")
		})
	}
}

func cfgWithBackendGRPCSection(t *testing.T, kv map[string]string) *setting.Cfg {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(backendGRPCSection)
	require.NoError(t, err)
	for key, value := range kv {
		_, err := section.NewKey(key, value)
		require.NoError(t, err)
	}
	return cfg
}

func TestPluginGRPCDialOptionsCountRetries(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	health := &flakyHealthServer{}
	pluginv2.RegisterDiagnosticsServer(server, health)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)

	labels := prometheus.Labels{"plugin_id": "test-app"}
	requestDuration := newPluginGRPCRequestDuration(nil, sourcePluginsURL).MustCurryWith(labels).(*prometheus.HistogramVec)
	requestRetries := newPluginGRPCRequestRetries(nil, sourcePluginsURL).MustCurryWith(labels)
	cfg := pluginGRPCConfig{Retry: pluginGRPCRetryConfig{Max: 3, Backoff: time.Millisecond}}
	conn, err := grpc.NewClient(listener.Addr().String(), cfg.dialOptions(requestDuration, requestRetries)...)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	const method = "/pluginv2.Diagnostics/CheckHealth"
	_, err = pluginv2.NewDiagnosticsClient(conn).CheckHealth(t.Context(), &pluginv2.CheckHealthRequest{})
	require.NoError(t, err)
	require.Equal(t, int32(2), health.calls.Load())
	require.Equal(t, 1.0, testutil.ToFloat64(requestRetries.WithLabelValues(method)))
	require.Equal(t, uint64(1), histogramCount(t, requestDuration.WithLabelValues(method, "OK")), "a retried call is recorded once")
}

// flakyHealthServer fails its first call with Unavailable.
type flakyHealthServer struct {
	pluginv2.UnimplementedDiagnosticsServer
	calls atomic.Int32
}

func (s *flakyHealthServer) CheckHealth(context.Context, *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	if s.calls.Add(1) == 1 {
		return nil, status.Error(codes.Unavailable, "not yet")
	}
	return &pluginv2.CheckHealthResponse{Status: pluginv2.CheckHealthResponse_OK}, nil
}
