package nats

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"math/big"
	"net"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-kit/log/level"
	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/term"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
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

func TestServerClosesSilentRoute(t *testing.T) {
	s := startTestTLSServer(t, nil, setting.NATSClusterTLSSettings{})
	peer, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = peer.Close() })

	start := time.Now()
	require.NoError(t, s.setRoutes(natsserver.RoutesFromStr("nats-route://"+peer.Addr().String())))
	conn, err := peer.Accept()
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	// The peer reads but never answers, like a half-dead route. The nats-server
	// defaults would only close it after about a minute.
	require.NoError(t, conn.SetReadDeadline(start.Add(30*time.Second)))
	_, err = io.Copy(io.Discard, conn)
	require.NoError(t, err, "the server should close the silent route")
	require.Less(t, time.Since(start), 20*time.Second)
}

func TestServerClusterTLS(t *testing.T) {
	t.Run("a route forms over mTLS and is advertised as tls", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		store := newSharedTestKV(t)
		a := startTestTLSServer(t, store, writeTestClusterTLS(t, ca, ca))
		b := startTestTLSServer(t, store, writeTestClusterTLS(t, ca, ca))

		requireDelivery(t, a, b)
		require.True(t, strings.HasPrefix(routeURLForServer(a.cfg, a.server), "tls://"))
	})

	t.Run("the cluster port rejects peers without a trusted client certificate", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		s := startTestTLSServer(t, newSharedTestKV(t), writeTestClusterTLS(t, ca, ca))
		addr := s.server.ClusterAddr().String()

		trusted := ca.issue(t, "peer")
		info, err := readRouteInfo(addr, ca.pool(), &trusted)
		require.NoError(t, err)
		require.True(t, strings.HasPrefix(info, "INFO "), "trusted peer should get the route INFO, got %q", info)

		_, err = readRouteInfo(addr, ca.pool(), nil)
		require.ErrorContains(t, err, "certificate required")

		other := newTestCA(t, "other-ca").issue(t, "intruder")
		_, err = readRouteInfo(addr, ca.pool(), &other)
		require.ErrorContains(t, err, "unknown certificate authority")
	})

	t.Run("a peer without cluster tls cannot join", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		store := newSharedTestKV(t)
		hook := newLogHook()
		secured := startTestTLSServerWithLog(t, store, writeTestClusterTLS(t, ca, ca), hook)
		plain := startTestTLSServer(t, store, setting.NATSClusterTLSSettings{})

		hook.waitForLog(t, "TLS route handshake error")
		require.Zero(t, numRoutes(secured))
		require.Zero(t, numRoutes(plain))
	})

	t.Run("a route to a peer whose certificate doesn't match its address is rejected", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		hookA := newLogHook()
		// No discovery: only A dials, so the failure is A verifying B's server certificate.
		a := startTestTLSServerWithLog(t, nil, writeTestClusterTLS(t, ca, ca), hookA)
		tlsB := writeTestClusterTLS(t, ca, ca)
		writeTestKeyPair(t, tlsB, ca.issueWith(t, "elsewhere", func(c *x509.Certificate) {
			c.IPAddresses = []net.IP{net.ParseIP("10.9.9.9")}
		}))
		b := startTestTLSServer(t, nil, tlsB)

		require.NoError(t, a.setRoutes(natsserver.RoutesFromStr(routeURLForServer(b.cfg, b.server))))
		hookA.waitForLog(t, "certificate is valid for 10.9.9.9, not 127.0.0.1")
		require.Zero(t, numRoutes(a))
		require.Zero(t, numRoutes(b))
	})

	t.Run("a peer with an expired certificate cannot join", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		store := newSharedTestKV(t)
		hookA := newLogHook()
		a := startTestTLSServerWithLog(t, store, writeTestClusterTLS(t, ca, ca), hookA)
		tlsB := writeTestClusterTLS(t, ca, ca)
		writeTestKeyPair(t, tlsB, ca.issueWith(t, "expired", func(c *x509.Certificate) {
			c.NotBefore = time.Now().Add(-2 * time.Hour)
			c.NotAfter = time.Now().Add(-time.Hour)
		}))
		b := startTestTLSServer(t, store, tlsB)

		hookA.waitForLog(t, "certificate has expired")
		require.Zero(t, numRoutes(a))
		require.Zero(t, numRoutes(b))
	})

	t.Run("a rotated CA bundle is picked up without a restart", func(t *testing.T) {
		caA := newTestCA(t, "ca-a")
		caB := newTestCA(t, "ca-b")
		store := newSharedTestKV(t)
		tlsA := writeTestClusterTLS(t, caA, caA)
		hookA := newLogHook()
		a := startTestTLSServerWithLog(t, store, tlsA, hookA)
		// B trusts both CAs; A only trusts its own, so it rejects B in both directions.
		b := startTestTLSServer(t, store, writeTestClusterTLS(t, caB, caA, caB))

		hookA.waitForLog(t, "TLS route handshake error")
		require.Zero(t, numRoutes(a))

		writeFileAtomic(t, tlsA.CAPath, append(caA.pem(), caB.pem()...))
		a.clusterTLS.check()

		requireDelivery(t, a, b)
	})

	t.Run("a rotated certificate is served to new connections", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		tlsCfg := writeTestClusterTLS(t, ca, ca)
		s := startTestTLSServer(t, newSharedTestKV(t), tlsCfg)
		addr := s.server.ClusterAddr().String()
		peerCert := ca.issue(t, "peer")

		before := servedLeaf(t, addr, ca.pool(), peerCert)
		rotated := ca.issue(t, "rotated")
		writeTestKeyPair(t, tlsCfg, rotated)
		s.clusterTLS.check()

		served := servedLeaf(t, addr, ca.pool(), peerCert)
		require.NotEqual(t, 0, served.Cmp(before), "server kept serving the old certificate")
		require.Equal(t, 0, served.Cmp(rotated.Leaf.SerialNumber))

		// A later route change from discovery must not revert to the old certificate.
		require.NoError(t, s.setRoutes(nil))
		require.Equal(t, 0, servedLeaf(t, addr, ca.pool(), peerCert).Cmp(rotated.Leaf.SerialNumber))
	})

	t.Run("concurrent route and certificate reloads keep routes, certificate and client restriction", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		tlsA := writeTestClusterTLS(t, ca, ca)
		// No discovery, so only the reloads below set A's routes.
		a := startTestTLSServer(t, nil, tlsA)
		b := startTestTLSServer(t, nil, writeTestClusterTLS(t, ca, ca))
		routeB := natsserver.RoutesFromStr(routeURLForServer(b.cfg, b.server))

		certs := make([]tls.Certificate, 10)
		for i := range certs {
			certs[i] = ca.issue(t, fmt.Sprintf("rotated-%d", i))
		}
		certPEMs, keyPEMs := make([][]byte, len(certs)), make([][]byte, len(certs))
		for i, c := range certs {
			certPEMs[i], keyPEMs[i] = certPEM(c), keyPEM(t, c)
		}

		var wg sync.WaitGroup
		wg.Go(func() {
			for i := range 50 {
				routes := routeB
				if i%2 == 0 {
					routes = nil
				}
				assert.NoError(t, a.setRoutes(routes))
			}
			assert.NoError(t, a.setRoutes(routeB))
		})
		wg.Go(func() {
			for i := range certs {
				assert.NoError(t, replaceFile(tlsA.CertPath, certPEMs[i]))
				assert.NoError(t, replaceFile(tlsA.KeyPath, keyPEMs[i]))
				a.clusterTLS.check()
			}
		})
		wg.Wait()

		last := certs[len(certs)-1].Leaf.SerialNumber
		require.Equal(t, 0, servedLeaf(t, a.server.ClusterAddr().String(), ca.pool(), ca.issue(t, "peer")).Cmp(last))
		requireDelivery(t, a, b)

		// The reloads keep the client port closed to socket clients.
		_, err := natsclient.Connect(a.clientURL(), natsclient.Timeout(2*time.Second))
		require.ErrorIs(t, err, natsclient.ErrAuthorization)
		connectInProcess(t, a)
	})

	t.Run("invalid files keep the current certificates", func(t *testing.T) {
		ca := newTestCA(t, "grafana-nats-ca")
		tlsCfg := writeTestClusterTLS(t, ca, ca)
		s := startTestTLSServer(t, newSharedTestKV(t), tlsCfg)
		addr := s.server.ClusterAddr().String()
		peerCert := ca.issue(t, "peer")
		before := servedLeaf(t, addr, ca.pool(), peerCert)

		// A key that doesn't match the certificate, as seen mid-rotation.
		writeFileAtomic(t, tlsCfg.KeyPath, keyPEM(t, ca.issue(t, "other")))
		s.clusterTLS.check()

		require.Equal(t, 0, servedLeaf(t, addr, ca.pool(), peerCert).Cmp(before))
	})

	t.Run("startup fails on unreadable certificate files", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.NATS = setting.NATSSettings{
			Enabled: true,
			Mode:    setting.NATSModeEmbedded,
			ClusterTLS: setting.NATSClusterTLSSettings{
				CertPath: filepath.Join(t.TempDir(), "missing.crt"),
				KeyPath:  filepath.Join(t.TempDir(), "missing.key"),
				CAPath:   filepath.Join(t.TempDir(), "missing-ca.crt"),
			},
		}
		_, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
		require.ErrorContains(t, err, "read nats cluster tls cert")
	})
}

func TestServerClientPort(t *testing.T) {
	t.Run("the client port is closed by default", func(t *testing.T) {
		// Hold the configured port: the embedded server must start without binding it.
		held, err := net.Listen("tcp", "127.0.0.1:0")
		require.NoError(t, err)
		t.Cleanup(func() { _ = held.Close() })

		s := startTestClientPortServer(t, setting.NATSSettings{
			ListenAddress: "127.0.0.1",
			ClientPort:    held.Addr().(*net.TCPAddr).Port,
		}, nil)
		require.NoError(t, s.Health(t.Context()))

		// The loopback listener nats-server needs for routing rejects socket clients.
		_, err = natsclient.Connect(s.clientURL(), natsclient.Timeout(2*time.Second))
		require.ErrorIs(t, err, natsclient.ErrAuthorization)

		// In-process clients are still accepted.
		connectInProcess(t, s)
	})

	t.Run("client_listen lets socket clients exchange messages on client_listen_address", func(t *testing.T) {
		hook := newLogHook()
		// The cluster port binds every interface; the client port must stay on loopback.
		s := startTestClientPortServer(t, setting.NATSSettings{
			ListenAddress: "0.0.0.0",
			ClientPort:    natsserver.RANDOM_PORT,
			ClientListen:  true,
		}, hook)
		hook.waitForLog(t, "warn: nats client port is open without TLS or authentication")
		require.True(t, s.server.Addr().(*net.TCPAddr).IP.IsLoopback(), "client port bound to %s", s.server.Addr())

		external, err := natsclient.Connect(s.clientURL(), natsclient.Timeout(2*time.Second))
		require.NoError(t, err)
		t.Cleanup(external.Close)

		const subject = "grafana.test.external"
		local := connectInProcess(t, s)
		sub, err := local.SubscribeSync(subject)
		require.NoError(t, err)
		require.NoError(t, local.Flush())

		require.NoError(t, external.Publish(subject, []byte("hello")))
		require.NoError(t, external.Flush())
		msg, err := sub.NextMsg(hangGuard)
		require.NoError(t, err)
		require.Equal(t, []byte("hello"), msg.Data)
	})

	t.Run("client tls settings don't break the in-process connection", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		t.Cleanup(cancel)

		cfg := setting.NewCfg()
		cfg.NATS = setting.NATSSettings{
			Enabled:       true,
			Mode:          setting.NATSModeEmbedded,
			ListenAddress: "127.0.0.1",
			ClientPort:    natsserver.RANDOM_PORT,
			ClusterPort:   natsserver.RANDOM_PORT,
			TLS:           setting.NATSTLSSettings{Enabled: true},
		}
		server, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
		require.NoError(t, err)
		startService(t, ctx, server)

		natsCfg := ProvideNATSConfig(cfg, server)
		pub := ProvidePublisher(natsCfg, prometheus.NewRegistry())
		sub := ProvideSubscriber(natsCfg, prometheus.NewRegistry())
		startService(t, ctx, pub)
		startService(t, ctx, sub)

		// The in-process dial completes before starting returns.
		require.NoError(t, pub.Health(ctx))
		require.NoError(t, sub.Health(ctx))
	})
}

func TestServerLogger(t *testing.T) {
	hook := newLogHook()
	l := serverLogger{log: hook}

	l.Noticef("notice %d", 1)
	l.Debugf("debug %d", 1)
	l.Tracef("trace %d", 1)
	require.Empty(t, hook.drain())

	l.Warnf("route %s", "slow")
	l.Errorf("handshake %s", "failed")
	// Fatalf logs instead of exiting the process.
	l.Fatalf("listen %s", "failed")
	require.Equal(t, []string{"warn: route slow", "error: handshake failed", "error: listen failed"}, hook.drain())

	t.Run("a message is only formatted when its level is written", func(t *testing.T) {
		var out bytes.Buffer
		logger := log.NewNopLogger()
		// The terminal format is the default on a TTY, and the strictest about msg.
		logger.Swap(level.NewFilter(term.NewTerminalLogger(&out), level.AllowError()))
		formatted := 0
		arg := stringerFunc(func() string { formatted++; return "slow" })
		l := serverLogger{log: logger}

		l.Warnf("route %s", arg)
		require.Zero(t, formatted)
		require.Empty(t, out.String())

		l.Errorf("route %s", arg)
		require.Equal(t, 1, formatted)
		require.Contains(t, out.String(), "route slow")
	})
}

type stringerFunc func() string

func (f stringerFunc) String() string { return f() }

// startTestClientPortServer starts an embedded server without discovery from
// the given client settings.
func startTestClientPortServer(t *testing.T, nats setting.NATSSettings, hook *logHook) *Server {
	t.Helper()
	cfg := setting.NewCfg()
	nats.Enabled = true
	nats.Mode = setting.NATSModeEmbedded
	nats.ClusterPort = natsserver.RANDOM_PORT
	cfg.NATS = nats
	s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	if hook != nil {
		s.log = hook
	}
	startService(t, t.Context(), s)
	return s
}

func startTestTLSServer(t *testing.T, store kv.KV, tlsCfg setting.NATSClusterTLSSettings) *Server {
	t.Helper()
	return startTestTLSServerWithLog(t, store, tlsCfg, nil)
}

// startTestTLSServerWithLog starts an embedded server with discovery through
// store, or without discovery for a nil store; an empty tlsCfg runs without
// cluster TLS. Tests drive certificate
// reloads with clusterTLS.check instead of waiting for the watcher.
func startTestTLSServerWithLog(t *testing.T, store kv.KV, tlsCfg setting.NATSClusterTLSSettings, hook *logHook) *Server {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:           true,
		Mode:              setting.NATSModeEmbedded,
		ListenAddress:     "127.0.0.1",
		ClientPort:        natsserver.RANDOM_PORT,
		ClusterPort:       natsserver.RANDOM_PORT,
		DiscoveryEnabled:  store != nil,
		DiscoveryInterval: 50 * time.Millisecond,
		DiscoveryTTL:      time.Minute,
		ClusterTLS:        tlsCfg,
	}
	s, err := newServer(cfg.NATS, store, "", log.New("infra.nats.server"), prometheus.NewRegistry())
	require.NoError(t, err)
	if hook != nil {
		s.log = hook
	}
	if s.clusterTLS != nil {
		s.clusterTLS.interval = time.Hour
	}
	startService(t, t.Context(), s)
	return s
}

// readRouteInfo dials the cluster port like a peer and returns the first line
// the server sends. The route INFO is only sent after the TLS handshake.
func readRouteInfo(addr string, roots *x509.CertPool, cert *tls.Certificate) (string, error) {
	tc := &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: roots, ServerName: "127.0.0.1"}
	if cert != nil {
		// Present the certificate even when the server doesn't list its CA as acceptable.
		tc.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) { return cert, nil }
	}
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: hangGuard}, "tcp", addr, tc)
	if err != nil {
		return "", err
	}
	defer func() { _ = conn.Close() }()
	// TLS 1.3 reports a rejected client certificate on the first read.
	_ = conn.SetReadDeadline(time.Now().Add(hangGuard))
	return bufio.NewReader(conn).ReadString('\n')
}

// servedLeaf returns the serial number of the certificate the cluster port presents.
func servedLeaf(t *testing.T, addr string, roots *x509.CertPool, cert tls.Certificate) *big.Int {
	t.Helper()
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: hangGuard}, "tcp", addr, &tls.Config{
		MinVersion:   tls.VersionTLS12,
		RootCAs:      roots,
		ServerName:   "127.0.0.1",
		Certificates: []tls.Certificate{cert},
	})
	require.NoError(t, err)
	defer func() { _ = conn.Close() }()
	return conn.ConnectionState().PeerCertificates[0].SerialNumber
}
