package server

import (
	"context"
	"net"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// ReadinessNotifier is a thread-safe mechanism for operators to signal
// that they have completed initialization and are ready to serve.
type ReadinessNotifier struct {
	ready atomic.Bool
}

// NewReadinessNotifier creates a new ReadinessNotifier in a not-ready state.
func NewReadinessNotifier() *ReadinessNotifier {
	return &ReadinessNotifier{}
}

// SetReady marks the operator as ready. This is safe to call from any goroutine.
func (r *ReadinessNotifier) SetReady() {
	r.ready.Store(true)
}

// SetNotReady marks the operator as not ready. This is safe to call from any goroutine.
func (r *ReadinessNotifier) SetNotReady() {
	r.ready.Store(false)
}

// IsReady returns true if the operator has signaled readiness.
func (r *ReadinessNotifier) IsReady() bool {
	return r.ready.Load()
}

type instrumentationService struct {
	*services.BasicService
	cfg               *setting.Cfg
	httpServ          *http.Server
	log               log.Logger
	errChan           chan error
	promGatherer      prometheus.Gatherer
	readinessNotifier *ReadinessNotifier
}

func (ms *ModuleServer) initInstrumentationServer() (*instrumentationService, error) {
	s := &instrumentationService{log: ms.log, cfg: ms.cfg, promGatherer: ms.promGatherer, readinessNotifier: ms.readinessNotifier}
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

	// Liveness probe: returns 200 OK if the process is alive and serving HTTP.
	router.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}).Methods("GET")

	// Readiness probe: returns 200 OK only after the operator signals readiness.
	router.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if s.readinessNotifier != nil && s.readinessNotifier.IsReady() {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("OK"))
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("not ready"))
	}).Methods("GET")

	addr := net.JoinHostPort(s.cfg.HTTPAddr, s.cfg.HTTPPort)
	srv := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              addr,
		Handler:           router,
	}

	return srv, router
}
