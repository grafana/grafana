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
)

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
		d(req)
		PrepareProxyRequest(req)

		// Clear Origin and Referer to avoid CORS issues
		req.Header.Del("Origin")
		req.Header.Del("Referer")
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

func errorHandler(logger glog.Logger) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			logger.Debug("Proxy request cancelled")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// nolint:errorlint
		if timeoutErr, ok := err.(timeoutError); ok && timeoutErr.Timeout() {
			logger.Error("Proxy request timed out", "err", err)
			w.WriteHeader(http.StatusGatewayTimeout)
			return
		}

		logger.Error("Proxy request failed", "err", err)
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
