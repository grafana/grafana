package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync/atomic"
)

type tlsCacheKey struct {
	caData   string
	insecure bool
}

type backendConfig struct {
	target   *url.URL
	proxy    *httputil.ReverseProxy
	buildErr error
}

func proxyError(w http.ResponseWriter, req *http.Request, apiServiceName, error string, code int) {
	http.Error(w, error, code)
	// ctx := req.Context()
	// log and observe request termination
}

type backendHandler struct {
	name string
	rt   http.RoundTripper
	cfg  atomic.Pointer[backendConfig]
}

func (bh *backendHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	cfg := bh.cfg.Load()

	if cfg.buildErr != nil {
		proxyError(w, req, bh.name, cfg.buildErr.Error(), http.StatusInternalServerError)
		return // the missing return
	}
	cfg.proxy.ServeHTTP(w, req)
}
