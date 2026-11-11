package testinfra

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	infranats "github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
)

// GrafanaCluster starts Grafana servers on one database, like the instances of
// an HA cluster. The first node sets up the database and later nodes join it, so
// their writes and peer rows are visible to each other. The servers run in this
// test process and share its globals.
type GrafanaCluster struct {
	t     *testing.T
	nodes int
}

// ClusterNode is one Grafana server started by GrafanaCluster.StartNode.
type ClusterNode struct {
	Addr string
	Env  *server.TestEnv

	stopOnce sync.Once
	stop     func()
}

// Stop shuts the server down, as a graceful shutdown of one HA instance. Later
// calls are no-ops.
func (n *ClusterNode) Stop() {
	n.stopOnce.Do(n.stop)
}

// testDBPeer makes the SQLStore join the test database instead of resetting it.
type testDBPeer struct {
	*testing.T
}

func (testDBPeer) TestDBPeer() {}

// NewGrafanaCluster skips on SQLite, which can't be shared between servers.
func NewGrafanaCluster(t *testing.T) *GrafanaCluster {
	t.Helper()
	if db.IsTestDbSQLite() {
		t.Skip("a Grafana cluster needs a shared server database: run with GRAFANA_TEST_DB=mysql or postgres")
	}
	return &GrafanaCluster{t: t}
}

// StartNode starts the next server. Nodes start one at a time so a test can
// prepare each before the next one joins.
func (c *GrafanaCluster) StartNode(opts GrafanaOpts) *ClusterNode {
	t := c.t
	t.Helper()
	dir, cfgPath := CreateGrafDir(t, opts)
	var testDBT sqlutil.ITestDB = t
	if c.nodes > 0 {
		testDBT = testDBPeer{T: t}
	}
	addr, env, testDB, stop := startGrafana(t, testDBT, dir, cfgPath)
	if c.nodes == 0 {
		t.Cleanup(testDB.Cleanup)
	}
	c.nodes++
	node := &ClusterNode{Addr: addr, Env: env, stop: stop}
	t.Cleanup(node.Stop)
	return node
}

// ConnectNATS dials the server's embedded NATS in-process, the way Grafana's own
// clients do, so it doesn't depend on the client port being open.
func ConnectNATS(t *testing.T, env *server.TestEnv) *natsclient.Conn {
	t.Helper()
	EmbeddedNATSServer(t, env)
	nc, err := natsclient.Connect(strings.Join(env.NATSConfig.URLs(), ","), env.NATSConfig.DialOptions()...)
	require.NoError(t, err)
	t.Cleanup(nc.Close)
	return nc
}

// EmbeddedNATSServer waits for the server's embedded NATS server to start and
// returns it, taken from the in-process dial option, so a test can inspect its
// routes (Routez, Varz).
func EmbeddedNATSServer(t *testing.T, env *server.TestEnv) *natsserver.Server {
	t.Helper()
	require.NotNil(t, env.NATSConfig)
	require.True(t, env.Cfg.NATS.Enabled && env.Cfg.NATS.Embedded(), "[nats] is not enabled in embedded mode")
	// The embedded server is a background service, so it can start after the
	// HTTP health check passes. Grafana's own subscriber waits for it before it
	// dials, so starting one is the wait. The timeout only guards against a hang.
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	sub := infranats.ProvideSubscriber(env.NATSConfig, prometheus.NewRegistry())
	require.NoError(t, services.StartAndAwaitRunning(ctx, sub), "embedded NATS server did not start")
	require.NoError(t, services.StopAndAwaitTerminated(context.Background(), sub))

	var o natsclient.Options
	for _, opt := range env.NATSConfig.DialOptions() {
		require.NoError(t, opt(&o))
	}
	srv, ok := o.InProcessServer.(*natsserver.Server)
	require.True(t, ok, "embedded NATS server has no in-process dial option")
	return srv
}
