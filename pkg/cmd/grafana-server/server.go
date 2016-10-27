package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"gopkg.in/macaron.v1"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/eventpublisher"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
)

func NewGrafanaServer() models.GrafanaServer {
	rootCtx, shutdownFn := context.WithCancel(context.Background())
	childRoutines, childCtx := errgroup.WithContext(rootCtx)

	return &GrafanaServerImpl{
		context:       childCtx,
		shutdownFn:    shutdownFn,
		childRoutines: childRoutines,
		log:           log.New("server"),
	}
}

type GrafanaServerImpl struct {
	context       context.Context
	shutdownFn    context.CancelFunc
	childRoutines *errgroup.Group
	log           log.Logger
}

func (g *GrafanaServerImpl) Start() {
	go listenToSystemSignals(g)

	writePIDFile()
	initRuntime()
	initSql()
	metrics.Init()
	search.Init()
	login.Init()
	social.NewOAuthService()
	eventpublisher.Init()
	plugins.Init()

	// init alerting
	if setting.ExecuteAlerts {
		engine := alerting.NewEngine()
		g.childRoutines.Go(func() error { return engine.Run(g.context) })
	}

	// cleanup service
	cleanUpService := cleanup.NewCleanUpService()
	g.childRoutines.Go(func() error { return cleanUpService.Run(g.context) })

	if err := notifications.Init(); err != nil {
		g.log.Error("Notification service failed to initialize", "erro", err)
		g.Shutdown(1, "Startup failed")
		return
	}

	g.startHttpServer()
}

func (g *GrafanaServerImpl) startHttpServer() {
	logger = log.New("http.server")

	var err error
	m := newMacaron()
	api.Register(m)

	listenAddr := fmt.Sprintf("%s:%s", setting.HttpAddr, setting.HttpPort)
	g.log.Info("Initializing HTTP Server", "address", listenAddr, "protocol", setting.Protocol, "subUrl", setting.AppSubUrl)

	switch setting.Protocol {
	case setting.HTTP:
		err = http.ListenAndServe(listenAddr, m)
	case setting.HTTPS:
		err = ListenAndServeTLS(listenAddr, setting.CertFile, setting.KeyFile, m)
	default:
		g.log.Error("Invalid protocol", "protocol", setting.Protocol)
		g.Shutdown(1, "Startup failed")
	}

	if err != nil {
		g.log.Error("Fail to start server", "error", err)
		g.Shutdown(1, "Startup failed")
		return
	}
}

func (g *GrafanaServerImpl) Shutdown(code int, reason string) {
	g.log.Info("Shutdown started", "code", code, "reason", reason)

	g.shutdownFn()
	err := g.childRoutines.Wait()

	g.log.Info("Shutdown completed", "reason", err)
	log.Close()
	os.Exit(code)
}

func ListenAndServeTLS(listenAddr, certfile, keyfile string, m *macaron.Macaron) error {
	if certfile == "" {
		return fmt.Errorf("cert_file cannot be empty when using HTTPS")
	}

	if keyfile == "" {
		return fmt.Errorf("cert_key cannot be empty when using HTTPS")
	}

	if _, err := os.Stat(setting.CertFile); os.IsNotExist(err) {
		return fmt.Errorf(`Cannot find SSL cert_file at %v`, setting.CertFile)
	}

	if _, err := os.Stat(setting.KeyFile); os.IsNotExist(err) {
		return fmt.Errorf(`Cannot find SSL key_file at %v`, setting.KeyFile)
	}

	return http.ListenAndServeTLS(listenAddr, setting.CertFile, setting.KeyFile, m)
}

// implement context.Context
func (g *GrafanaServerImpl) Deadline() (deadline time.Time, ok bool) {
	return g.context.Deadline()
}
func (g *GrafanaServerImpl) Done() <-chan struct{} {
	return g.context.Done()
}
func (g *GrafanaServerImpl) Err() error {
	return g.context.Err()
}
func (g *GrafanaServerImpl) Value(key interface{}) interface{} {
	return g.context.Value(key)
}
