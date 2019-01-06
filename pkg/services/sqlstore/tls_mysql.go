package sqlstore

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"io/ioutil"
	"sync"
	"time"
)

type CertReloader struct {
	mu       sync.RWMutex
	certFile string
	keyFile  string
	cert     *tls.Certificate
}

func (c *CertReloader) Reload() error {
	cert, err := tls.LoadX509KeyPair(c.certFile, c.keyFile)
	if err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cert = &cert
	return nil
}

func (c *CertReloader) GetCertificate() *tls.Certificate {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.cert
}

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
		reloader := CertReloader{
			certFile: config.ClientCertPath,
			keyFile:  config.ClientKeyPath,
		}
		if err := reloader.Reload(); err != nil {
			return nil, err
		}
		if config.ClientCertRefreshInterval > 0 {
			log.Info("Reloading mysql client cert every %v", config.ClientCertRefreshInterval)
			go func() {
				for {
					time.Sleep(config.ClientCertRefreshInterval)
					if err := reloader.Reload(); err != nil {
						log.Warn("Failed to reload mysql client cert: %v", err)
					}
				}
			}()
		}
		tlsConfig.GetClientCertificate = func(info *tls.CertificateRequestInfo) (*tls.Certificate, error) {
			return reloader.GetCertificate(), nil
		}
	}
	tlsConfig.ServerName = config.ServerCertName
	if config.SslMode == "skip-verify" {
		tlsConfig.InsecureSkipVerify = true
	}
	// Return more meaningful error before it is too late
	if config.ServerCertName == "" && !tlsConfig.InsecureSkipVerify {
		return nil, fmt.Errorf("server_cert_name is missing. Consider using ssl_mode = skip-verify.")
	}
	return tlsConfig, nil
}
