package swagger

import (
	"context"
	"net"
	"net/http"
	"path"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	httpstatic "github.com/grafana/grafana/pkg/api/static"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/swagger")

type swaggerService struct {
	*services.BasicService
	cfg          *setting.Cfg
	httpServ     *http.Server
	features     featuremgmt.FeatureToggles
	log          log.Logger
	errChan      chan error
	promGatherer prometheus.Gatherer
	promRegister prometheus.Registerer
	tracer       trace.Tracer

	handler *Handler
}

func ProvideSwaggerService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, promGatherer prometheus.Gatherer, promRegister prometheus.Registerer, license licensing.Licensing) (*swaggerService, error) {
	s := &swaggerService{
		cfg:          cfg,
		features:     features,
		log:          log.New("swagger-service"),
		promGatherer: promGatherer,
		promRegister: promRegister,
		tracer:       tracer,
		handler:      NewHandler(cfg, license),
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *swaggerService) start(ctx context.Context) error {
	s.httpServ = s.newSwaggerServer(ctx)
	s.errChan = make(chan error)
	go func() {
		s.errChan <- s.httpServ.ListenAndServe()
	}()
	return nil
}

func (s *swaggerService) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.errChan:
		return err
	}
}

func (s *swaggerService) stop(failureReason error) error {
	s.log.Info("stopping swagger server", "reason", failureReason)

	if err := s.httpServ.Shutdown(context.Background()); err != nil {
		s.log.Error("failed to shutdown swagger server", "error", err)
		return err
	}
	return nil
}

func (s *swaggerService) newSwaggerServer(ctx context.Context) *http.Server {
	addr := net.JoinHostPort(s.cfg.HTTPAddr, s.cfg.HTTPPort)
	s.log.Info("starting swagger server", "addr", addr)

	// Use the same web.Mux as the main grafana server for consistency + middleware reuse
	handler := web.New()
	s.addMiddlewares(handler)
	s.registerRoutes(handler)

	return &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              addr,
		Handler:           handler,
		BaseContext:       func(_ net.Listener) context.Context { return ctx },
	}
}

func (s *swaggerService) routeGet(m *web.Mux, pattern string, h ...web.Handler) {
	handlers := append([]web.Handler{middleware.ProvideRouteOperationName(pattern)}, h...)
	m.Get(pattern, handlers...)
}

// Apply the same middleware patterns as the main HTTP server
func (s *swaggerService) addMiddlewares(m *web.Mux) {
	loggermiddleware := loggermw.Provide(s.cfg, s.features)

	m.Use(requestmeta.SetupRequestMetadata())
	m.Use(middleware.RequestTracing(s.tracer, middleware.ShouldTraceAllPaths))
	m.Use(middleware.RequestMetrics(s.features, s.cfg, s.promRegister))

	m.UseMiddleware(s.contextMiddleware())
	m.UseMiddleware(loggermiddleware.Middleware())

	// Must run after the context middleware, which is where it stores the nonce
	if s.cfg.CSPEnabled || s.cfg.CSPReportOnlyEnabled {
		m.UseMiddleware(middleware.ContentSecurityPolicy(s.cfg, s.log))
	}

	// Registered before the static handlers so it wraps them too. It reads the
	// request logger off the ReqContext, so it must stay after the context middleware.
	m.UseMiddleware(s.recoveryMiddleware())

	// The swagger app loads its bundle from public/build-swagger and the API
	// specs it renders from public/*.json, so the whole public dir is served.
	s.mapStatic(m, webassets.BuildDir, "public/build")
	s.mapStatic(m, "", "public")
}

func (s *swaggerService) mapStatic(m *web.Mux, dir string, prefix string) {
	cacheControl := "public, max-age=3600"
	if prefix == "public/build" {
		cacheControl = "public, max-age=31536000"
	}
	if s.cfg.Env == setting.Dev {
		cacheControl = "max-age=0, must-revalidate, no-cache"
	}

	m.Use(httpstatic.Static(
		path.Join(s.cfg.StaticRootPath, dir),
		httpstatic.StaticOptions{
			SkipLogging: true,
			Prefix:      prefix,
			AddHeaders: func(c *web.Context) {
				c.Resp.Header().Set("Cache-Control", cacheControl)
			},
		},
	))
}

func (s *swaggerService) registerRoutes(m *web.Mux) {
	s.routeGet(m, "/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))

	// Empty health check endpoint to allow k8s and other orchestrators to check if the server is alive
	s.routeGet(m, "/-/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)

		if _, err := w.Write([]byte("OK")); err != nil {
			s.log.Error("failed to write health check response", "error", err)
		}
	})

	// Deprecated
	s.routeGet(m, "/swagger-ui", HandleRedirect)
	// Deprecated
	s.routeGet(m, "/openapi3", HandleRedirect)

	// The swagger based api navigator
	s.routeGet(m, "/swagger", s.handler.HandleRequest)
}
