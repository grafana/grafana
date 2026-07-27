package rendering

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	utilnet "k8s.io/apimachinery/pkg/util/net"
)

type AuthMiddleware http.RoundTripper // satisfy wire-gen more easily

type InProcRoundTripper struct {
	cfg       setting.Provider
	transport http.RoundTripper
}

var _ AuthMiddleware = &InProcRoundTripper{}

func NewInProcRoundTripper(cfg setting.Provider) (*InProcRoundTripper, error) {
	netTransport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout: 5 * time.Second,
	}

	if caCert := cfg.KeyValue("rendering", "ca_cert_file_path").MustString(""); caCert != "" {
		caCert, err := os.ReadFile(caCert)
		if err != nil {
			return nil, fmt.Errorf("failed to read renderer CA cert file: %w", err)
		}
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse renderer CA cert")
		}
		netTransport.TLSClientConfig = &tls.Config{
			RootCAs: caCertPool,
		}
	}

	return &InProcRoundTripper{
		cfg:       cfg,
		transport: otelhttp.NewTransport(netTransport),
	}, nil
}

func (rt *InProcRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rendererAuthToken := rt.cfg.KeyValue("rendering", "renderer_auth_token").MustString("")

	// Clone the request as RoundTrippers are not expected to mutate the passed request
	req = utilnet.CloneRequest(req)
	req.Header.Set("X-Auth-Token", rendererAuthToken)

	return rt.transport.RoundTrip(req)
}

// use: pkg/clientauth.NewTokenExchangeTransportWrapper!!
type remoteRoundTripper struct {
	transport http.RoundTripper
}

var _ AuthMiddleware = &remoteRoundTripper{}

func NewRemoteRoundTripper(tokenExchanger authnlib.TokenExchanger) (*remoteRoundTripper, error) {
	audienceProvider := clientauth.NewStaticAudienceProvider("grafana")
	namespaceProvider := clientauth.NewStaticNamespaceProvider("*")

	transportWrapper := clientauth.NewTokenExchangeTransportWrapper(
		tokenExchanger,
		audienceProvider,
		namespaceProvider,
	)

	netTransport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		Dial: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout: 5 * time.Second,
	}

	return &remoteRoundTripper{
		transport: transportWrapper(netTransport),
	}, nil
}

func (rt *remoteRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return rt.transport.RoundTrip(req)
}
