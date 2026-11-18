package nats

import (
	"bufio"
	"encoding/json"
	"errors"
	"net"
	"strings"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func TestResolveAdvertiseHost(t *testing.T) {
	ifaces := func(ips ...string) func() ([]net.IP, error) {
		return func() ([]net.IP, error) {
			out := make([]net.IP, 0, len(ips))
			for _, ip := range ips {
				out = append(out, net.ParseIP(ip))
			}
			return out, nil
		}
	}
	host := ifaces("fe80::1", "169.254.0.7", "fd00::7", "10.3.0.7", "10.4.0.7")

	cases := []struct {
		name         string
		listen       string
		advertise    string
		interfaceIPs func() ([]net.IP, error)
		wantHost     string
		wantDetected bool
	}{
		{name: "explicit advertise address wins", listen: "0.0.0.0", advertise: "grafana.internal", interfaceIPs: host, wantHost: "grafana.internal"},
		{name: "explicit advertise address drops the port", listen: "0.0.0.0", advertise: "10.9.0.1:7222", interfaceIPs: host, wantHost: "10.9.0.1"},
		{name: "explicit ipv6 advertise address drops brackets", listen: "0.0.0.0", advertise: "[fd00::9]", interfaceIPs: host, wantHost: "fd00::9"},
		{name: "concrete listen address is used as is", listen: "127.0.0.1", interfaceIPs: host, wantHost: "127.0.0.1"},
		{name: "wildcard uses the first ipv4 interface address, skipping link-local and ipv6", listen: "0.0.0.0", interfaceIPs: host, wantHost: "10.3.0.7", wantDetected: true},
		{name: "empty listen address is a wildcard", listen: "", interfaceIPs: host, wantHost: "10.3.0.7", wantDetected: true},
		{name: "ipv6 wildcard is a wildcard", listen: "::", interfaceIPs: host, wantHost: "10.3.0.7", wantDetected: true},
		{name: "no usable interface address yields none", listen: "0.0.0.0", interfaceIPs: ifaces("127.0.0.1", "fe80::1", "fd00::7")},
		{
			name:         "interface listing failure yields none",
			listen:       "0.0.0.0",
			interfaceIPs: func() ([]net.IP, error) { return nil, errors.New("boom") },
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NATSSettings{ListenAddress: tc.listen, AdvertiseAddress: tc.advertise}
			gotHost, gotDetected := resolveAdvertiseHost(cfg, tc.interfaceIPs)
			require.Equal(t, tc.wantHost, gotHost)
			require.Equal(t, tc.wantDetected, gotDetected)
		})
	}
}

func TestClusterAdvertise(t *testing.T) {
	require.Equal(t, "", clusterAdvertise(""))
	require.Equal(t, "10.0.0.1", clusterAdvertise("10.0.0.1"))
	require.Equal(t, "grafana-0", clusterAdvertise("grafana-0"))
	require.Equal(t, "[fd00::1]", clusterAdvertise("fd00::1"))
}

func TestServerClusterAdvertise(t *testing.T) {
	t.Run("route peers and the registry get the configured address and no client urls", func(t *testing.T) {
		s := startSteppedTestServer(t, newEmbeddedTestCfg("127.0.0.1", "10.9.0.1"), newSharedTestKV(t))
		port := clusterPort(t, s)

		// Peers gossip the INFO ip to the rest of the mesh, and would hand
		// connect_urls to their clients.
		info := readPeerRouteInfo(t, net.JoinHostPort("127.0.0.1", port))
		require.Equal(t, "nats-route://10.9.0.1:"+port+"/", info.IP)
		require.Empty(t, info.ConnectURLs)
		require.Equal(t, "nats://10.9.0.1:"+port, registeredRouteURL(t, s))
	})

	t.Run("an ipv6 advertise address is bracketed and carries the bound cluster port", func(t *testing.T) {
		// advertise_address names a host only: its port is dropped for the port the
		// cluster listener actually bound, which is the one peers can dial.
		s := startSteppedTestServer(t, newEmbeddedTestCfg("127.0.0.1", "[fd00::9]:7222"), newSharedTestKV(t))
		port := clusterPort(t, s)
		require.NotEqual(t, "7222", port)

		info := readPeerRouteInfo(t, net.JoinHostPort("127.0.0.1", port))
		require.Equal(t, "nats-route://[fd00::9]:"+port+"/", info.IP)
		require.Equal(t, "nats://[fd00::9]:"+port, registeredRouteURL(t, s))
	})

	t.Run("wildcard listeners cluster over the detected address", func(t *testing.T) {
		// The expectation comes from the host interfaces, not from the resolver.
		var want string
		ips, err := upInterfaceIPs()
		require.NoError(t, err)
		for _, ip := range ips {
			if ip.To4() != nil && ip.IsGlobalUnicast() {
				want = ip.String()
				break
			}
		}
		if want == "" {
			t.Skip("no usable IPv4 interface address on this host")
		}

		store := newSharedTestKV(t)
		a := newKVTestServer(t, newEmbeddedTestCfg("0.0.0.0", ""), store)
		b := newKVTestServer(t, newEmbeddedTestCfg("0.0.0.0", ""), store)
		startService(t, t.Context(), a)
		startService(t, t.Context(), b)

		// Routes are dialed from the registry, so delivery proves the detected
		// address is reachable.
		requireDelivery(t, a, b)
		for _, s := range []*Server{a, b} {
			port := clusterPort(t, s)
			info := readPeerRouteInfo(t, net.JoinHostPort("127.0.0.1", port))
			require.Equal(t, "nats-route://"+want+":"+port+"/", info.IP)
		}
		require.ElementsMatch(t, []peer{
			{ServerName: a.opts.ServerName, RouteURL: "nats://" + want + ":" + clusterPort(t, a)},
			{ServerName: b.opts.ServerName, RouteURL: "nats://" + want + ":" + clusterPort(t, b)},
		}, registeredPeers(t, store))
	})
}

type peerRouteInfo struct {
	IP          string   `json:"ip"`
	ConnectURLs []string `json:"connect_urls"`
}

// readPeerRouteInfo dials the cluster port as a route peer would and decodes the
// INFO the server sends on accept.
func readPeerRouteInfo(t *testing.T, clusterAddr string) peerRouteInfo {
	t.Helper()
	conn, err := net.DialTimeout("tcp", clusterAddr, 5*time.Second)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(5*time.Second)))

	line, err := bufio.NewReader(conn).ReadString('\n')
	require.NoError(t, err)
	payload, ok := strings.CutPrefix(strings.TrimSpace(line), "INFO ")
	require.True(t, ok, "expected INFO, got %q", line)

	var info peerRouteInfo
	require.NoError(t, json.Unmarshal([]byte(payload), &info))
	return info
}

func newEmbeddedTestCfg(listen, advertise string) *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:          true,
		Mode:             setting.NATSModeEmbedded,
		ListenAddress:    listen,
		AdvertiseAddress: advertise,
		ClientPort:       natsserver.RANDOM_PORT,
		ClusterPort:      natsserver.RANDOM_PORT,
		DiscoveryEnabled: true,
		// Short enough for the loop-driven tests, which wait on delivery.
		DiscoveryInterval: 50 * time.Millisecond,
		DiscoveryTTL:      time.Minute,
	}
	return cfg
}

// newKVTestServer builds a server whose discovery registry is store.
func newKVTestServer(t *testing.T, cfg *setting.Cfg, store kv.KV) *Server {
	t.Helper()
	s, err := newServer(cfg.NATS, store, testCredentials(t, store), "", log.New("infra.nats.server"), prometheus.NewRegistry())
	require.NoError(t, err)
	return s
}

// startSteppedTestServer starts the embedded server and registers it once,
// without running the discovery loop.
func startSteppedTestServer(t *testing.T, cfg *setting.Cfg, store kv.KV) *Server {
	t.Helper()
	s := newKVTestServer(t, cfg, store)
	require.NoError(t, s.starting(t.Context()))
	t.Cleanup(func() { _ = s.stopping(nil) })
	s.discovery.tick(t.Context())
	return s
}

func clusterPort(t *testing.T, s *Server) string {
	t.Helper()
	_, port, err := net.SplitHostPort(s.server.ClusterAddr().String())
	require.NoError(t, err)
	return port
}

func registeredRouteURL(t *testing.T, s *Server) string {
	t.Helper()
	// Route reloads replace opts while discovery runs.
	s.mu.RLock()
	name := s.opts.ServerName
	s.mu.RUnlock()
	for _, p := range registeredPeers(t, s.kv) {
		if p.ServerName == name {
			return p.RouteURL
		}
	}
	t.Fatalf("%s is not registered", name)
	return ""
}

// requireDelivery returns once a message published on from reaches a
// subscriber on to. nats-server exposes no event for a route coming up with
// interest propagated, so each attempt is paced by round trips to both servers
// instead of timers; the deadline only guards against a hang.
func requireDelivery(t *testing.T, from, to *Server) {
	t.Helper()
	pub, err := natsclient.Connect(from.clientURL(), from.dialOptions()...)
	require.NoError(t, err)
	t.Cleanup(pub.Close)
	sub, err := natsclient.Connect(to.clientURL(), to.dialOptions()...)
	require.NoError(t, err)
	t.Cleanup(sub.Close)

	subject := "grafana.test.delivery." + randomSuffix()
	received := make(chan struct{}, 1)
	_, err = sub.Subscribe(subject, func(*natsclient.Msg) {
		select {
		case received <- struct{}{}:
		default:
		}
	})
	require.NoError(t, err)
	require.NoError(t, sub.Flush())

	deadline := time.Now().Add(30 * time.Second)
	for {
		require.NoError(t, pub.Publish(subject, nil))
		require.NoError(t, pub.Flush())
		require.NoError(t, sub.Flush())
		select {
		case <-received:
			return
		default:
		}
		if time.Now().After(deadline) {
			t.Fatal("message never reached the peer")
		}
	}
}
