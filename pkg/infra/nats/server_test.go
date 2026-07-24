package nats

import (
	"context"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestServer(t *testing.T) {
	t.Run("is disabled when NATS is off", func(t *testing.T) {
		s, _ := newTestServer(t, setting.NATSSettings{Enabled: false})
		require.True(t, s.IsDisabled())
		require.ErrorIs(t, s.Health(context.Background()), ErrDisabled)
	})

	t.Run("external mode runs no embedded server", func(t *testing.T) {
		s, ep := newTestServer(t, setting.NATSSettings{
			Enabled:    true,
			Mode:       setting.NATSModeExternal,
			ClientURLs: []string{"nats://example:4222"},
		})

		// External mode runs no embedded server; the configured URLs reach the broker.
		require.True(t, s.IsDisabled())
		require.Equal(t, []string{"nats://example:4222"}, ep.URLs())
		require.NoError(t, s.Health(context.Background()))
	})

	t.Run("dskit lifecycle is a no-op when disabled", func(t *testing.T) {
		s, _ := newTestServer(t, setting.NATSSettings{Enabled: false})

		ctx := context.Background()
		require.NoError(t, s.StartAsync(ctx))
		require.NoError(t, s.AwaitRunning(ctx))
		require.Equal(t, services.Running, s.State())

		s.StopAsync()
		require.NoError(t, s.AwaitTerminated(ctx))
		require.Equal(t, services.Terminated, s.State())
	})

	t.Run("embedded health fails before start", func(t *testing.T) {
		s, _ := newTestServer(t, setting.NATSSettings{Enabled: true, Mode: setting.NATSModeEmbedded})
		require.False(t, s.IsDisabled())
		// Embedded server has not been started by Run yet.
		require.Error(t, s.Health(context.Background()))
	})
}

func TestIsLoopbackRouteURL(t *testing.T) {
	cases := map[string]bool{
		"nats://127.0.0.1:6222": true,
		"nats://[::1]:6222":     true,
		"nats://10.0.0.5:6222":  false,
		"nats://example:6222":   false, // unresolved hostname is not treated as loopback
		"not a url":             false,
	}
	for routeURL, want := range cases {
		t.Run(routeURL, func(t *testing.T) {
			require.Equal(t, want, isLoopbackRouteURL(routeURL))
		})
	}
}
