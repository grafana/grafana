package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/authn"
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
	metrics *routerMetrics

	standalone bool
	middleware bool

	// mtRoutes is the loader's source of the multi-tenant router's groups, set
	// on a cloud stack that configures mt_router_address.
	mtRoutes *mtRoutes

	// loaderLifecycle is the routes loader's own background lifecycle (such as
	// cloudLoader's poll loops), which this service starts, stops and watches.
	// Both are nil for a loader without one; a nil watcher's channel never fires.
	loaderLifecycle services.Service
	loaderFailures  *services.FailureWatcher
}

// ProvideGrafanaRouter creates the router without its routes loader, which
// ProvideService attaches. The loader depends on storage, and in-process
// storage reads the router's published manifests (as a ManifestDiscovery), so
// building the router first keeps the dependency graph acyclic.
func ProvideGrafanaRouter(cfg *setting.Cfg) (*GrafanaRouter, error) {
	var auth authn.TokenAuthenticator
	if standaloneRouter(cfg) {
		var err error
		auth, err = authn.NewGrafanaTokenAuthenticator(cfg)
		if err != nil {
			return nil, err
		}
	}
	return NewGrafanaRouter(nil, auth), nil
}

// ProvideService creates the router service around router, attaching loader.
// RegisterTargetRoutes enables it for the router module. Inside Grafana it
// always runs, so the /apis/discovery tree stays current; the middleware
// feature toggle controls whether it routes any other request.
func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, loader RoutesLoader, reg prometheus.Registerer, router *GrafanaRouter) (*Service, error) {
	if loader == nil {
		return nil, fmt.Errorf("routes loader is required")
	}
	router.loader = loader

	s := newService(router, reg)
	s.standalone = standaloneRouter(cfg)
	s.middleware = middlewareEnabled(cfg, features)
	if routes, ok := loader.(*mtRoutes); ok && s.middleware && !s.standalone {
		s.mtRoutes = routes
		router.discoveryRules = append(router.discoveryRules, mtDiscoveryRule())
	}
	if lifecycle, ok := loader.(services.Service); ok {
		s.loaderLifecycle = lifecycle
		s.loaderFailures = services.NewFailureWatcher()
		s.loaderFailures.WatchService(lifecycle)
	}
	return s, nil
}

// RegisterTargetRoutes enables the service and mounts it on the dskit module server.
func (s *Service) RegisterTargetRoutes(httpRouter *mux.Router, ready ReadyNotifier) error {
	if !s.standalone || httpRouter == nil {
		return nil // do not register!
	}

	s.ready = ready
	next := httpRouter.NotFoundHandler
	if next == nil {
		next = http.NotFoundHandler()
	}

	// The standalone router is never middleware, so the fallback always applies.
	if st, ok := s.router.loader.(loaderWithSingleTenantFallback); ok {
		s.router.unregisteredGroupHandler = st.SingleTenantFallback()
		s.router.discoveryRules = append(s.router.discoveryRules, singleTenantDiscoveryRule())
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		s.metrics.instrument(s.router, w, req, next, apiGroup(req.URL.Path))
	})
	for _, path := range []string{apisPrefix, openapiV3Prefix} {
		httpRouter.Handle(path, handler)
		httpRouter.PathPrefix(path + "/").Handler(handler)
	}
	return nil
}

func newService(router *GrafanaRouter, reg prometheus.Registerer) *Service {
	s := &Service{
		router:  router,
		metrics: newRouterMetrics(reg),
	}
	s.router.onBreakerChange = s.metrics.breakerChanged
	s.router.onDiscovery = s.metrics.discoveryResult
	// The collector reads this router's state, so another router's must not be
	// reused for it. A second router on one registry, as in tests, goes
	// unreported rather than panicking.
	var already prometheus.AlreadyRegisteredError
	if err := reg.Register(newRouterCollector(s.router)); err != nil && !errors.As(err, &already) {
		panic(err)
	}
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName("router")
	return s
}

// HandleFunc serves through the router when enabled and otherwise delegates.
// The /apis/discovery tree is the router's own, so it is served either way.
func (s *Service) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	if s.middleware || isDiscoveryPath(req.URL.Path) {
		// Requests for groups the router doesn't serve belong to the embedded
		// API server, which has its own metrics; don't count them as the router's.
		group := apiGroup(req.URL.Path)
		if !s.router.owns(req, group) {
			// Only the standalone router has a single-tenant fallback, and it
			// never calls HandleFunc, so this passes the request on.
			next.ServeHTTP(w, req)
			return
		}
		s.metrics.instrument(s.router, w, req, next, group)
		return
	}
	next.ServeHTTP(w, req)
}

// Run adapts Service to the full server's background-service lifecycle.
func (s *Service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *Service) starting(ctx context.Context) (err error) {
	// A loader with a lifecycle fills its routes only while it runs, so start
	// it before the router's first reconcile.
	if s.loaderLifecycle != nil {
		// dskit doesn't call stopping when starting fails, so stop the loader
		// here, or its poll loops would outlive the failed router.
		defer func() {
			if err != nil {
				_ = services.StopAndAwaitTerminated(context.Background(), s.loaderLifecycle)
			}
		}()
		if err := services.StartAndAwaitRunning(ctx, s.loaderLifecycle); err != nil {
			return fmt.Errorf("starting routes loader: %w", err)
		}
	}
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
		case err := <-s.loaderFailures.Chan():
			return fmt.Errorf("routes loader failed: %w", err)
		case <-ticker.C:
			s.reportReady(ctx)
		}
	}
}

func (s *Service) stopping(error) error {
	if s.ready != nil {
		s.ready.SetNotReady()
	}
	// Watches never go idle, so the server's shutdown would otherwise wait for
	// each one to end. Clients re-establish them against another replica.
	s.router.closeWatches()
	if s.loaderLifecycle != nil {
		return services.StopAndAwaitTerminated(context.Background(), s.loaderLifecycle)
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
