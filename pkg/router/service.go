package router

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const readinessPollInterval = time.Second

// ReadyNotifier reports the router's readiness through the module server's
// shared health endpoint.
type ReadyNotifier interface {
	SetReady()
	SetNotReady()
}

// Service runs GrafanaRouter in either the full Grafana server or a dskit
// module target.
type Service struct {
	*services.BasicService

	router  *GrafanaRouter
	ready   ReadyNotifier
	enabled bool
	metrics *routerMetrics
}

// ProvideMiddlewareService creates the router service for the full Grafana
// server. The embedded API server invokes HandleFunc before its existing handler.
func ProvideMiddlewareService(features featuremgmt.FeatureToggles, loader RoutesLoader, reg prometheus.Registerer) (*Service, error) {
	if loader == nil {
		return nil, fmt.Errorf("routes loader is required")
	}

	s := newService(loader, nil, reg)
	s.enabled = features.IsEnabledGlobally(featuremgmt.FlagGrafanaUseRouterMiddleware) //nolint:staticcheck
	return s, nil
}

// ProvideService creates the router target service.
func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, loader RoutesLoader, httpRouter *mux.Router, ready ReadyNotifier, reg prometheus.Registerer) (*Service, error) {
	switch {
	case cfg == nil:
		return nil, fmt.Errorf("configuration is required")
	case loader == nil:
		return nil, fmt.Errorf("routes loader is required")
	case httpRouter == nil:
		return nil, fmt.Errorf("HTTP router is required")
	}

	s := newService(loader, ready, reg)

	// Explicitly configured
	// NOTE: eventually should be the only path
	if slices.Contains(cfg.Target, "router") {
		s.enabled = true
		next := httpRouter.NotFoundHandler
		if next == nil {
			next = http.NotFoundHandler()
		}
		handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			s.router.HandleFunc(w, req, next)
		})
		for _, v := range []string{"/apis", "/openapi/v3"} {
			httpRouter.Handle(v, handler)
			httpRouter.PathPrefix(v + "/").Handler(handler)
		}
		return s, nil
	}

	// We need to run as middleware on-top of the existing HTTP router
	// NOTE: this should be removed when we are no longer running "standard" k8s APIServer
	if features.IsEnabledGlobally(featuremgmt.FlagGrafanaUseRouterMiddleware) { //nolint:staticcheck
		s.enabled = true
		// This will intercept the calls to /apis/* and /openapi/v3/*
		// After we have fully migrated to the router, this should be a raw handler rather than middleware
		httpRouter.Use(s.Middleware)

		// Gorilla middleware only runs after a registered route matches. New router-only
		// groups have no matching route in the existing API server, so they must also get
		// a chance to handle the request before the mux returns its not-found response.
		notFound := httpRouter.NotFoundHandler
		if notFound == nil {
			notFound = http.NotFoundHandler()
		}
		httpRouter.NotFoundHandler = s.Middleware(notFound)
		return s, nil
	}

	// Do not register the handler unless router is explicitly configured (externally)
	// This should be removed when we are no longer running "standard" k8s APIServer
	s.router = NewGrafanaRouter(dummyRoutesLoader{}) // EMPTY loader
	return s, nil
}

func newService(loader RoutesLoader, ready ReadyNotifier, reg prometheus.Registerer) *Service {
	s := &Service{
		router:  NewGrafanaRouter(loader),
		ready:   ready,
		metrics: newRouterMetrics(reg),
	}
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName("router")
	return s
}

// Middleware gives the configured router first chance to serve a request and
// delegates requests for groups it does not own to the existing HTTP stack.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.HandleFunc(w, req, next)
	})
}

// HandleFunc serves through the router when enabled and otherwise delegates.
func (s *Service) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	if !s.enabled {
		next.ServeHTTP(w, req)
		return
	}
	s.metrics.instrument(s.router, w, req, next)
}

// Run adapts Service to the full server's background-service lifecycle.
func (s *Service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

// IsDisabled avoids starting the reconcile loop when middleware routing is off.
func (s *Service) IsDisabled() bool {
	return !s.enabled
}

func (s *Service) starting(ctx context.Context) error {
	if err := s.router.Run(ctx); err != nil {
		return fmt.Errorf("starting router: %w", err)
	}
	return nil
}

func (s *Service) running(ctx context.Context) error {
	ticker := time.NewTicker(readinessPollInterval)
	defer ticker.Stop()

	s.reportReady(ctx)
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			s.reportReady(ctx)
		}
	}
}

func (s *Service) stopping(error) error {
	if s.ready != nil {
		s.ready.SetNotReady()
	}
	return nil
}

func (s *Service) reportReady(ctx context.Context) {
	if s.ready == nil {
		return
	}
	if err := s.router.Ready(ctx); err != nil {
		s.ready.SetNotReady()
		return
	}
	s.ready.SetReady()
}
