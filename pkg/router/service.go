package router

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/setting"
)

const readinessPollInterval = time.Second

// ReadyNotifier reports the router's readiness through the module server's
// shared health endpoint.
type ReadyNotifier interface {
	SetReady()
	SetNotReady()
}

// Service runs GrafanaRouter as a dskit service and mounts its HTTP handlers
// on the module target's instrumentation server.
type Service struct {
	*services.BasicService

	router *GrafanaRouter
	ready  ReadyNotifier
}

// ProvideService creates the router target service.
func ProvideService(cfg *setting.Cfg, loader RoutesLoader, httpRouter *mux.Router, ready ReadyNotifier) (*Service, error) {
	if loader == nil {
		return nil, fmt.Errorf("routes loader is required")
	}
	if httpRouter == nil {
		return nil, fmt.Errorf("HTTP router is required")
	}

	s := &Service{
		router: NewGrafanaRouter(loader),
		ready:  ready,
	}
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName("router")

	// Explicitly configured to run the the router
	standalone := slices.Contains(cfg.Target, "router")

	// We need to run as middleware on-top of the existing HTTP router
	// NOTE: this should be removed when we are no longer running "standard" k8s APIServer
	if !standalone {
		// This will intercept the calls to /apis/* and /openapi/v3/*
		// After we have fully migrated to the router, this should be a raw handler rather than middleware
		httpRouter.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				s.router.HandleFunc(w, req, next)
			})
		})
		return s, nil
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.router.HandleFunc(w, req, httpRouter.NotFoundHandler)
	})
	for _, v := range []string{"/apis", "/openapi/v3"} {
		httpRouter.Handle(v, handler)
		httpRouter.Handle(v+"/", handler)
		httpRouter.Handle(v+"/*", handler)
	}

	return s, nil
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
