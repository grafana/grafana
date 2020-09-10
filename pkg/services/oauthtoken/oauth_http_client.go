package oauthtoken

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("oauthtoken")
)

func GetOAuthHttpClient(name string) (*http.Client, error) {
	if setting.OAuthService == nil {
		return nil, fmt.Errorf("OAuth not enabled")
	}
	info, ok := setting.OAuthService.OAuthInfos[name]
	if !ok {
		return nil, fmt.Errorf("Could not find %s in OAuth Settings", name)
	}

	// handle call back
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: info.TlsSkipVerify,
		},
	}
	oauthClient := &http.Client{
		Transport: tr,
	}

	if info.TlsClientCert != "" || info.TlsClientKey != "" {
		cert, err := tls.LoadX509KeyPair(info.TlsClientCert, info.TlsClientKey)
		logger.Error("Failed to setup TlsClientCert", "oauth", name, "error", err)
		if err != nil {
			return nil, fmt.Errorf("Failed to setup TlsClientCert")
		}

		tr.TLSClientConfig.Certificates = append(tr.TLSClientConfig.Certificates, cert)
	}

	if info.TlsClientCa != "" {
		caCert, err := ioutil.ReadFile(info.TlsClientCa)
		if err != nil {
			logger.Error("Failed to setup TlsClientCa", "oauth", name, "error", err)
			return nil, fmt.Errorf("Failed to setup TlsClientCa")
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		tr.TLSClientConfig.RootCAs = caCertPool
	}
	return oauthClient, nil
}
