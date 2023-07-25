package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/grafana/grafana/pkg/api"
	_ "github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	"github.com/grafana/grafana/pkg/modules"
	moduleRegistry "github.com/grafana/grafana/pkg/modules/registry"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

// Options contains parameters for the New function.
type Options struct {
	HomePath    string
	PidFile     string
	Version     string
	Commit      string
	BuildBranch string
	Listener    net.Listener
}

// New returns a new instance of Server.
func New(opts Options, cfg *setting.Cfg, httpServer *api.HTTPServer, roleRegistry accesscontrol.RoleRegistry,
	usageStatsProvidersRegistry registry.UsageStatsProvidersRegistry, statsCollectorService *statscollector.Service,
	moduleService modules.Engine,
	_ moduleRegistry.Registry, // imported to invoke initialization via Wire
) (*Server, error) {
	statsCollectorService.RegisterProviders(usageStatsProvidersRegistry.GetServices())
	s, err := newServer(opts, cfg, httpServer, roleRegistry, moduleService)
	if err != nil {
		return nil, err
	}

	if err = s.init(context.Background()); err != nil {
		return nil, err
	}

	return s, nil
}

func newServer(opts Options, cfg *setting.Cfg, httpServer *api.HTTPServer, roleRegistry accesscontrol.RoleRegistry,
	moduleService modules.Engine) (*Server, error) {
	return &Server{
		HTTPServer:       httpServer,
		roleRegistry:     roleRegistry,
		shutdownFinished: make(chan struct{}),
		log:              log.New("server"),
		cfg:              cfg,
		pidFile:          opts.PidFile,
		version:          opts.Version,
		commit:           opts.Commit,
		buildBranch:      opts.BuildBranch,
		moduleService:    moduleService,
	}, nil
}

// Server is responsible for managing the lifecycle of services.
type Server struct {
	log              log.Logger
	cfg              *setting.Cfg
	shutdownOnce     sync.Once
	shutdownFinished chan struct{}
	isInitialized    bool
	mtx              sync.Mutex

	pidFile     string
	version     string
	commit      string
	buildBranch string

	HTTPServer    *api.HTTPServer
	roleRegistry  accesscontrol.RoleRegistry
	moduleService modules.Engine
}

// init initializes the server and its services.
func (s *Server) init(ctx context.Context) error {
	s.mtx.Lock()
	defer s.mtx.Unlock()

	if s.isInitialized {
		return nil
	}
	s.isInitialized = true

	if err := s.writePIDFile(); err != nil {
		return err
	}

	// Initialize dskit modules.
	if err := s.moduleService.Init(ctx); err != nil {
		return err
	}

	if err := metrics.SetEnvironmentInformation(s.cfg.MetricsGrafanaEnvironmentInfo); err != nil {
		return err
	}

	return s.roleRegistry.RegisterFixedRoles(ctx)
}

// AwaitHealthy waits for the server to become healthy.
func (s *Server) AwaitHealthy(ctx context.Context) error {
	return s.moduleService.AwaitHealthy(ctx)
}

// Run initializes and starts services. This will block until all services have
// exited. To initiate shutdown, call the Shutdown method in another goroutine.
func (s *Server) Run(ctx context.Context) error {
	defer close(s.shutdownFinished)

	if err := s.init(ctx); err != nil {
		return err
	}

	err := s.moduleService.Run(ctx)
	if err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	return nil
}

// Shutdown initiates Grafana graceful shutdown. This shuts down all
// running background services. Since Run blocks Shutdown supposed to
// be run from a separate goroutine.
func (s *Server) Shutdown(ctx context.Context, reason string) error {
	var err error
	s.shutdownOnce.Do(func() {
		s.log.Info("Shutdown started", "reason", reason)
		if err = s.moduleService.Shutdown(ctx); err != nil {
			s.log.Error("Failed to shutdown modules", "error", err)
		}
		// Wait for server to shut down
		select {
		case <-s.shutdownFinished:
			s.log.Debug("Finished waiting for server to shut down")
		case <-ctx.Done():
			s.log.Warn("Timed out while waiting for server to shut down")
			err = fmt.Errorf("timeout waiting for shutdown")
		}
	})

	return err
}

// writePIDFile retrieves the current process ID and writes it to file.
func (s *Server) writePIDFile() error {
	if s.pidFile == "" {
		return nil
	}

	// Ensure the required directory structure exists.
	err := os.MkdirAll(filepath.Dir(s.pidFile), 0700)
	if err != nil {
		s.log.Error("Failed to verify pid directory", "error", err)
		return fmt.Errorf("failed to verify pid directory: %s", err)
	}

	// Retrieve the PID and write it to file.
	pid := strconv.Itoa(os.Getpid())
	if err := os.WriteFile(s.pidFile, []byte(pid), 0644); err != nil {
		s.log.Error("Failed to write pidfile", "error", err)
		return fmt.Errorf("failed to write pidfile: %s", err)
	}

	s.log.Info("Writing PID file", "path", s.pidFile, "pid", pid)
	return nil
}
