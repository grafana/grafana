// Package grpctls supplies rotating client certificates for internal gRPC connections.
package grpctls

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"net"
	"time"

	"google.golang.org/grpc/credentials"
)

// UseClientCertificate checks the configured key pair at startup and reloads it for every handshake.
func UseClientCertificate(cfg *tls.Config, certFile, keyFile string) error {
	if _, err := tls.LoadX509KeyPair(certFile, keyFile); err != nil {
		return err
	}
	cfg.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
		cert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			return nil, err
		}
		return &cert, nil
	}
	return nil
}

type rotatingCredentials struct {
	credentials.TransportCredentials
	config *tls.Config
}

// ClientCredentials bounds a connection's lifetime by the certificate it actually presented.
// A fresh RPC after expiry can then handshake with the replacement certificate on disk.
func ClientCredentials(cfg *tls.Config) credentials.TransportCredentials {
	if cfg.GetClientCertificate == nil {
		return credentials.NewTLS(cfg)
	}
	return &rotatingCredentials{credentials.NewTLS(cfg), cfg.Clone()}
}

func (c *rotatingCredentials) OverrideServerName(name string) error {
	c.config.ServerName = name
	return c.TransportCredentials.OverrideServerName(name) //nolint:staticcheck // Required by TransportCredentials.
}
func (c *rotatingCredentials) Clone() credentials.TransportCredentials {
	return ClientCredentials(c.config.Clone())
}

func (c rotatingCredentials) ClientHandshake(ctx context.Context, authority string, raw net.Conn) (net.Conn, credentials.AuthInfo, error) {
	var expiry time.Time
	cfg := c.config.Clone()
	getCert := cfg.GetClientCertificate
	cfg.GetClientCertificate = func(req *tls.CertificateRequestInfo) (*tls.Certificate, error) {
		cert, err := getCert(req)
		if err != nil || cert == nil || len(cert.Certificate) == 0 {
			return cert, err
		}
		leaf := cert.Leaf
		if leaf == nil {
			leaf, err = x509.ParseCertificate(cert.Certificate[0])
			if err != nil {
				return nil, err
			}
		}
		expiry = leaf.NotAfter
		return cert, nil
	}
	conn, info, err := credentials.NewTLS(cfg).ClientHandshake(ctx, authority, raw)
	if err != nil {
		return nil, nil, err
	}
	if !expiry.IsZero() {
		if err := conn.SetDeadline(expiry); err != nil {
			_ = conn.Close()
			return nil, nil, err
		}
	}
	return conn, info, nil
}
