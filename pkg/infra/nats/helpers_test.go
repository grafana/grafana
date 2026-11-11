package nats

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-kit/log/level"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// histogramSampleCount reads the number of observations recorded by a single
// histogram (e.g. one label combination of a HistogramVec).
func histogramSampleCount(t *testing.T, h prometheus.Observer) uint64 {
	t.Helper()
	collector, ok := h.(prometheus.Collector)
	require.True(t, ok, "observer is not a collector")

	ch := make(chan prometheus.Metric, 1)
	collector.Collect(ch)
	close(ch)

	var m dto.Metric
	require.NoError(t, (<-ch).Write(&m))
	return m.GetHistogram().GetSampleCount()
}

// startTestServer starts an in-process embedded NATS server (no TCP listener),
// exercising the same in-process path the embedded production mode uses. This
// keeps tests hermetic and free of port-collision flakiness.
func startTestServer(t *testing.T) *natsserver.Server {
	t.Helper()
	srv, err := natsserver.NewServer(&natsserver.Options{
		DontListen:      true, // in-process only
		NoLog:           true,
		NoSigs:          true,
		JetStream:       false,
		NoSystemAccount: true,
	})
	require.NoError(t, err)
	go srv.Start()
	require.True(t, srv.ReadyForConnections(5*time.Second), "test nats server not ready")
	t.Cleanup(srv.Shutdown)
	return srv
}

// newTestConfig wires a shared connection config to the in-process test server,
// mirroring how the Config reads the embedded server from the Server at runtime.
func newTestConfig(srv *natsserver.Server, cfg setting.NATSSettings) *Config {
	return newConfig(cfg, &Server{server: srv})
}

func newTestConnection(t *testing.T, srv *natsserver.Server) *connection {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	c := newConnection(rolePublisher, log.NewNopLogger(), newConnectionMetrics(rolePublisher), newTestConfig(srv, cfg), func() string { return "" })
	t.Cleanup(c.close)
	return c
}

func newTestPublisher(t *testing.T, srv *natsserver.Server) *PublisherService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), newTestConfig(srv, cfg))
	t.Cleanup(p.close)
	require.NoError(t, p.starting(context.Background()))
	return p
}

func newTestSubscriber(t *testing.T, srv *natsserver.Server) *SubscriberService {
	t.Helper()
	cfg := setting.NATSSettings{Enabled: true}
	s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), newTestConfig(srv, cfg))
	t.Cleanup(s.close)
	require.NoError(t, s.starting(context.Background()))
	return s
}

func newTestServer(t *testing.T, nats setting.NATSSettings) (*Server, *Config) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = nats
	// sqlStore is not touched here, so nil is acceptable.
	s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	ep := ProvideNATSConfig(cfg, s)
	return s, ep
}

func startService(t *testing.T, ctx context.Context, svc services.Service) {
	t.Helper()
	require.NoError(t, svc.StartAsync(ctx))
	require.NoError(t, svc.AwaitRunning(ctx))
	t.Cleanup(func() {
		svc.StopAsync()
		_ = svc.AwaitTerminated(context.Background())
	})
}

func newTestClient(t *testing.T, role connRole, cfg *Config) (*connection, services.Service, func() error) {
	t.Helper()
	if role == rolePublisher {
		p := newPublisher(log.NewNopLogger(), newPublisherMetrics(), cfg)
		t.Cleanup(p.close)
		return p.connection, p, func() error { return p.Publish(t.Context(), "test", nil) }
	}
	s := newSubscriber(log.NewNopLogger(), newSubscriberMetrics(), cfg)
	t.Cleanup(s.close)
	return s.connection, s, func() error {
		sub, err := s.Subscribe(t.Context(), "test", func(string, []byte) {})
		if err != nil {
			return err
		}
		return sub.Unsubscribe()
	}
}

func startLifecycleServer(t *testing.T, port int, token string) *natsserver.Server {
	t.Helper()
	srv, err := natsserver.NewServer(&natsserver.Options{Host: "127.0.0.1", Port: port, NoLog: true, NoSigs: true, Authorization: token})
	require.NoError(t, err)
	go srv.Start()
	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
	require.True(t, srv.ReadyForConnections(5*time.Second))
	return srv
}

func newTestBlockedClient(t *testing.T, url string) (*connection, services.Service, *blockingTokenExchanger, func()) {
	t.Helper()
	exchanger := &blockingTokenExchanger{entered: make(chan struct{}), release: make(chan struct{})}
	var once sync.Once
	unblock := func() { once.Do(func() { close(exchanger.release) }) }
	t.Cleanup(unblock)
	cfg := newConfig(setting.NATSSettings{
		Enabled: true, Mode: setting.NATSModeExternal, ClientURLs: []string{url},
		Auth: setting.NATSAuthSettings{Mode: setting.NATSAuthModeTokenExchange},
	}, nil)
	cfg.tokenExchanger = exchanger
	c, svc, _ := newTestClient(t, rolePublisher, cfg)
	return c, svc, exchanger, unblock
}

type blockingTokenExchanger struct {
	entered chan struct{}
	release chan struct{}
	calls   atomic.Int64
}

func (e *blockingTokenExchanger) Exchange(ctx context.Context, _ authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	if e.calls.Add(1) == 1 {
		close(e.entered)
	}
	select {
	case <-e.release:
		return &authnlib.TokenExchangeResponse{Token: "right-token"}, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

type testCA struct {
	cert *x509.Certificate
	key  *ecdsa.PrivateKey
}

func newTestCA(t *testing.T, name string) *testCA {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	tmpl := &x509.Certificate{
		SerialNumber:          randomSerial(t),
		Subject:               pkix.Name{CommonName: name},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	require.NoError(t, err)
	cert, err := x509.ParseCertificate(der)
	require.NoError(t, err)
	return &testCA{cert: cert, key: key}
}

func (ca *testCA) pem() []byte {
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: ca.cert.Raw})
}

func (ca *testCA) pool() *x509.CertPool {
	pool := x509.NewCertPool()
	pool.AddCert(ca.cert)
	return pool
}

// issue signs a leaf for 127.0.0.1 usable as both route server and client.
func (ca *testCA) issue(t *testing.T, name string) tls.Certificate {
	t.Helper()
	return ca.issueWith(t, name, func(*x509.Certificate) {})
}

// issueWith is issue with the template adjusted by edit, e.g. other SANs or validity.
func (ca *testCA) issueWith(t *testing.T, name string, edit func(*x509.Certificate)) tls.Certificate {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	tmpl := &x509.Certificate{
		SerialNumber: randomSerial(t),
		Subject:      pkix.Name{CommonName: name},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	edit(tmpl)
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca.cert, &key.PublicKey, ca.key)
	require.NoError(t, err)
	leaf, err := x509.ParseCertificate(der)
	require.NoError(t, err)
	return tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key, Leaf: leaf}
}

func randomSerial(t *testing.T) *big.Int {
	t.Helper()
	n, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 62))
	require.NoError(t, err)
	return n
}

// writeTestClusterTLS writes a leaf signed by issuer plus a CA bundle of trusted.
func writeTestClusterTLS(t *testing.T, issuer *testCA, trusted ...*testCA) setting.NATSClusterTLSSettings {
	t.Helper()
	dir := t.TempDir()
	cfg := setting.NATSClusterTLSSettings{
		CertPath: filepath.Join(dir, "tls.crt"),
		KeyPath:  filepath.Join(dir, "tls.key"),
		CAPath:   filepath.Join(dir, "ca.crt"),
	}
	writeTestKeyPair(t, cfg, issuer.issue(t, "grafana-nats"))
	var bundle []byte
	for _, ca := range trusted {
		bundle = append(bundle, ca.pem()...)
	}
	writeFileAtomic(t, cfg.CAPath, bundle)
	return cfg
}

func writeTestKeyPair(t *testing.T, cfg setting.NATSClusterTLSSettings, cert tls.Certificate) {
	t.Helper()
	writeFileAtomic(t, cfg.CertPath, certPEM(cert))
	writeFileAtomic(t, cfg.KeyPath, keyPEM(t, cert))
}

func certPEM(cert tls.Certificate) []byte {
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Certificate[0]})
}

func keyPEM(t *testing.T, cert tls.Certificate) []byte {
	t.Helper()
	der, err := x509.MarshalPKCS8PrivateKey(cert.PrivateKey)
	require.NoError(t, err)
	return pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
}

func writeFileAtomic(t *testing.T, path string, data []byte) {
	t.Helper()
	require.NoError(t, replaceFile(path, data))
}

// replaceFile swaps path in one step so the watcher never reads a partial file.
func replaceFile(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil { //nolint:gosec // paths are under t.TempDir()
		return err
	}
	return os.Rename(tmp, path)
}

// hangGuard bounds event waits so a regression fails instead of hanging.
const hangGuard = 15 * time.Second

// logHook is a logger that hands info, warning and error messages to the test,
// prefixed with their level.
type logHook struct {
	log.Logger
	msgs chan string
}

func newLogHook() *logHook {
	return &logHook{Logger: log.NewNopLogger(), msgs: make(chan string, 1024)}
}

func (h *logHook) Info(msg string, _ ...any)  { h.send("info: " + msg) }
func (h *logHook) Warn(msg string, _ ...any)  { h.send("warn: " + msg) }
func (h *logHook) Error(msg string, _ ...any) { h.send("error: " + msg) }

// Log takes the records the embedded server writes directly.
func (h *logHook) Log(keyvals ...any) error {
	var lvl, msg string
	for i := 0; i+1 < len(keyvals); i += 2 {
		switch keyvals[i] {
		case level.Key():
			lvl = fmt.Sprint(keyvals[i+1])
		case "msg":
			msg = fmt.Sprint(keyvals[i+1])
		}
	}
	h.send(lvl + ": " + msg)
	return nil
}

func (h *logHook) send(msg string) {
	select {
	case h.msgs <- msg:
	default:
	}
}

// waitForLog blocks until a message containing substr is logged.
func (h *logHook) waitForLog(t *testing.T, substr string) {
	t.Helper()
	guard := time.After(hangGuard)
	for {
		select {
		case msg := <-h.msgs:
			if strings.Contains(msg, substr) {
				return
			}
		case <-guard:
			t.Fatalf("no log containing %q", substr)
		}
	}
}

// drain returns the messages logged so far.
func (h *logHook) drain() []string {
	var msgs []string
	for {
		select {
		case msg := <-h.msgs:
			msgs = append(msgs, msg)
		default:
			return msgs
		}
	}
}

func connectInProcess(t *testing.T, s *Server) *natsclient.Conn {
	t.Helper()
	nc, err := natsclient.Connect(s.clientURL(), s.dialOptions()...)
	require.NoError(t, err)
	t.Cleanup(nc.Close)
	return nc
}
