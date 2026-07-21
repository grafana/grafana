package router

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
)

type tlsCacheKey struct {
	caData   string
	insecure bool
}

// forwardBackend serves one API group in Forward mode: a reverse proxy to a
// single target service. It implements Backend. buildBackend captures any
// construction failure in buildErr so a bad config serves a 500 rather than
// failing the whole reconcile; Handler and Ready both surface it.
type forwardBackend struct {
	name     string
	target   *url.URL
	proxy    *httputil.ReverseProxy
	buildErr error
}

// Handler returns the per-request entrypoint for this group. On a build error
// it serves a 500 instead of proxying to a half-built target.
func (b *forwardBackend) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if b.buildErr != nil {
			proxyError(w, req, b.name, b.buildErr.Error(), http.StatusInternalServerError)
			return
		}
		b.proxy.ServeHTTP(w, req)
	})
}

// OpenAPIV3Handler proxies this group's OpenAPI v3 document from its backend.
// The router-level merge across groups lives in BasicRouter.OpenAPIV3Handler.
func (b *forwardBackend) OpenAPIV3Handler() http.Handler {
	return b.Handler()
}

// Ready reports whether this backend was built successfully. It does not probe
// the target; reachability checks belong to a later health surface.
func (b *forwardBackend) Ready(context.Context) error {
	return b.buildErr
}

func proxyError(w http.ResponseWriter, _ *http.Request, _ string, error string, code int) {
	http.Error(w, error, code)
	// TODO: log and observe request termination (group, code).
}
