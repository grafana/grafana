package router

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

// forwardBackend serves one API group in Forward mode: a reverse proxy to a
// single target service. It implements Backend. buildBackend captures any
// construction failure in buildErr so a bad config serves a 500 rather than
// failing the whole reconcile; Handler and Ready both surface it.
type forwardBackend struct {
	group        string
	manifest     app.ManifestData
	routeBackend v1alpha2.RouteBackendSpec
	rv           string

	// the only output of instantiation which is cached
	proxy *httputil.ReverseProxy
}

var _ Backend = &forwardBackend{}

func NewForwardBackend(manifest app.ManifestData, routeBackend v1alpha2.RouteBackendSpec, rv string, transport *http.Transport) (Backend, error) {
	if routeBackend.Mode != v1alpha2.RouteBackendSpecModeForward {
		return nil, fmt.Errorf("unsupported route backend mode %q", routeBackend.Mode)
	}

	if transport == nil {
		return nil, fmt.Errorf("transport cannot be nil for a forward backend, group %s", manifest.Group)
	}

	u, err := url.Parse(routeBackend.Forward.Url)
	if err != nil {
		return nil, fmt.Errorf("error parsing backend url: group=%s, err=%w", manifest.Group, err)
	}

	return &forwardBackend{
		group:        manifest.Group,
		manifest:     manifest,
		routeBackend: routeBackend,
		rv:           rv,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(u) },
			Transport:      transport,
			ModifyResponse: rejectBackendRedirects,
		},
	}, nil
}

func (b *forwardBackend) Manifest() *app.ManifestData {
	return &b.manifest
}

func (b *forwardBackend) Group() string {
	return b.group
}

func (b *forwardBackend) RV() string {
	return b.rv
}

// if backend does CAP token auth when BaaS comes in, will
func (b *forwardBackend) Load(ctx context.Context) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		b.proxy.ServeHTTP(w, req)
	}), nil
}

func _proxyError(w http.ResponseWriter, _ *http.Request, _ string, error string, code int) {
	http.Error(w, error, code)
	// TODO: log and observe request termination (group, code).
}
