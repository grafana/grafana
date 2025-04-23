package frontend

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type frontendService struct {
	*services.BasicService
	cfg          *setting.Cfg
	httpServ     *http.Server
	log          log.Logger
	errChan      chan error
	promGatherer prometheus.Gatherer

	index *IndexProvider
}

func ProvideFrontendService(cfg *setting.Cfg, promGatherer prometheus.Gatherer, license licensing.Licensing) (*frontendService, error) {
	index, err := NewIndexProvider(cfg, license)
	if err != nil {
		return nil, err
	}

	s := &frontendService{
		cfg:          cfg,
		log:          log.New("frontend-server"),
		promGatherer: promGatherer,
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

	router := http.NewServeMux()
	router.Handle("/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))
	router.HandleFunc("/", s.index.HandleRequest)

	server := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              ":" + s.cfg.HTTPPort,
		Handler:           router,
		BaseContext:       func(_ net.Listener) context.Context { return ctx },
	}

	return server
}
