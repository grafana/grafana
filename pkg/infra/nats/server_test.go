package nats

import (
	"context"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func newTestServer(t *testing.T, nats setting.NATSSettings) (*Server, *endpoints) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = nats
	ep := ProvideEndpoints(cfg)
	m := newMetrics(prometheus.NewRegistry())
	// sqlStore is not touched here, so nil is acceptable.
	s, err := ProvideServer(cfg, nil, ep, m)
	require.NoError(t, err)
	return s, ep
}

func TestServer_Disabled(t *testing.T) {
	s, _ := newTestServer(t, setting.NATSSettings{Enabled: false})
	require.True(t, s.IsDisabled())
	require.ErrorIs(t, s.Health(context.Background()), ErrDisabled)
}

func TestServer_ExternalMode(t *testing.T) {
	s, ep := newTestServer(t, setting.NATSSettings{
		Enabled:    true,
		Mode:       setting.NATSModeExternal,
		ClientURLs: []string{"nats://example:4222"},
	})

	// External mode runs no embedded server; the configured URLs reach the broker.
	require.True(t, s.IsDisabled())
	require.Equal(t, []string{"nats://example:4222"}, ep.URLs())
	require.NoError(t, s.Health(context.Background()))
}

func TestServer_DskitLifecycle_Disabled(t *testing.T) {
	s, _ := newTestServer(t, setting.NATSSettings{Enabled: false})

	ctx := context.Background()
	require.NoError(t, s.StartAsync(ctx))
	require.NoError(t, s.AwaitRunning(ctx))
	require.Equal(t, services.Running, s.State())

	s.StopAsync()
	require.NoError(t, s.AwaitTerminated(ctx))
	require.Equal(t, services.Terminated, s.State())
}

func TestServer_EmbeddedHealthFailsBeforeStart(t *testing.T) {
	s, _ := newTestServer(t, setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded})
	require.False(t, s.IsDisabled())
	// Embedded server has not been started by Run yet.
	require.Error(t, s.Health(context.Background()))
}
