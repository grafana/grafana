package nats

import (
	"context"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Disabled(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: false}

	// sqlStore is not touched when disabled, so nil is acceptable here.
	s, err := ProvideService(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	require.True(t, s.IsDisabled())
	require.ErrorIs(t, s.Health(context.Background()), ErrDisabled)
}

func TestService_ExternalModeHealth(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:    true,
		Mode:       setting.NATSModeExternal,
		ClientURLs: []string{"nats://example:4222"},
	}

	s, err := ProvideService(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	require.False(t, s.IsDisabled())
	require.Equal(t, []string{"nats://example:4222"}, s.ClientURLs())
	// External mode is healthy as soon as it has client URLs; no embedded server required.
	require.NoError(t, s.Health(context.Background()))
}

func TestService_DskitLifecycle_Disabled(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: false}

	s, err := ProvideService(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, s.StartAsync(ctx))
	require.NoError(t, s.AwaitRunning(ctx))
	require.Equal(t, services.Running, s.State())

	s.StopAsync()
	require.NoError(t, s.AwaitTerminated(ctx))
	require.Equal(t, services.Terminated, s.State())
}

func TestService_EmbeddedHealthFailsBeforeStart(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded}

	s, err := ProvideService(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	// Embedded server has not been started by Run yet.
	require.Error(t, s.Health(context.Background()))
}
