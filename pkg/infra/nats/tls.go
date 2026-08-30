package nats

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/setting"
)

// buildTLSConfig assembles a *tls.Config from the NATS TLS settings, built
// explicitly so CA, client cert and verification have predictable precedence.
func buildTLSConfig(t setting.NATSTLSSettings) (*tls.Config, error) {
	tc := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		ServerName:         t.ServerName,
		InsecureSkipVerify: t.InsecureSkipVerify, //nolint:gosec // gated by config; documented as test-only
	}

	if t.CACertPath != "" {
		pem, err := os.ReadFile(t.CACertPath)
		if err != nil {
			return nil, fmt.Errorf("read nats tls ca cert: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("no valid certificates found in nats tls ca cert %q", t.CACertPath)
		}
		tc.RootCAs = pool
	}

	// Mutual TLS requires both halves of the key pair.
	if (t.CertPath == "") != (t.KeyPath == "") {
		return nil, fmt.Errorf("nats tls requires both tls_cert_path and tls_key_path, or neither")
	}
	if t.CertPath != "" && t.KeyPath != "" {
		cert, err := tls.LoadX509KeyPair(t.CertPath, t.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("load nats tls client cert: %w", err)
		}
		tc.Certificates = []tls.Certificate{cert}
	}

	return tc, nil
}
