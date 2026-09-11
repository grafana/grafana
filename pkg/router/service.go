package router

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"

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

	router *GrafanaRouter
	ready  ReadyNotifier

	standalone bool
	middleware bool
}

// ProvideService creates the router service.
func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, loader RoutesLoader) (*Service, error) {
	if loader == nil {
		return nil, fmt.Errorf("routes loader is required")
	}

	s := newService(loader)
	s.standalone = slices.Contains(cfg.Target, "router")
	s.middleware = features.IsEnabledGlobally(featuremgmt.FlagGrafanaUseRouterMiddleware) //nolint:staticcheck
	return s, nil
}

// RegisterTargetRoutes enables the service and mounts it on the dskit module server.
func (s *Service) RegisterTargetRoutes(httpRouter *mux.Router, ready ReadyNotifier) error {
	if !s.standalone {
		return nil
	}

	if httpRouter == nil {
		return fmt.Errorf("HTTP router is required")
	}

	s.ready = ready
	next := httpRouter.NotFoundHandler
	if next == nil {
		next = http.NotFoundHandler()
	}
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.router.HandleFunc(w, req, next)
	})
	for _, path := range []string{"/apis", "/openapi/v3"} {
		httpRouter.Handle(path, handler)
		httpRouter.PathPrefix(path + "/").Handler(handler)
	}
	return nil
}

func newService(loader RoutesLoader) *Service {
	s := &Service{
		router: NewGrafanaRouter(loader),
	}
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName("router")
	return s
}

// HandleFunc serves through the router when enabled and otherwise delegates.
func (s *Service) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	if s.middleware {
		s.router.HandleFunc(w, req, next)
		return
	}
	next.ServeHTTP(w, req) // pass though
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
	return !(s.middleware || s.standalone)
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
