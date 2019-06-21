package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/facebookgo/inject"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	_ "github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	_ "github.com/grafana/grafana/pkg/infra/metrics"
	_ "github.com/grafana/grafana/pkg/infra/remotecache"
	_ "github.com/grafana/grafana/pkg/infra/serverlock"
	_ "github.com/grafana/grafana/pkg/infra/tracing"
	_ "github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/middleware"
	_ "github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	_ "github.com/grafana/grafana/pkg/services/alerting"
	_ "github.com/grafana/grafana/pkg/services/auth"
	_ "github.com/grafana/grafana/pkg/services/cleanup"
	_ "github.com/grafana/grafana/pkg/services/notifications"
	_ "github.com/grafana/grafana/pkg/services/provisioning"
	_ "github.com/grafana/grafana/pkg/services/rendering"
	_ "github.com/grafana/grafana/pkg/services/search"
	_ "github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
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
	context            context.Context
	shutdownFn         context.CancelFunc
	childRoutines      *errgroup.Group
	log                log.Logger
	cfg                *setting.Cfg
	shutdownReason     string
	shutdownInProgress bool

	RouteRegister routing.RouteRegister `inject:""`
	HttpServer    *api.HTTPServer       `inject:""`
}

func (g *GrafanaServerImpl) Run() error {
	var err error
	g.loadConfiguration()
	g.writePIDFile()

	login.Init()
	social.NewOAuthService()

	serviceGraph := inject.Graph{}
	err = serviceGraph.Provide(&inject.Object{Value: bus.GetBus()})
	if err != nil {
		return fmt.Errorf("Failed to provide object to the graph: %v", err)
	}
	err = serviceGraph.Provide(&inject.Object{Value: g.cfg})
	if err != nil {
		return fmt.Errorf("Failed to provide object to the graph: %v", err)
	}
	err = serviceGraph.Provide(&inject.Object{Value: routing.NewRouteRegister(middleware.RequestMetrics, middleware.RequestTracing)})
	if err != nil {
		return fmt.Errorf("Failed to provide object to the graph: %v", err)
	}
	err = serviceGraph.Provide(&inject.Object{Value: localcache.New(5*time.Minute, 10*time.Minute)})
	if err != nil {
		return fmt.Errorf("Failed to provide object to the graph: %v", err)
	}

	// self registered services
	services := registry.GetServices()

	// Add all services to dependency graph
	for _, service := range services {
		err = serviceGraph.Provide(&inject.Object{Value: service.Instance})
		if err != nil {
			return fmt.Errorf("Failed to provide object to the graph: %v", err)
		}
	}

	err = serviceGraph.Provide(&inject.Object{Value: g})
	if err != nil {
		return fmt.Errorf("Failed to provide object to the graph: %v", err)
	}

	// Inject dependencies to services
	if err := serviceGraph.Populate(); err != nil {
		return fmt.Errorf("Failed to populate service dependency: %v", err)
	}

	// Init & start services
	for _, service := range services {
		if registry.IsDisabled(service.Instance) {
			continue
		}

		g.log.Info("Initializing " + service.Name)

		if err := service.Instance.Init(); err != nil {
			return fmt.Errorf("Service init failed: %v", err)
		}
	}

	// Start background services
	for _, srv := range services {
		// variable needed for accessing loop variable in function callback
		descriptor := srv
		service, ok := srv.Instance.(registry.BackgroundService)
		if !ok {
			continue
		}

		if registry.IsDisabled(descriptor.Instance) {
			continue
		}

		g.childRoutines.Go(func() error {
			// Skip starting new service when shutting down
			// Can happen when service stop/return during startup
			if g.shutdownInProgress {
				return nil
			}

			err := service.Run(g.context)

			// If error is not canceled then the service crashed
			if err != context.Canceled && err != nil {
				g.log.Error("Stopped "+descriptor.Name, "reason", err)
			} else {
				g.log.Info("Stopped "+descriptor.Name, "reason", err)
			}

			// Mark that we are in shutdown mode
			// So more services are not started
			g.shutdownInProgress = true
			return err
		})
	}

	sendSystemdNotification("READY=1")

	return g.childRoutines.Wait()
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

	g.log.Info("Starting "+setting.ApplicationName, "version", version, "commit", commit, "branch", buildBranch, "compiled", time.Unix(setting.BuildStamp, 0))
	g.cfg.LogConfigSources()
}

func (g *GrafanaServerImpl) Shutdown(reason string) {
	g.log.Info("Shutdown started", "reason", reason)
	g.shutdownReason = reason
	g.shutdownInProgress = true

	// call cancel func on root context
	g.shutdownFn()

	// wait for child routines
	g.childRoutines.Wait()
}

func (g *GrafanaServerImpl) Exit(reason error) int {
	// default exit code is 1
	code := 1

	if reason == context.Canceled && g.shutdownReason != "" {
		reason = fmt.Errorf(g.shutdownReason)
		code = 0
	}

	g.log.Error("Server shutdown", "reason", reason)
	return code
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
		return fmt.Errorf("NOTIFY_SOCKET environment variable empty or unset")
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
