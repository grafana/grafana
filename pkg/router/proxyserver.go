package router

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"golang.org/x/sync/errgroup"
)

// Routes is the minimal surface the ProxyServer needs from the router. It is a
// subset of Router: the standalone proxy has nothing behind it, so it supplies
// a 404 as the fallthrough.
type Routes interface {
	// HandleFunc serves the reverse-proxy tree mounted at /apis. next is served
	// for paths the router does not own.
	HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler)
	// OpenAPIV3Handler serves the merged OpenAPI v3 document at /openapi/v3.
	OpenAPIV3Handler() http.Handler
}

// ProxyServerConfig configures the standalone proxy listener.
type ProxyServerConfig struct {
	// Addr is the listen address for the proxy, e.g. ":6444". Required.
	Addr string

	// TLSConfig terminates TLS on the proxy port. If nil the server listens in
	// plaintext, which is only safe when something upstream (service mesh,
	// aggregator) has already authenticated the caller — see the security note
	// on NewProxyServer.
	TLSConfig *tls.Config

	// ShutdownTimeout bounds graceful drain on shutdown. Defaults to 10s.
	ShutdownTimeout time.Duration

	// ReadHeaderTimeout bounds how long a client may take to send request
	// headers. Defaults to 15s. This is the one timeout safe to enforce on a
	// reverse proxy (it does not cap streaming bodies) and it closes the
	// slow-header (Slowloris) hole that the k8s handler chain would otherwise
	// have covered.
	ReadHeaderTimeout time.Duration

	// Logger is used for lifecycle logging. Defaults to slog.Default().
	Logger *slog.Logger
}

// ProxyServer runs the cloud-apps reverse proxy on its own port, deliberately
// OUTSIDE the apiserver's kubernetes handler chain (no authn, authz, audit, or
// priority-and-fairness). It is specific to the appmanifest apiserver and is not
// part of the App: server.go constructs it and drives its lifecycle directly.
//
// Because it bypasses the k8s chain, the caller owns this port's security:
// provide TLSConfig and/or ensure the port is only reachable behind an already
// authenticated hop.
type ProxyServer struct {
	cfg    ProxyServerConfig
	routes Routes
	logger *slog.Logger
}

// NewProxyServer builds a ProxyServer serving routes on cfg.Addr. It does not
// bind the socket; call Run to serve.
func NewProxyServer(cfg ProxyServerConfig, routes Routes) (*ProxyServer, error) {
	if cfg.Addr == "" {
		return nil, errors.New("proxy server: Addr is required")
	}
	if routes == nil {
		return nil, errors.New("proxy server: routes is required")
	}
	if cfg.ShutdownTimeout <= 0 {
		cfg.ShutdownTimeout = 10 * time.Second
	}
	if cfg.ReadHeaderTimeout <= 0 {
		cfg.ReadHeaderTimeout = 15 * time.Second
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &ProxyServer{cfg: cfg, routes: routes, logger: logger}, nil
}

// handler mounts the two proxied trees onto a stable mux built once. Route
// churn happens inside the router's own group dispatch, never here.
func (s *ProxyServer) handler() http.Handler {
	mux := http.NewServeMux()
	// Standalone proxy: nothing sits behind the router, so an unowned group is a
	// 404 rather than a fallthrough.
	mux.Handle("/apis/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.routes.HandleFunc(w, r, http.NotFoundHandler())
	}))
	mux.Handle("/openapi/v3/", s.routes.OpenAPIV3Handler())
	return mux
}

// Run serves until ctx is cancelled or an unrecoverable serve error occurs.
// It returns nil on a clean (ctx-driven) shutdown and the underlying error
// otherwise. A non-nil return is fatal to the process by design: this server
// must be alive for the whole life of the appmanifest apiserver.
func (s *ProxyServer) Run(ctx context.Context) error {
	srv := &http.Server{
		Addr:              s.cfg.Addr,
		Handler:           s.handler(),
		TLSConfig:         s.cfg.TLSConfig,
		ReadHeaderTimeout: s.cfg.ReadHeaderTimeout,
	}

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		s.logger.Info("cloud-apps proxy listening", "addr", s.cfg.Addr, "tls", s.cfg.TLSConfig != nil)
		var err error
		if s.cfg.TLSConfig != nil {
			// Certs come from TLSConfig, so the cert/key path args stay empty.
			err = srv.ListenAndServeTLS("", "")
		} else {
			err = srv.ListenAndServe()
		}
		if errors.Is(err, http.ErrServerClosed) {
			return nil // clean shutdown, not a failure
		}
		return fmt.Errorf("cloud-apps proxy serve: %w", err)
	})

	g.Go(func() error {
		<-gctx.Done()
		// gctx is already cancelled here; detach so Shutdown actually drains
		// in-flight requests instead of returning immediately, but bound it so
		// a stuck upstream or hijacked connection can never hang shutdown.
		shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(gctx), s.cfg.ShutdownTimeout)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			// Deadline blew or a hijacked/streaming conn would not drain; force
			// the remaining connections closed so the process can exit.
			s.logger.Warn("cloud-apps proxy graceful shutdown timed out, forcing close", "error", err)
			_ = srv.Close()
		}
		return nil
	})

	return g.Wait()
}
