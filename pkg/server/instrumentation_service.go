package server

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type instrumentationService struct {
	*services.BasicService
	cfg            *setting.Cfg
	httpServ       *http.Server
	log            log.Logger
	errChan        chan error
	promGatherer   prometheus.Gatherer
	healthNotifier *HealthNotifier
}

func (ms *ModuleServer) initInstrumentationServer() (*instrumentationService, error) {
	s := &instrumentationService{log: ms.log, cfg: ms.cfg, promGatherer: ms.promGatherer, healthNotifier: ms.healthNotifier}
	s.httpServ, ms.httpServerRouter = s.newInstrumentationServer()
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *instrumentationService) start(ctx context.Context) error {
	s.errChan = make(chan error)

	// Default cfg.Protocol is setting.HTTPScheme, so every existing caller of
	// this service (metrics/healthz on the "all" and other module targets)
	// keeps serving plain HTTP exactly as before. Only a deployment that
	// explicitly sets [server] protocol=https opts into TLS here.
	if s.cfg.Protocol != setting.HTTPSScheme {
		go func() {
			s.errChan <- s.httpServ.ListenAndServe()
		}()
		return nil
	}

	tlsConfig, err := instrumentationTLSConfig(s.cfg)
	if err != nil {
		return fmt.Errorf("configuring instrumentation server TLS: %w", err)
	}
	s.httpServ.TLSConfig = tlsConfig

	go func() {
		// cert/key already loaded into TLSConfig.Certificates above.
		s.errChan <- s.httpServ.ListenAndServeTLS("", "")
	}()
	return nil
}

// instrumentationTLSConfig builds a minimal tls.Config from the same
// [server] cert_file/cert_key/min_tls_version settings api.HTTPServer uses.
// It doesn't support cert_pass-encrypted keys or hot cert reload
// (cfg.CertWatchInterval) — see api.HTTPServer.configureTLS for that fuller
// implementation; add here if the instrumentation server needs it too.
func instrumentationTLSConfig(cfg *setting.Cfg) (*tls.Config, error) {
	if cfg.CertFile == "" {
		return nil, fmt.Errorf("cert_file cannot be empty when using HTTPS")
	}
	if cfg.KeyFile == "" {
		return nil, fmt.Errorf("cert_key cannot be empty when using HTTPS")
	}

	cert, err := tls.LoadX509KeyPair(cfg.CertFile, cfg.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("could not load SSL certificate: %w", err)
	}

	minTLSVersion, err := util.TlsNameToVersion(cfg.MinTLSVersion)
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   minTLSVersion,
	}, nil
}

func (s *instrumentationService) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.errChan:
		return err
	}
}

func (s *instrumentationService) stop(failureReason error) error {
	s.log.Info("stopping instrumentation server", "reason", failureReason)
	if err := s.httpServ.Shutdown(context.Background()); err != nil {
		s.log.Error("failed to shutdown instrumentation server", "error", err)
		return err
	}

	return nil
}

func (s *instrumentationService) newInstrumentationServer() (*http.Server, *mux.Router) {
	router := mux.NewRouter()
	router.Handle("/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))

	RegisterHealthEndpoints(router, s.healthNotifier)

	addr := net.JoinHostPort(s.cfg.HTTPAddr, s.cfg.HTTPPort)
	srv := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              addr,
		Handler:           router,
	}

	return srv, router
}
