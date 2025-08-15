package frontend

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/frontend")

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

	index *IndexProvider
}

func ProvideFrontendService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, promGatherer prometheus.Gatherer, promRegister prometheus.Registerer, license licensing.Licensing) (*frontendService, error) {
	index, err := NewIndexProvider(cfg, license)
	if err != nil {
		return nil, err
	}

	s := &frontendService{
		cfg:          cfg,
		features:     features,
		log:          log.New("frontend-server"),
		promGatherer: promGatherer,
		promRegister: promRegister,
		tracer:       tracer,
		license:      license,
		index:        index,
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
	m.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			traceparent := r.Header.Get("Traceparent")
			jaeger := r.Header.Get("uber-trace-id")
			serverTiming := r.Header.Get("server-timing")

			s.log.Warn("request headers", "path", r.URL.Path, "Traceparent", traceparent, "uber-trace-id", jaeger, "Server-Timing", serverTiming)
			next.ServeHTTP(w, r)
		})
	})

	loggermiddleware := loggermw.Provide(s.cfg, s.features)

	m.Use(requestmeta.SetupRequestMetadata())
	m.UseMiddleware(s.contextMiddleware())

	m.Use(middleware.RequestTracing(s.tracer, middleware.TraceAllPaths))
	m.Use(middleware.RequestMetrics(s.features, s.cfg, s.promRegister))

	m.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			span := trace.SpanFromContext(r.Context())
			if span != nil {
				sc := span.SpanContext()
				if sc.IsValid() {
					w.Header().Set("fs-grafana-traceid", sc.TraceID().String())
				}
			}
			next.ServeHTTP(w, r)
		})
	})

	m.UseMiddleware(loggermiddleware.Middleware())

	m.UseMiddleware(middleware.Recovery(s.cfg, s.license))
}

func (s *frontendService) registerRoutes(m *web.Mux) {
	s.routeGet(m, "/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))

	// Frontend service doesn't (yet?) serve any assets, so explicitly 404
	// them so we can get logs for them
	s.routeGet(m, "/public/*", http.NotFound)

	// All other requests return index.html
	s.routeGet(m, "/*", s.index.HandleRequest)
}
