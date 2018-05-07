package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"time"

	"github.com/facebookgo/inject"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/social"
	"github.com/grafana/grafana/pkg/tracing"

	// self registering services
	_ "github.com/grafana/grafana/pkg/extensions"
	_ "github.com/grafana/grafana/pkg/metrics"
	_ "github.com/grafana/grafana/pkg/plugins"
	_ "github.com/grafana/grafana/pkg/services/alerting"
	_ "github.com/grafana/grafana/pkg/services/cleanup"
	_ "github.com/grafana/grafana/pkg/services/notifications"
	_ "github.com/grafana/grafana/pkg/services/search"
)

func NewGrafanaServer() *GrafanaServerImpl {
	rootCtx, shutdownFn := context.WithCancel(context.Background())
	childRoutines, childCtx := errgroup.WithContext(rootCtx)

	return &GrafanaServerImpl{
		context:       childCtx,
		shutdownFn:    shutdownFn,
		childRoutines: childRoutines,
		log:           log.New("server"),
		cfg:           setting.NewCfg(),
	}
}

type GrafanaServerImpl struct {
	context       context.Context
	shutdownFn    context.CancelFunc
	childRoutines *errgroup.Group
	log           log.Logger
	cfg           *setting.Cfg

	RouteRegister api.RouteRegister `inject:""`
	HttpServer    *api.HTTPServer   `inject:""`
}

func (g *GrafanaServerImpl) Start() error {
	g.loadConfiguration()
	g.writePIDFile()

	// initSql
	sqlstore.NewEngine() // TODO: this should return an error
	sqlstore.EnsureAdminUser()

	login.Init()
	social.NewOAuthService()

	if err := provisioning.Init(g.context, setting.HomePath, g.cfg.Raw); err != nil {
		return fmt.Errorf("Failed to provision Grafana from config. error: %v", err)
	}

	tracingCloser, err := tracing.Init(g.cfg.Raw)
	if err != nil {
		return fmt.Errorf("Tracing settings is not valid. error: %v", err)
	}
	defer tracingCloser.Close()

	serviceGraph := inject.Graph{}
	serviceGraph.Provide(&inject.Object{Value: bus.GetBus()})
	serviceGraph.Provide(&inject.Object{Value: g.cfg})
	serviceGraph.Provide(&inject.Object{Value: dashboards.NewProvisioningService()})
	serviceGraph.Provide(&inject.Object{Value: api.NewRouteRegister(middleware.RequestMetrics, middleware.RequestTracing)})
	serviceGraph.Provide(&inject.Object{Value: api.HTTPServer{}})

	// self registered services
	services := registry.GetServices()

	// Add all services to dependency graph
	for _, service := range services {
		serviceGraph.Provide(&inject.Object{Value: service})
	}

	serviceGraph.Provide(&inject.Object{Value: g})

	// Inject dependencies to services
	if err := serviceGraph.Populate(); err != nil {
		return fmt.Errorf("Failed to populate service dependency: %v", err)
	}

	// Init & start services
	for _, service := range services {
		if registry.IsDisabled(service) {
			continue
		}

		g.log.Info("Initializing " + reflect.TypeOf(service).Elem().Name())

		if err := service.Init(); err != nil {
			return fmt.Errorf("Service init failed %v", err)
		}
	}

	// Start background services
	for index := range services {
		service, ok := services[index].(registry.BackgroundService)
		if !ok {
			continue
		}

		if registry.IsDisabled(services[index]) {
			continue
		}

		g.childRoutines.Go(func() error {
			err := service.Run(g.context)
			g.log.Info("Stopped "+reflect.TypeOf(service).Elem().Name(), "reason", err)
			return err
		})
	}

	sendSystemdNotification("READY=1")
	return g.startHttpServer()
}

func (g *GrafanaServerImpl) loadConfiguration() {
	err := g.cfg.Load(&setting.CommandLineArgs{
		Config:   *configFile,
		HomePath: *homePath,
		Args:     flag.Args(),
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to start grafana. error: %s\n", err.Error())
		os.Exit(1)
	}

	g.log.Info("Starting "+setting.ApplicationName, "version", version, "commit", commit, "compiled", time.Unix(setting.BuildStamp, 0))
	g.cfg.LogConfigSources()
}

func (g *GrafanaServerImpl) startHttpServer() error {
	g.HttpServer.Init()

	err := g.HttpServer.Start(g.context)

	if err != nil {
		return fmt.Errorf("Fail to start server. error: %v", err)
	}

	return nil
}

func (g *GrafanaServerImpl) Shutdown(code int, reason string) {
	g.log.Info("Shutdown started", "code", code, "reason", reason)

	// call cancel func on root context
	g.shutdownFn()

	// wait for child routines
	if err := g.childRoutines.Wait(); err != nil && err != context.Canceled {
		g.log.Error("Server shutdown completed", "error", err)
	}
}

func (g *GrafanaServerImpl) writePIDFile() {
	if *pidFile == "" {
		return
	}

	// Ensure the required directory structure exists.
	err := os.MkdirAll(filepath.Dir(*pidFile), 0700)
	if err != nil {
		g.log.Error("Failed to verify pid directory", "error", err)
		os.Exit(1)
	}

	// Retrieve the PID and write it.
	pid := strconv.Itoa(os.Getpid())
	if err := ioutil.WriteFile(*pidFile, []byte(pid), 0644); err != nil {
		g.log.Error("Failed to write pidfile", "error", err)
		os.Exit(1)
	}

	g.log.Info("Writing PID file", "path", *pidFile, "pid", pid)
}

func sendSystemdNotification(state string) error {
	notifySocket := os.Getenv("NOTIFY_SOCKET")

	if notifySocket == "" {
		return fmt.Errorf("NOTIFY_SOCKET environment variable empty or unset.")
	}

	socketAddr := &net.UnixAddr{
		Name: notifySocket,
		Net:  "unixgram",
	}

	conn, err := net.DialUnix(socketAddr.Net, nil, socketAddr)

	if err != nil {
		return err
	}

	_, err = conn.Write([]byte(state))

	conn.Close()

	return err
}
