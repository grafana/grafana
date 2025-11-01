package sqlstore

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
)

var tlslog = log.New("tls_mysql")

func makeCert(config *DatabaseConfig) (*tls.Config, error) {
	// Handle skip-verify mode first - no CA cert needed
	if config.SslMode == "skip-verify" {
		tlslog.Info("Using skip-verify mode for MySQL TLS connection")
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true,
		}
		
		// Still allow client certificates if provided
		if config.ClientCertPath != "" && config.ClientKeyPath != "" {
			tlsConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
				tlslog.Debug("Loading client certificate")
				cert, err := tls.LoadX509KeyPair(config.ClientCertPath, config.ClientKeyPath)
				return &cert, err
			}
		}
		
		if config.ServerCertName != "" {
			tlsConfig.ServerName = config.ServerCertName
		}
		
		return tlsConfig, nil
	}
	
	// For non-skip-verify modes, CA cert is required
	if config.CaCertPath == "" {
		return nil, fmt.Errorf("CA cert path is required when ssl_mode=%s", config.SslMode)
	}
	
	rootCertPool := x509.NewCertPool()
	pem, err := os.ReadFile(config.CaCertPath)
	if err != nil {
		return nil, fmt.Errorf("could not read DB CA Cert path %q: %w", config.CaCertPath, err)
	}
	if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
		return nil, fmt.Errorf("failed to append CA certs from PEM")
	}
	
	tlsConfig := &tls.Config{
		RootCAs: rootCertPool,
	}
	
	if config.ClientCertPath != "" && config.ClientKeyPath != "" {
		tlsConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			tlslog.Debug("Loading client certificate")
			cert, err := tls.LoadX509KeyPair(config.ClientCertPath, config.ClientKeyPath)
			return &cert, err
		}
	}
	
	tlsConfig.ServerName = config.ServerCertName
	
	// Return more meaningful error before it is too late
	if config.ServerCertName == "" && !tlsConfig.InsecureSkipVerify {
		return nil, fmt.Errorf("server_cert_name is missing. Consider using ssl_mode = skip-verify")
	}
	
	return tlsConfig, nil
}
