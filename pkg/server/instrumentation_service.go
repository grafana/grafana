package server

import (
	"context"
	"net"
	"net/http"
	"net/http/pprof"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	godeltaprof "github.com/grafana/pyroscope-go/godeltaprof/http/pprof"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type instrumentationService struct {
	*services.BasicService
	httpServ *http.Server
	log      log.Logger
	errChan  chan error
}

func NewInstrumentationService(log log.Logger) (*instrumentationService, error) {
	s := &instrumentationService{log: log}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *instrumentationService) start(ctx context.Context) error {
	s.httpServ = s.newInstrumentationServer(ctx)
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

func (s *instrumentationService) newInstrumentationServer(ctx context.Context) *http.Server {
	router := http.NewServeMux()
	router.Handle("/metrics", promhttp.Handler())
	router.HandleFunc("/debug/pprof/", pprof.Index)
	router.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	router.HandleFunc("/debug/pprof/profile", pprof.Profile)
	router.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	router.HandleFunc("/debug/pprof/trace", pprof.Trace)
	router.HandleFunc("/debug/pprof/delta_heap", godeltaprof.Heap)
	router.HandleFunc("/debug/pprof/delta_block", godeltaprof.Block)
	router.HandleFunc("/debug/pprof/delta_mutex", godeltaprof.Mutex)

	srv := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              ":3000", // TODO - make configurable?
		Handler:           router,
		BaseContext:       func(_ net.Listener) context.Context { return ctx },
	}

	return srv
}
