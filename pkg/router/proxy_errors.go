package router

import (
	"errors"
	"net"
	"net/http"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/util/errhttp"
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

// localProxyError is a failure of the router's own before a request reached
// its backend, such as failing to sign it. The caller gets its status, and it
// never counts against the backend's breaker.
type localProxyError struct {
	status *apierrors.StatusError
	// reason labels grafana_router_backend_failures_total. It is empty for a
	// request the router refused, which says nothing about the router either.
	reason string
}

func (e *localProxyError) Error() string { return e.status.Error() }

func (e *localProxyError) Unwrap() error { return e.status }

// proxyErrorHandler is the ReverseProxy ErrorHandler for every proxy. It
// records the failure for the breaker and answers a localProxyError with its
// own status, a timeout with 504 and anything else with 502, as the default
// handler does.
func proxyErrorHandler(w http.ResponseWriter, req *http.Request, err error) {
	backendCallFrom(req.Context()).setProxyErr(err)
	var local *localProxyError
	if errors.As(err, &local) {
		if local.status.Status().Code == http.StatusServiceUnavailable {
			w.Header().Set("Retry-After", "1")
		}
		if req.Context().Err() == nil && local.reason != "" {
			logging.FromContext(req.Context()).Warn("router: request not sent to backend", "path", req.URL.Path, "err", err)
		}
		_ = errhttp.Write(req.Context(), local.status, w)
		return
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
