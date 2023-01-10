package httpclientprovider

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/net/proxy"
)

// newSecureSocksProxy takes a http.DefaultTransport and wraps it in a socks5 proxy with TLS
func newSecureSocksProxy(cfg *setting.SecureSocksDSProxySettings, transport *http.Transport) error {
	certPool := x509.NewCertPool()
	for _, rootCAFile := range strings.Split(cfg.RootCA, " ") {
		// nolint:gosec
		// The gosec G304 warning can be ignored because `rootCAFile` comes from config ini.
		pem, err := os.ReadFile(rootCAFile)
		if err != nil {
			return err
		}
		if !certPool.AppendCertsFromPEM(pem) {
			return errors.New("failed to append CA certificate " + rootCAFile)
		}
	}

	cert, err := tls.LoadX509KeyPair(cfg.ClientCert, cfg.ClientKey)
	if err != nil {
		return err
	}

	tlsDialer := &tls.Dialer{
		Config: &tls.Config{
			Certificates: []tls.Certificate{cert},
			ServerName:   cfg.ServerName,
			RootCAs:      certPool,
		},
	}
	dialSocksProxy, err := proxy.SOCKS5("tcp", cfg.ProxyAddress, nil, tlsDialer)
	if err != nil {
		return err
	}

	contextDialer, ok := dialSocksProxy.(proxy.ContextDialer)
	if !ok {
		return errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}

	transport.DialContext = contextDialer.DialContext

	return nil
}

// secureSocksProxyEnabledOnDS checks the datasource json data to see if the secure socks proxy is enabled on it
func secureSocksProxyEnabledOnDS(opts sdkhttpclient.Options) bool {
	jsonData := backend.JSONDataFromHTTPClientOptions(opts)
	res, enabled := jsonData["enableSecureSocksProxy"]
	if !enabled {
		return false
	}

	if val, ok := res.(bool); ok {
		return val
	}

	return false
}
