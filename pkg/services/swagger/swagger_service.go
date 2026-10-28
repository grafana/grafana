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

	handler *Handler
}

// ProvideSwaggerService builds the standalone swagger-server target, which runs
// its own HTTP server instead of mounting on the core one.
func ProvideSwaggerService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, promGatherer prometheus.Gatherer, promRegister prometheus.Registerer, license licensing.Licensing) *swaggerService {
	s := &swaggerService{
		cfg:          cfg,
		features:     features,
		log:          log.New("swagger-service"),
		promGatherer: promGatherer,
		promRegister: promRegister,
		handler:      newHandler(cfg, license),
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s
}

func (s *swaggerService) start(ctx context.Context) error {
	s.httpServ = s.newSwaggerServer(ctx)
	// Buffered so the goroutine can still exit after running has returned and
	// stop shuts the server down.
	s.errChan = make(chan error, 1)
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

	// web.Mux, like the core server, so the same middleware can be reused.
	handler := web.New()
	s.addMiddlewares(handler)
	s.registerRoutes(handler)

	return &http.Server{
		// Bounds header reads to protect against Slowloris attacks.
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

// addMiddlewares applies the parts of the core server's middleware chain that
// the swagger page needs.
func (s *swaggerService) addMiddlewares(m *web.Mux) {
	loggermiddleware := loggermw.Provide(s.cfg, s.features)

	m.Use(requestmeta.SetupRequestMetadata())
	m.Use(middleware.RequestTracing(tracer, middleware.ShouldTraceAllPaths))
	m.Use(middleware.RequestMetrics(s.features, s.cfg, s.promRegister))

	m.UseMiddleware(s.contextMiddleware())
	m.UseMiddleware(loggermiddleware.Middleware())

	// Must run after the context middleware, because it stores the nonce on the ReqContext.
	if s.cfg.CSPEnabled || s.cfg.CSPReportOnlyEnabled {
		m.UseMiddleware(middleware.ContentSecurityPolicy(s.cfg, s.log))
	}

	// Registered before the static handlers so it covers them too, and after the
	// context middleware because it logs through the ReqContext logger.
	m.UseMiddleware(s.recoveryMiddleware())

	// The swagger app loads its bundle from public/build-swagger and the API
	// specs it renders from public/*.json, so the whole public dir is served.
	s.mapStatic(m, webassets.BuildDir, "public/build")
	s.mapStatic(m, "", "public")

	// Registered after the static handlers, as on the core server, so static
	// files keep their cache headers instead of getting no-store.
	if len(s.cfg.CustomResponseHeaders) > 0 {
		m.Use(middleware.AddCustomResponseHeaders(s.cfg))
	}
	m.Use(middleware.AddDefaultResponseHeaders(s.cfg))
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

	// Liveness check for k8s and other orchestrators.
	s.routeGet(m, "/-/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)

		if _, err := w.Write([]byte("OK")); err != nil {
			s.log.Error("failed to write health check response", "error", err)
		}
	})

	// Deprecated
	s.routeGet(m, "/swagger-ui", handleRedirect)

	s.routeGet(m, "/swagger", s.handler.handleRequest)
}
