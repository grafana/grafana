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

		ep := ProvideEndpoints(cfg, nil)

		require.Equal(t, []string{"nats://a:4222", "nats://b:4222"}, ep.URLs())
		require.Empty(t, ep.dialOptions())
	})

	t.Run("no configured urls", func(t *testing.T) {
		ep := newEndpoints(setting.NATSSettings{}, nil)
		require.Empty(t, ep.URLs())
		require.Empty(t, ep.dialOptions())
	})

	t.Run("URLs returns a defensive copy", func(t *testing.T) {
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}}, nil)

		// Mutating the returned slice must not affect the endpoints' internal state.
		got := ep.URLs()
		got[0] = "nats://tampered:4222"

		require.Equal(t, []string{"nats://a:4222"}, ep.URLs())
	})

	t.Run("decoupled from the config slice", func(t *testing.T) {
		configured := []string{"nats://a:4222"}
		ep := newEndpoints(setting.NATSSettings{ClientURLs: configured}, nil)

		// Mutating the original config slice must not leak into the endpoints.
		configured[0] = "nats://tampered:4222"

		require.Equal(t, []string{"nats://a:4222"}, ep.URLs())
	})

	t.Run("dialOptions returns a defensive copy", func(t *testing.T) {
		ep := newEndpoints(setting.NATSSettings{}, &Server{server: startTestServer(t)})

		opts := ep.dialOptions()
		require.Len(t, opts, 1)

		// Truncating the returned slice must not affect the endpoints' internal state.
		opts = opts[:0]
		require.Len(t, ep.dialOptions(), 1)
	})

	t.Run("embedded server url is prepended ahead of peers", func(t *testing.T) {
		srv := startTestServer(t)
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://peer:4222"}}, &Server{server: srv})

		// The embedded server's local URL is prepended ahead of the configured peers.
		require.Equal(t, []string{srv.ClientURL(), "nats://peer:4222"}, ep.URLs())
		// The in-process dial option is published so the local hop bypasses TCP/TLS.
		require.Len(t, ep.dialOptions(), 1)
	})

	t.Run("embedded server without peers", func(t *testing.T) {
		srv := startTestServer(t)
		ep := newEndpoints(setting.NATSSettings{}, &Server{server: srv})

		require.Equal(t, []string{srv.ClientURL()}, ep.URLs())
		require.Len(t, ep.dialOptions(), 1)
	})

	t.Run("external mode without an embedded server", func(t *testing.T) {
		// A Server that never started (external mode) exposes no embedded server, so
		// the endpoints fall back to the configured client URLs.
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://peer:4222"}}, &Server{})

		require.Equal(t, []string{"nats://peer:4222"}, ep.URLs())
		require.Empty(t, ep.dialOptions())
	})

	t.Run("concurrent access is race-free", func(t *testing.T) {
		srv := startTestServer(t)
		ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}}, &Server{server: srv})

		var wg sync.WaitGroup
		for i := 0; i < 50; i++ {
			wg.Add(2)
			go func() { defer wg.Done(); _ = ep.URLs() }()
			go func() { defer wg.Done(); _ = ep.dialOptions() }()
		}
		wg.Wait()

		require.Equal(t, []string{srv.ClientURL(), "nats://a:4222"}, ep.URLs())
		require.Len(t, ep.dialOptions(), 1)
	})
}
