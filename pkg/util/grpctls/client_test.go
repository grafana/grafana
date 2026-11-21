package grpctls

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// Exercise the actual gRPC handshake and an already-open transport through rotation.
func TestClientCertificateRotation(t *testing.T) {
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	server.EnableHTTP2 = true
	seen := make(chan int64, 2)
	server.TLS = &tls.Config{ClientAuth: tls.RequireAnyClientCert, MinVersion: tls.VersionTLS13, VerifyConnection: func(state tls.ConnectionState) error {
		seen <- state.PeerCertificates[0].SerialNumber.Int64()
		return nil
	}}
	expectSerial := func(want int64) {
		t.Helper()
		select {
		case got := <-seen:
			require.Equal(t, want, got)
		case <-time.After(5 * time.Second):
			t.Fatal("server did not receive the client certificate")
		}
	}
	server.StartTLS()
	defer server.Close()
	roots := x509.NewCertPool()
	roots.AddCert(server.Certificate())
	dir := t.TempDir()
	keyFile, certFile := filepath.Join(dir, "key.pem"), filepath.Join(dir, "cert.pem")
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	keyDER, err := x509.MarshalECPrivateKey(key)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0600))
	issue := func(serial int64, expiry time.Time) {
		cert := &x509.Certificate{SerialNumber: big.NewInt(serial), NotBefore: time.Now().Add(-time.Minute), NotAfter: expiry}
		der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(certFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600))
	}
	issue(1, time.Now().Add(3*time.Second))
	cfg := &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS13}
	require.NoError(t, UseClientCertificate(cfg, certFile, keyFile))
	creds := ClientCredentials(cfg)
	dial := func() net.Conn {
		addr := server.Listener.Addr().String()
		raw, err := net.DialTimeout("tcp", addr, 3*time.Second)
		require.NoError(t, err)
		conn, _, err := creds.ClientHandshake(context.Background(), addr, raw)
		require.NoError(t, err)
		return conn
	}
	first := dial()
	t.Cleanup(func() { _ = first.Close() })
	expectSerial(1)
	guard := time.AfterFunc(8*time.Second, func() { _ = first.Close() })
	defer guard.Stop()
	issue(2, time.Now().Add(time.Hour))
	// The server may send an initial HTTP/2 settings frame before the deadline.
	var buf [128]byte
	for {
		_, err := first.Read(buf[:])
		if err != nil {
			require.ErrorIs(t, err, os.ErrDeadlineExceeded)
			break
		}
	}
	second := dial()
	t.Cleanup(func() { _ = second.Close() })
	expectSerial(2)
	// A bad replacement must fail closed, even after earlier successful handshakes.
	require.NoError(t, os.WriteFile(certFile, []byte("invalid"), 0600))
	addr := server.Listener.Addr().String()
	raw, err := net.DialTimeout("tcp", addr, time.Second)
	require.NoError(t, err)
	t.Cleanup(func() { _ = raw.Close() })
	_, _, err = creds.ClientHandshake(context.Background(), addr, raw)
	require.Error(t, err)
}
