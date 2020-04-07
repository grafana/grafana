package sqlstore

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"

	"github.com/grafana/grafana/pkg/infra/log"
)

var tlslog = log.New("tls_mysql")

func makeCert(config DatabaseConfig) (*tls.Config, error) {
	rootCertPool := x509.NewCertPool()
	pem, err := ioutil.ReadFile(config.CaCertPath)
	if err != nil {
		return nil, fmt.Errorf("Could not read DB CA Cert path: %v", config.CaCertPath)
	}
	if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
		return nil, err
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
	if config.SslMode == "skip-verify" {
		tlsConfig.InsecureSkipVerify = true
	}
	// Return more meaningful error before it is too late
	if config.ServerCertName == "" && !tlsConfig.InsecureSkipVerify {
		return nil, fmt.Errorf("server_cert_name is missing. Consider using ssl_mode = skip-verify")
	}
	return tlsConfig, nil
}
