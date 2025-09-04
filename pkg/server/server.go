package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"sync"

	"github.com/grafana/dskit/modules"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api"
	_ "github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats/statscollector"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs/adapter"
	"github.com/grafana/grafana/pkg/semconv"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
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
	provisioningService provisioning.ProvisioningService, backgroundServiceProvider registry.BackgroundServiceRegistry,
	usageStatsProvidersRegistry registry.UsageStatsProvidersRegistry, statsCollectorService *statscollector.Service,
	tracerProvider *tracing.TracingService,
	promReg prometheus.Registerer,
) (*Server, error) {
	statsCollectorService.RegisterProviders(usageStatsProvidersRegistry.GetServices())
	s, err := newServer(opts, cfg, httpServer, roleRegistry, provisioningService, backgroundServiceProvider, tracerProvider, promReg)
	if err != nil {
		return nil, err
	}

	if err := s.Init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newServer(opts Options, cfg *setting.Cfg, httpServer *api.HTTPServer, roleRegistry accesscontrol.RoleRegistry,
	provisioningService provisioning.ProvisioningService, backgroundServiceProvider registry.BackgroundServiceRegistry,
	tracerProvider *tracing.TracingService,
	promReg prometheus.Registerer,
) (*Server, error) {
	rootCtx, shutdownFn := context.WithCancel(context.Background())
	childRoutines, childCtx := errgroup.WithContext(rootCtx)

	s := &Server{
		promReg:                   promReg,
		context:                   childCtx,
		childRoutines:             childRoutines,
		HTTPServer:                httpServer,
		provisioningService:       provisioningService,
		roleRegistry:              roleRegistry,
		shutdownFn:                shutdownFn,
		shutdownFinished:          make(chan struct{}),
		log:                       log.New("server"),
		cfg:                       cfg,
		pidFile:                   opts.PidFile,
		version:                   opts.Version,
		commit:                    opts.Commit,
		buildBranch:               opts.BuildBranch,
		backgroundServiceRegistry: backgroundServiceProvider,
		tracerProvider:            tracerProvider,
	}

	return s, nil
}

// Server is responsible for managing the lifecycle of services. This is the
// core Server implementation which starts the entire Grafana server. Use
// ModuleServer to launch specific modules.
type Server struct {
	context          context.Context
	shutdownFn       func()
	childRoutines    *errgroup.Group
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

	backgroundServiceRegistry registry.BackgroundServiceRegistry
	tracerProvider            *tracing.TracingService

	HTTPServer          *api.HTTPServer
	roleRegistry        accesscontrol.RoleRegistry
	provisioningService provisioning.ProvisioningService
	promReg             prometheus.Registerer
}

// Init initializes the server and its services.
func (s *Server) Init() error {
	s.mtx.Lock()
	defer s.mtx.Unlock()

	if s.isInitialized {
		return nil
	}
	s.isInitialized = true

	if err := s.writePIDFile(); err != nil {
		return err
	}

	if err := metrics.SetEnvironmentInformation(s.promReg, s.cfg.MetricsGrafanaEnvironmentInfo); err != nil {
		return err
	}

	if err := s.roleRegistry.RegisterFixedRoles(s.context); err != nil {
		return err
	}

	return s.provisioningService.RunInitProvisioners(s.context)
}

func (s *Server) Run() error {
	if s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagDskitBackgroundServices) {
		s.log.Debug("Running background services with dskit wrapper")
		return s.dskitRun()
	}
	s.log.Debug("Running standard background services")
	return s.backgroundServicesRun()
}

func (s *Server) dskitRun() error {
	if err := s.Init(); err != nil {
		return err
	}
	managerAdapter := adapter.NewManagerAdapter(s.backgroundServiceRegistry)
	s.notifySystemd("READY=1")

	ctx, span := s.tracerProvider.Start(s.context, "server.dskitRun")
	defer span.End()

	cancelFn := s.shutdownFn
	s.shutdownFn = func() {
		defer close(s.shutdownFinished)
		s.log.Debug("Shutting down background services")
		if err := managerAdapter.Shutdown(s.context, modules.ErrStopProcess.Error()); err != nil {
			s.log.Error("Failed to shutdown background services", "error", err)
		}
		s.log.Debug("Background services shutdown complete")
		cancelFn()
	}

	return managerAdapter.Run(ctx)
}

func (s *Server) backgroundServicesRun() error {
	ctx, span := s.tracerProvider.Start(s.context, "server.backgroundServicesRun")
	defer span.End()
	defer close(s.shutdownFinished)

	if err := s.Init(); err != nil {
		return err
	}

	services := s.backgroundServiceRegistry.GetServices()

	// Start background services.
	for _, svc := range services {
		if registry.IsDisabled(svc) {
			continue
		}

		service := svc
		serviceName := reflect.TypeOf(service).String()
		s.childRoutines.Go(func() error {
			select {
			case <-s.context.Done():
				return s.context.Err()
			default:
			}
			s.log.Debug("Starting background service", "service", serviceName)
			span.AddEvent(fmt.Sprintf("%s start", serviceName), trace.WithAttributes(semconv.GrafanaServiceName(serviceName)))
			err := service.Run(ctx)
			// Do not return context.Canceled error since errgroup.Group only
			// returns the first error to the caller - thus we can miss a more
			// interesting error.
			if err != nil && !errors.Is(err, context.Canceled) {
				s.log.Error("Stopped background service", "service", serviceName, "reason", err)
				return fmt.Errorf("%s run error: %w", serviceName, err)
			}
			s.log.Debug("Stopped background service", "service", serviceName, "reason", err)
			return nil
		})
	}

	s.notifySystemd("READY=1")

	s.log.Debug("Waiting on services...")
	return s.childRoutines.Wait()
}

// Shutdown initiates Grafana graceful shutdown. This shuts down all
// running background services. Since Run blocks Shutdown supposed to
// be run from a separate goroutine.
func (s *Server) Shutdown(ctx context.Context, reason string) error {
	var err error
	s.shutdownOnce.Do(func() {
		s.log.Info("Shutdown started", "reason", reason)
		// Call cancel func to stop background services.
		s.shutdownFn()
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

// notifySystemd sends state notifications to systemd.
func (s *Server) notifySystemd(state string) {
	notifySocket := os.Getenv("NOTIFY_SOCKET")
	if notifySocket == "" {
		s.log.Debug(
			"NOTIFY_SOCKET environment variable empty or unset, can't send systemd notification")
		return
	}

	socketAddr := &net.UnixAddr{
		Name: notifySocket,
		Net:  "unixgram",
	}
	conn, err := net.DialUnix(socketAddr.Net, nil, socketAddr)
	if err != nil {
		s.log.Warn("Failed to connect to systemd", "err", err, "socket", notifySocket)
		return
	}
	defer func() {
		if err := conn.Close(); err != nil {
			s.log.Warn("Failed to close connection", "err", err)
		}
	}()

	_, err = conn.Write([]byte(state))
	if err != nil {
		s.log.Warn("Failed to write notification to systemd", "err", err)
	}
}
