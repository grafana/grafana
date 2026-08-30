package nats

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestConfig(t *testing.T) {
	t.Run("ProvideNATSConfig exposes the configured urls", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.NATS = setting.NATSSettings{ClientURLs: []string{"nats://a:4222", "nats://b:4222"}}

		c := ProvideNATSConfig(cfg, nil)

		require.Equal(t, []string{"nats://a:4222", "nats://b:4222"}, c.URLs())
		require.Empty(t, c.DialOptions())
	})

	t.Run("no configured urls", func(t *testing.T) {
		c := newConfig(setting.NATSSettings{}, nil)
		require.Empty(t, c.URLs())
		require.Empty(t, c.DialOptions())
	})

	t.Run("URLs returns a defensive copy", func(t *testing.T) {
		c := newConfig(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}}, nil)

		// Mutating the returned slice must not affect the config's internal state.
		got := c.URLs()
		got[0] = "nats://tampered:4222"

		require.Equal(t, []string{"nats://a:4222"}, c.URLs())
	})

	t.Run("DialOptions returns a defensive copy", func(t *testing.T) {
		c := newConfig(setting.NATSSettings{}, &Server{server: startTestServer(t)})

		opts := c.DialOptions()
		require.Len(t, opts, 1)

		// Mutating the returned slice must not affect the config's internal state.
		opts[0] = nil
		require.NotNil(t, c.DialOptions()[0])
	})

	t.Run("embedded server url is prepended ahead of peers", func(t *testing.T) {
		srv := startTestServer(t)
		c := newConfig(setting.NATSSettings{ClientURLs: []string{"nats://peer:4222"}}, &Server{server: srv})

		// The embedded server's local URL is prepended ahead of the configured peers.
		require.Equal(t, []string{srv.ClientURL(), "nats://peer:4222"}, c.URLs())
		// The in-process dial option is published so the local hop bypasses TCP/TLS.
		require.Len(t, c.DialOptions(), 1)
	})

	t.Run("embedded server without peers", func(t *testing.T) {
		srv := startTestServer(t)
		c := newConfig(setting.NATSSettings{}, &Server{server: srv})

		require.Equal(t, []string{srv.ClientURL()}, c.URLs())
		require.Len(t, c.DialOptions(), 1)
	})

	t.Run("external mode without an embedded server", func(t *testing.T) {
		// A Server that never started (external mode) exposes no embedded server, so
		// the config falls back to the configured client URLs.
		c := newConfig(setting.NATSSettings{ClientURLs: []string{"nats://peer:4222"}}, &Server{})

		require.Equal(t, []string{"nats://peer:4222"}, c.URLs())
		require.Empty(t, c.DialOptions())
	})

	t.Run("concurrent access is race-free", func(t *testing.T) {
		srv := startTestServer(t)
		c := newConfig(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}}, &Server{server: srv})

		var wg sync.WaitGroup
		for i := 0; i < 50; i++ {
			wg.Add(2)
			go func() { defer wg.Done(); _ = c.URLs() }()
			go func() { defer wg.Done(); _ = c.DialOptions() }()
		}
		wg.Wait()

		require.Equal(t, []string{srv.ClientURL(), "nats://a:4222"}, c.URLs())
		require.Len(t, c.DialOptions(), 1)
	})
}
