package nats

import (
	"context"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func TestDiscoveryRegisterDiscoverAndCleanup(t *testing.T) {
	db, err := badger.Open(badger.DefaultOptions(t.TempDir()).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	s := &Service{
		cfg: setting.NATSSettings{
			DiscoveryTTL: time.Hour,
		},
		log: log.NewNopLogger(),
		kv:  kv.NewBadgerKV(db),
		opts: &natsserver.Options{
			ServerName: "node-a",
		},
	}

	require.NoError(t, s.register(context.Background(), "nats://127.0.0.1:6222"))

	rec, err := s.readPeer(context.Background(), "node-a")
	require.NoError(t, err)
	require.Equal(t, "node-a", rec.NodeID)
	require.Equal(t, "nats://127.0.0.1:6222", rec.RouteURL)

	routes, err := s.discoverRoutes(context.Background(), "")
	require.NoError(t, err)
	require.Len(t, routes, 1)
	require.Equal(t, "127.0.0.1:6222", routes[0].Host)

	s.cfg.DiscoveryTTL = -time.Second
	require.NoError(t, s.cleanupStalePeers(context.Background()))
	_, err = s.kv.Get(context.Background(), defaultDiscoverySection, "node-a")
	require.ErrorIs(t, err, kv.ErrNotFound)
}
