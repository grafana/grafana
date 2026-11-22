package router

import (
	"errors"
	"net"
	"net/http"
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

// proxyErrorHandler is the ReverseProxy ErrorHandler for every proxy. It
// records the failure for the breaker and answers 504 for a timeout and 502
// otherwise, as the default handler does.
func proxyErrorHandler(w http.ResponseWriter, req *http.Request, err error) {
	backendCallFrom(req.Context()).setProxyErr(err)
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
