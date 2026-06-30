package nats

import (
	"sync"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestEndpoints_ProvideEndpoints(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{ClientURLs: []string{"nats://a:4222", "nats://b:4222"}}

	ep := ProvideEndpoints(cfg)

	require.Equal(t, []string{"nats://a:4222", "nats://b:4222"}, ep.URLs())
	require.Empty(t, ep.dialOptions())
}

func TestEndpoints_NoConfiguredURLs(t *testing.T) {
	ep := newEndpoints(setting.NATSSettings{})
	require.Empty(t, ep.URLs())
	require.Empty(t, ep.dialOptions())
}

func TestEndpoints_URLsReturnsDefensiveCopy(t *testing.T) {
	ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://a:4222"}})

	// Mutating the returned slice must not affect the endpoints' internal state.
	got := ep.URLs()
	got[0] = "nats://tampered:4222"

	require.Equal(t, []string{"nats://a:4222"}, ep.URLs())
}

func TestEndpoints_DecoupledFromConfigSlice(t *testing.T) {
	configured := []string{"nats://a:4222"}
	ep := newEndpoints(setting.NATSSettings{ClientURLs: configured})

	// Mutating the original config slice must not leak into the endpoints.
	configured[0] = "nats://tampered:4222"

	require.Equal(t, []string{"nats://a:4222"}, ep.URLs())
}

func TestEndpoints_DialOptionsReturnsDefensiveCopy(t *testing.T) {
	ep := newEndpoints(setting.NATSSettings{})

	srv := startTestNATSServer(t)
	ep.setEmbedded(srv, nil)

	opts := ep.dialOptions()
	require.Len(t, opts, 1)

	// Truncating the returned slice must not affect the endpoints' internal state.
	opts = opts[:0]
	require.Len(t, ep.dialOptions(), 1)
}

func TestEndpoints_SetEmbedded(t *testing.T) {
	srv := startTestNATSServer(t)
	ep := newEndpoints(setting.NATSSettings{ClientURLs: []string{"nats://peer:4222"}})

	ep.setEmbedded(srv, []string{"nats://peer:4222"})

	// The embedded server's local URL is prepended ahead of the configured peers.
	require.Equal(t, []string{srv.ClientURL(), "nats://peer:4222"}, ep.URLs())
	// The in-process dial option is published so the local hop bypasses TCP/TLS.
	require.Len(t, ep.dialOptions(), 1)
}

func TestEndpoints_SetEmbeddedNoPeers(t *testing.T) {
	srv := startTestNATSServer(t)
	ep := newEndpoints(setting.NATSSettings{})

	ep.setEmbedded(srv, nil)

	require.Equal(t, []string{srv.ClientURL()}, ep.URLs())
	require.Len(t, ep.dialOptions(), 1)
}

func TestEndpoints_ConcurrentAccess(t *testing.T) {
	srv := startTestNATSServer(t)
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
}

// startTestNATSServer spins up an in-process NATS server on a random port and
// tears it down when the test ends.
func startTestNATSServer(t *testing.T) *natsserver.Server {
	t.Helper()
	srv, err := natsserver.NewServer(&natsserver.Options{
		Host:            "127.0.0.1",
		Port:            -1, // random available port
		NoLog:           true,
		NoSigs:          true,
		NoSystemAccount: true,
	})
	require.NoError(t, err)

	srv.Start()
	require.True(t, srv.ReadyForConnections(10*time.Second), "embedded nats server did not become ready")
	t.Cleanup(func() {
		srv.Shutdown()
		srv.WaitForShutdown()
	})
	return srv
}
