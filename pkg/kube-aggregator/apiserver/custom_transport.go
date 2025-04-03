package apiserver

import (
	"crypto/tls"
	"net/http"

	utilnet "k8s.io/apimachinery/pkg/util/net"
)

// CustomTransport type that embeds http.Transport
type CustomTransport struct {
	*http.Transport
}

func NewCustomTransport() *CustomTransport {
	return &CustomTransport{
		Transport: createProxyTransport(),
	}
}

// RoundTrip method to override the default behavior
func (t *CustomTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// set arbitrary headers
	req.Header.Set("Authorization", "Bearer <jwt>")
	return t.Transport.RoundTrip(req)
}

// NOTE: below function imported from https://github.com/kubernetes/kubernetes/blob/master/cmd/kube-apiserver/app/server.go#L197
// createProxyTransport creates the dialer infrastructure to connect to the api servers.
func createProxyTransport() *http.Transport {
	// NOTE: We don't set proxyDialerFn but the below SetTransportDefaults will
	// See https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/util/net/http.go#L109
	var proxyDialerFn utilnet.DialFunc
	// Proxying to services is IP-based... don't expect to be able to verify the hostname
	proxyTLSClientConfig := &tls.Config{InsecureSkipVerify: true}
	proxyTransport := utilnet.SetTransportDefaults(&http.Transport{
		DialContext:     proxyDialerFn,
		TLSClientConfig: proxyTLSClientConfig,
	})
	return proxyTransport
}
