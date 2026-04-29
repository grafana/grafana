package frontend

import (
	"context"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	publicdashboardsapi "github.com/grafana/grafana/pkg/services/publicdashboards/api"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/frontend")

// Initialize metrics
var bootErrorMetric = promauto.NewCounter(prometheus.CounterOpts{
	Namespace: "grafana",
	Subsystem: "frontend",
	Name:      "boot_errors_total",
	Help:      "Total number of frontend boot errors",
})

var settingsFetchMetric = promauto.NewCounterVec(prometheus.CounterOpts{
	Namespace: "grafana",
	Subsystem: "frontend",
	Name:      "settings_fetch_total",
	Help:      "Total number of settings service fetch attempts from the request config middleware",
}, []string{"status"}) // status: "success" or "error"

type frontendService struct {
	*services.BasicService
	cfg          *setting.Cfg
	httpServ     *http.Server
	features     featuremgmt.FeatureToggles
	log          log.Logger
	errChan      chan error
	promGatherer prometheus.Gatherer
	promRegister prometheus.Registerer
	tracer       trace.Tracer
	license      licensing.Licensing

	index           *IndexProvider
	settingsService settingservice.Service // nil if not configured
}

func ProvideFrontendService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, promGatherer prometheus.Gatherer, promRegister prometheus.Registerer, license licensing.Licensing, hooksService *hooks.HooksService) (*frontendService, error) {
	logger := log.New("frontend-service")

	index, err := NewIndexProvider(cfg, license, hooksService)
	if err != nil {
		return nil, err
	}

	// Initialize Settings Service client if configured
	var settingsService settingservice.Service
	if settingsSvc, err := setupSettingsService(cfg, promRegister); err != nil {
		logger.Error("Settings Service failed to initialize", "err", err)
		return nil, err
	} else {
		settingsService = settingsSvc
	}

	s := &frontendService{
		cfg:             cfg,
		features:        features,
		log:             logger,
		promGatherer:    promGatherer,
		promRegister:    promRegister,
		tracer:          tracer,
		license:         license,
		index:           index,
		settingsService: settingsService,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *frontendService) start(ctx context.Context) error {
	s.httpServ = s.newFrontendServer(ctx)
	s.errChan = make(chan error)
	go func() {
		s.errChan <- s.httpServ.ListenAndServe()
	}()
	return nil
}

func (s *frontendService) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.errChan:
		return err
	}
}

func (s *frontendService) stop(failureReason error) error {
	s.log.Info("stopping frontend server", "reason", failureReason)

	if err := s.httpServ.Shutdown(context.Background()); err != nil {
		s.log.Error("failed to shutdown frontend server", "error", err)
		return err
	}
	return nil
}

func (s *frontendService) newFrontendServer(ctx context.Context) *http.Server {
	s.log.Info("starting frontend server", "addr", ":"+s.cfg.HTTPPort)

	// Use the same web.Mux as the main grafana server for consistency + middleware reuse
	handler := web.New()
	s.addMiddlewares(handler)
	s.registerRoutes(handler)

	server := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              ":" + s.cfg.HTTPPort,
		Handler:           handler,
		BaseContext:       func(_ net.Listener) context.Context { return ctx },
	}

	return server
}

func (s *frontendService) routeGet(m *web.Mux, pattern string, h ...web.Handler) {
	handlers := append([]web.Handler{middleware.ProvideRouteOperationName(pattern)}, h...)
	m.Get(pattern, handlers...)
}

// Apply the same middleware patterns as the main HTTP server
func (s *frontendService) addMiddlewares(m *web.Mux) {
	loggermiddleware := loggermw.Provide(s.cfg, s.features)

	m.Use(requestmeta.SetupRequestMetadata())
	m.Use(middleware.RequestTracing(s.tracer, middleware.ShouldTraceAllPaths))
	m.Use(middleware.RequestMetrics(s.features, s.cfg, s.promRegister))

	m.UseMiddleware(s.contextMiddleware())
	m.UseMiddleware(loggermiddleware.Middleware())

	// Must run before CSP middleware since CSP reads config from context
	m.UseMiddleware(RequestConfigMiddleware(s.cfg, s.license, s.settingsService))

	m.UseMiddleware(CSPMiddleware())

	m.UseMiddleware(middleware.Recovery(s.cfg, s.license))
}

func (s *frontendService) registerRoutes(m *web.Mux) {
	s.routeGet(m, "/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))

	// Frontend service doesn't (yet?) serve any assets, so explicitly 404
	// them so we can get logs for them
	s.routeGet(m, "/public/*", http.NotFound)

	// Empty health check endpoint to allow k8s and other orchestrators to check if the server is alive
	// Useful to have a separate route for this for logging and metrics purposes
	s.routeGet(m, "/-/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)

		if _, err := w.Write([]byte("OK")); err != nil {
			s.log.Error("failed to write health check response", "error", err)
		}
	})

	// Frontend boot error reporting endpoint
	// GET because all POST requests are passed to the backend, even though POST is more correct. The frontend
	// uses cache busting to ensure requests aren't cached.
	s.routeGet(m, "/-/fe-boot-error", s.handleBootError)

	s.routeGet(m, "/public-dashboards/:accessToken",
		publicdashboardsapi.SetPublicDashboardAccessToken,
		s.index.HandleRequest,
	)

	// All other requests return index.html
	s.routeGet(m, "/*", s.index.HandleRequest)
}

// handleBootError handles frontend boot error reports
func (s *frontendService) handleBootError(w http.ResponseWriter, r *http.Request) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.log.Error("failed to read boot error request body", "error", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	defer func() {
		if err := r.Body.Close(); err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()

	// Increment the Prometheus counter
	bootErrorMetric.Inc()

	// Log the error details
	s.log.Error("frontend boot error reported", "error", body)

	// Return success response
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("OK")); err != nil {
		s.log.Error("failed to write boot error response", "error", err)
	}
}
