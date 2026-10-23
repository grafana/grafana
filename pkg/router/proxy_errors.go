package router

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// backendResponseHeaderTimeout bounds how long a proxy waits for a backend's
// response headers, so a backend that accepts connections but never answers
// fails and trips its breaker. It bounds only the headers: a watch gets its
// headers as soon as it starts and then streams for as long as it lasts.
const backendResponseHeaderTimeout = 60 * time.Second

// streamingFlushInterval makes every proxy flush after each write, so a watch
// event reaches the client at once. Without it, ReverseProxy flushes that way
// only for responses without a Content-Length.
const streamingFlushInterval = -1

// proxyBuffers is every proxy's copy buffer pool, so a proxied request
// doesn't allocate its own 32 KiB buffer. A watch holds one buffer for as
// long as it streams, and returns it when it ends.
var proxyBuffers = &proxyBufferPool{pool: sync.Pool{New: func() any {
	buf := make([]byte, 32<<10)
	return &buf
}}}

type proxyBufferPool struct{ pool sync.Pool }

func (p *proxyBufferPool) Get() []byte { return *p.pool.Get().(*[]byte) }

func (p *proxyBufferPool) Put(buf []byte) { p.pool.Put(&buf) }

// errBackendRedirect marks a backend response the router refused to relay.
// It is a policy decision, not evidence that the backend is unhealthy.
var errBackendRedirect = errors.New("router: backend redirect rejected")

type proxyFailureKey struct{}

// proxyFailure records why a proxy could not relay a backend response, so the
// breaker classifies the failure itself rather than inferring it from a 502.
type proxyFailure struct{ err error }

func withProxyFailure(req *http.Request) (*http.Request, *proxyFailure) {
	failure := &proxyFailure{}
	return req.WithContext(context.WithValue(req.Context(), proxyFailureKey{}, failure)), failure
}

// proxyErrorHandler is the ReverseProxy ErrorHandler for every proxy. It
// records the failure for the breaker and answers 504 for a timeout and 502
// otherwise, as the default handler does.
func proxyErrorHandler(w http.ResponseWriter, req *http.Request, err error) {
	if failure, ok := req.Context().Value(proxyFailureKey{}).(*proxyFailure); ok {
		failure.err = err
	}
	status := http.StatusBadGateway
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		status = http.StatusGatewayTimeout
	}
	if req.Context().Err() == nil {
		logging.FromContext(req.Context()).Warn("router: proxy request failed", "path", req.URL.Path, "status", status, "err", err)
	}
	w.WriteHeader(status)
}

// canonicalAPIPath reports whether an /apis or /openapi/v3 path can be routed
// as sent: no empty, "." or ".." segments, and no encoded slash. Otherwise the
// group the router routes by could differ from the path the backend receives.
func canonicalAPIPath(u *url.URL) bool {
	// Escaping Path never escapes a slash, so an encoded slash can only come
	// from RawPath. EscapedPath also checks that RawPath still encodes Path.
	if raw := u.RawPath; raw != "" && (strings.Contains(raw, "%2f") || strings.Contains(raw, "%2F")) && u.EscapedPath() == raw {
		return false
	}
	// The same as path.Clean(p) == p, segment by segment and without
	// building the cleaned path.
	p := strings.TrimSuffix(u.Path, "/")
	if p == "/" {
		return true
	}
	rest, ok := strings.CutPrefix(p, "/")
	if !ok || strings.HasSuffix(p, "/") {
		return false
	}
	for rest != "" {
		var segment string
		segment, rest, _ = strings.Cut(rest, "/")
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
	}
	return true
}
