package proxyutil

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/http/httputil"
	"strings"
	"time"

	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

// StatusClientClosedRequest A non-standard status code introduced by nginx
// for the case when a client closes the connection while nginx is processing
// the request.
// https://httpstatus.in/499/
const StatusClientClosedRequest = 499

// ReverseProxyOption reverse proxy option to configure a httputil.ReverseProxy.
type ReverseProxyOption func(*httputil.ReverseProxy)

// NewReverseProxy creates a new httputil.ReverseProxy with sane default configuration.
func NewReverseProxy(logger glog.Logger, director func(*http.Request), opts ...ReverseProxyOption) *httputil.ReverseProxy {
	if logger == nil {
		panic("logger cannot be nil")
	}

	if director == nil {
		panic("director cannot be nil")
	}

	p := &httputil.ReverseProxy{
		FlushInterval: time.Millisecond * 200,
		ErrorHandler:  errorHandler(logger),
		ErrorLog:      log.New(&logWrapper{logger: logger}, "", 0),
		Director:      director,
	}

	for _, opt := range opts {
		opt(p)
	}

	origDirector := p.Director
	p.Director = wrapDirector(origDirector)

	if p.ModifyResponse == nil {
		// nolint:bodyclose
		p.ModifyResponse = modifyResponse(logger)
	} else {
		modResponse := p.ModifyResponse
		p.ModifyResponse = func(resp *http.Response) error {
			if err := modResponse(resp); err != nil {
				return err
			}

			// nolint:bodyclose
			return modifyResponse(logger)(resp)
		}
	}

	return p
}

// wrapDirector wraps a director and adds additional functionality.
func wrapDirector(d func(*http.Request)) func(req *http.Request) {
	return func(req *http.Request) {
		list := contexthandler.AuthHTTPHeaderListFromContext(req.Context())
		if list != nil {
			for _, name := range list.Items {
				req.Header.Del(name)
			}
		}

		d(req)
		PrepareProxyRequest(req)
	}
}

// modifyResponse enforces certain constraints on http.Response.
func modifyResponse(logger glog.Logger) func(resp *http.Response) error {
	return func(resp *http.Response) error {
		resp.Header.Del("Set-Cookie")
		SetProxyResponseHeaders(resp.Header)
		return nil
	}
}

type timeoutError interface {
	error
	Timeout() bool
}

// errorHandler handles any errors happening while proxying a request and enforces
// certain HTTP status based on the kind of error.
// If client cancel/close the request we return 499 StatusClientClosedRequest.
// If timeout happens while communicating with upstream server we return http.StatusGatewayTimeout.
// If any other error we return http.StatusBadGateway.
func errorHandler(logger glog.Logger) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		ctxLogger := logger.FromContext(r.Context())

		if errors.Is(err, context.Canceled) {
			ctxLogger.Debug("Proxy request cancelled by client")
			w.WriteHeader(StatusClientClosedRequest)
			return
		}

		// The remaining erros comes from the downstream system and
		// and not grafana itself.
		if ctx := contexthandler.FromContext(r.Context()); ctx != nil {
			ctx.ErrorSource = "downstream"
		}

		// nolint:errorlint
		if timeoutErr, ok := err.(timeoutError); ok && timeoutErr.Timeout() {
			ctxLogger.Error("Proxy request timed out", "err", err)
			w.WriteHeader(http.StatusGatewayTimeout)
			return
		}

		ctxLogger.Error("Proxy request failed", "err", err)
		w.WriteHeader(http.StatusBadGateway)
	}
}

type logWrapper struct {
	logger glog.Logger
}

// Write writes log messages as bytes from proxy.
func (lw *logWrapper) Write(p []byte) (n int, err error) {
	withoutNewline := strings.TrimSuffix(string(p), "\n")
	lw.logger.Error("Proxy request error", "error", withoutNewline)
	return len(p), nil
}

func WithTransport(transport http.RoundTripper) ReverseProxyOption {
	if transport == nil {
		panic("transport cannot be nil")
	}

	return ReverseProxyOption(func(rp *httputil.ReverseProxy) {
		rp.Transport = transport
	})
}

func WithModifyResponse(fn func(*http.Response) error) ReverseProxyOption {
	if fn == nil {
		panic("fn cannot be nil")
	}

	return ReverseProxyOption(func(rp *httputil.ReverseProxy) {
		rp.ModifyResponse = fn
	})
}
