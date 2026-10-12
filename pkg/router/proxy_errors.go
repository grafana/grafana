package router

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
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
	p := strings.TrimSuffix(u.Path, "/")
	if path.Clean(p) != p {
		return false
	}
	return !strings.Contains(strings.ToLower(u.EscapedPath()), "%2f")
}
