package server

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type instrumentationService struct {
	*services.BasicService
	settingsProvider setting.SettingsProvider
	httpServ         *http.Server
	log              log.Logger
	errChan          chan error
	promGatherer     prometheus.Gatherer
}

func (ms *ModuleServer) initInstrumentationServer() (*instrumentationService, error) {
	s := &instrumentationService{log: ms.log, settingsProvider: ms.settingsProvider, promGatherer: ms.promGatherer}
	s.httpServ, ms.httpServerRouter = s.newInstrumentationServer()
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *instrumentationService) start(ctx context.Context) error {
	s.errChan = make(chan error)
	go func() {
		s.errChan <- s.httpServ.ListenAndServe()
	}()
	return nil
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

	cfg := s.settingsProvider.Get()
	addr := net.JoinHostPort(cfg.HTTPAddr, cfg.HTTPPort)
	srv := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              addr,
		Handler:           router,
	}

	return srv, router
}
