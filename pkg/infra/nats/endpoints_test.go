package nats

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestEndpoints(t *testing.T) {
	t.Run("ProvideEndpoints exposes the configured urls", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.NATS = setting.NATSSettings{ClientURLs: []string{"nats://a:4222", "nats://b:4222"}}

		ep := ProvideEndpoints(cfg)

		require.Equal(t, []string{"nats://a:4222", "nats://b:4222"}, ep.URLs())
		require.Empty(t, ep.dialOptions())
	})

	t.Run("no configured urls", func(t *testing.T) {
		ep := newEndpoints(setting.NATSSettings{})
		require.Empty(t, ep.URLs())
		require.Empty(t, ep.dialOptions())
	})

	t.Run("URLs returns a defensive copy", func(t *testing.T) {
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}})

		// Mutating the returned slice must not affect the endpoints' internal state.
		got := ep.URLs()
		got[0] = "nats://tampered:4222"

		require.Equal(t, []string{"nats://a:4222"}, ep.URLs())
	})

	t.Run("decoupled from the config slice", func(t *testing.T) {
		configured := []string{"nats://a:4222"}
		ep := newEndpoints(setting.NATSSettings{ClientURLs: configured})

		// Mutating the original config slice must not leak into the endpoints.
		configured[0] = "nats://tampered:4222"

		require.Equal(t, []string{"nats://a:4222"}, ep.URLs())
	})

	t.Run("dialOptions returns a defensive copy", func(t *testing.T) {
		ep := newEndpoints(setting.NATSSettings{})
		ep.setEmbedded(startTestServer(t), nil)

		opts := ep.dialOptions()
		require.Len(t, opts, 1)

		// Truncating the returned slice must not affect the endpoints' internal state.
		opts = opts[:0]
		require.Len(t, ep.dialOptions(), 1)
	})

	t.Run("setEmbedded prepends the embedded url ahead of peers", func(t *testing.T) {
		srv := startTestServer(t)
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://peer:4222"}})

		ep.setEmbedded(srv, []string{"nats://peer:4222"})

		// The embedded server's local URL is prepended ahead of the configured peers.
		require.Equal(t, []string{srv.ClientURL(), "nats://peer:4222"}, ep.URLs())
		// The in-process dial option is published so the local hop bypasses TCP/TLS.
		require.Len(t, ep.dialOptions(), 1)
	})

	t.Run("setEmbedded without peers", func(t *testing.T) {
		srv := startTestServer(t)
		ep := newEndpoints(setting.NATSSettings{})

		ep.setEmbedded(srv, nil)

		require.Equal(t, []string{srv.ClientURL()}, ep.URLs())
		require.Len(t, ep.dialOptions(), 1)
	})

	t.Run("concurrent access is race-free", func(t *testing.T) {
		srv := startTestServer(t)
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}})

		var wg sync.WaitGroup
		for i := 0; i < 50; i++ {
			wg.Add(3)
			go func() { defer wg.Done(); _ = ep.URLs() }()
			go func() { defer wg.Done(); _ = ep.dialOptions() }()
			go func() { defer wg.Done(); ep.setEmbedded(srv, []string{"nats://a:4222"}) }()
		}
		wg.Wait()

		require.Equal(t, []string{srv.ClientURL(), "nats://a:4222"}, ep.URLs())
		require.Len(t, ep.dialOptions(), 1)
	})
}
