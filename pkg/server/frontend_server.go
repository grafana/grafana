package server

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type frontendServer struct {
	*services.BasicService
	cfg          *setting.Cfg
	httpServ     *http.Server
	log          log.Logger
	errChan      chan error
	promGatherer prometheus.Gatherer
}

func NewFrontendServer(cfg *setting.Cfg, promGatherer prometheus.Gatherer) (*frontendServer, error) {
	s := &frontendServer{
		cfg:          cfg,
		log:          log.New("frontend-server"),
		promGatherer: promGatherer,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *frontendServer) start(ctx context.Context) error {
	s.httpServ = s.newFrontendServer(ctx)
	s.errChan = make(chan error)
	go func() {
		s.errChan <- s.httpServ.ListenAndServe()
	}()
	return nil
}

func (s *frontendServer) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.errChan:
		return err
	}
}

func (s *frontendServer) stop(failureReason error) error {
	s.log.Info("stopping frontend server", "reason", failureReason)
	if err := s.httpServ.Shutdown(context.Background()); err != nil {
		s.log.Error("failed to shutdown frontend server", "error", err)
		return err
	}
	return nil
}

func (s *frontendServer) newFrontendServer(ctx context.Context) *http.Server {
	s.log.Info("starting frontend server", "addr", ":"+s.cfg.HTTPPort)

	router := http.NewServeMux()
	router.Handle("/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))
	router.HandleFunc("/", s.handleRequest)

	server := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              ":" + s.cfg.HTTPPort,
		Handler:           router,
		BaseContext:       func(_ net.Listener) context.Context { return ctx },
	}

	return server
}

func (s *frontendServer) handleRequest(writer http.ResponseWriter, request *http.Request) {
	s.log.Info("handling request", "method", request.Method, "url", request.URL.String())
	htmlContent := `<!DOCTYPE html>
<html>
<head>
    <title>Grafana Frontend Server</title>
    <style>
        body {
            font-family: sans-serif;
        }
    </style>
</head>
<body>
    <h1>Grafana Frontend Server</h1>
    <p>This is a simple static HTML page served by the Grafana frontend server module.</p>
</body>
</html>`

	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	writer.Write([]byte(htmlContent))
}
