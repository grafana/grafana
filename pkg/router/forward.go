package router

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

// forwardBackend serves one API group in Forward mode: a reverse proxy to a
// single target service.
type forwardBackend struct {
	group        metav1.APIGroup
	key          string
	routeBackend v1alpha2.RouteBackendSpec

	// the only output of instantiation which is cached
	proxy *httputil.ReverseProxy
}

var _ Backend = &forwardBackend{}

func NewForwardBackend(group metav1.APIGroup, routeBackend v1alpha2.RouteBackendSpec, key string, transport *http.Transport) (Backend, error) {
	if routeBackend.Mode != v1alpha2.RouteBackendSpecModeForward {
		return nil, fmt.Errorf("unsupported route backend mode %q", routeBackend.Mode)
	}

	if transport == nil {
		return nil, fmt.Errorf("transport cannot be nil for a forward backend, group %s", group.Name)
	}

	u, err := url.Parse(routeBackend.Forward.Url)
	if err != nil {
		return nil, fmt.Errorf("error parsing backend url: group=%s, err=%w", group.Name, err)
	}
	// url.Parse accepts empty and relative URLs; reject them when the route is
	// built instead of failing every request later.
	if u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("backend url must be absolute (scheme and host required): group=%s, url=%q", group.Name, routeBackend.Forward.Url)
	}

	return &forwardBackend{
		group:        group,
		routeBackend: routeBackend,
		key:          key,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(u) },
			Transport:      newBackendTransport(transport),
			ModifyResponse: rejectBackendRedirects,
		},
	}, nil
}

func (b *forwardBackend) Group() metav1.APIGroup {
	return b.group
}

func (b *forwardBackend) Key() string {
	return b.key
}

func (b *forwardBackend) Load(ctx context.Context) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		b.proxy.ServeHTTP(w, req)
	}), nil
}
