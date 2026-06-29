package nats

import (
	"context"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// newEmbeddedService builds a Service that runs a real embedded NATS server on
// OS-chosen ports, sharing the given KV-backed peer registry for auto-discovery.
func newEmbeddedService(t *testing.T, kvStore kv.KV) *Service {
	t.Helper()
	s := &Service{
		cfg: setting.NATSSettings{
			Enabled:           true,
			Mode:              setting.NATSModeEmbedded,
			Discovery:         "auto",
			ListenAddress:     "127.0.0.1",
			ClientPort:        natsserver.RANDOM_PORT,
			ClusterPort:       natsserver.RANDOM_PORT,
			DiscoveryInterval: 50 * time.Millisecond,
			DiscoveryTTL:      time.Minute,
		},
		log:     log.NewNopLogger(),
		metrics: newMetrics(prometheus.NewRegistry()),
		kv:      kvStore,
	}
	s.bus = newBus(s.cfg, s.log, s.metrics, s.ClientURLs)
	s.opts = s.serverOptions()
	return s
}

// TestIntegrationDiscovery_EmbeddedCluster starts two embedded servers sharing a
// peer registry and asserts they discover each other and form a cluster route.
func TestIntegrationDiscovery_EmbeddedCluster(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	kvStore := testKV(t)

	a := newEmbeddedService(t, kvStore)
	require.NoError(t, a.startEmbeddedServer(ctx))
	t.Cleanup(func() { a.shutdown(context.Background()) })

	b := newEmbeddedService(t, kvStore)
	require.NoError(t, b.startEmbeddedServer(ctx))
	t.Cleanup(func() { b.shutdown(context.Background()) })

	// Each node's discoveryLoop registers itself and reloads the other's route;
	// once the route is solicited both servers report an active cluster peer.
	require.Eventually(t, func() bool {
		return a.server.NumRoutes() >= 1 && b.server.NumRoutes() >= 1
	}, 15*time.Second, 100*time.Millisecond, "embedded servers did not form a cluster route")
}
