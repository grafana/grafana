package server

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/frontend"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

// NewModule returns an instance of a ModuleServer, responsible for managing
// dskit modules (services).
func NewModule(opts Options,
	apiOpts api.ServerOptions,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	promGatherer prometheus.Gatherer,
	license licensing.Licensing,
) (*ModuleServer, error) {
	s, err := newModuleServer(opts, apiOpts, features, cfg, storageMetrics, indexMetrics, promGatherer, license)
	if err != nil {
		return nil, err
	}

	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newModuleServer(opts Options, apiOpts api.ServerOptions, features featuremgmt.FeatureToggles, cfg *setting.Cfg, storageMetrics *resource.StorageMetrics, indexMetrics *resource.BleveIndexMetrics, promGatherer prometheus.Gatherer, license licensing.Licensing) (*ModuleServer, error) {
	rootCtx, shutdownFn := context.WithCancel(context.Background())

	s := &ModuleServer{
		opts:             opts,
		apiOpts:          apiOpts,
		context:          rootCtx,
		shutdownFn:       shutdownFn,
		shutdownFinished: make(chan struct{}),
		log:              log.New("base-server"),
		features:         features,
		cfg:              cfg,
		pidFile:          opts.PidFile,
		version:          opts.Version,
		commit:           opts.Commit,
		buildBranch:      opts.BuildBranch,
		storageMetrics:   storageMetrics,
		indexMetrics:     indexMetrics,
		promGatherer:     promGatherer,
		license:          license,
	}

	return s, nil
}

// ModuleServer is responsible for managing the lifecycle of dskit services. The
// ModuleServer has the minimal set of dependencies to launch dskit services,
// but it can be used to launch the entire Grafana server.
type ModuleServer struct {
	opts    Options
	apiOpts api.ServerOptions

	features         featuremgmt.FeatureToggles
	context          context.Context
	shutdownFn       context.CancelFunc
	log              log.Logger
	cfg              *setting.Cfg
	shutdownOnce     sync.Once
	shutdownFinished chan struct{}
	isInitialized    bool
	mtx              sync.Mutex
	storageMetrics   *resource.StorageMetrics
	indexMetrics     *resource.BleveIndexMetrics
	license          licensing.Licensing

	pidFile     string
	version     string
	commit      string
	buildBranch string

	promGatherer prometheus.Gatherer
}

// init initializes the server and its services.
func (s *ModuleServer) init() error {
	s.mtx.Lock()
	defer s.mtx.Unlock()

	if s.isInitialized {
		return nil
	}
	s.isInitialized = true

	if err := s.writePIDFile(); err != nil {
		return err
	}

	return nil
}

// Run initializes and starts services. This will block until all services have
// exited. To initiate shutdown, call the Shutdown method in another goroutine.
func (s *ModuleServer) Run() error {
	defer close(s.shutdownFinished)

	if err := s.init(); err != nil {
		return err
	}

	s.notifySystemd("READY=1")
	s.log.Debug("Waiting on services...")

	m := modules.New(s.cfg.Target)

	// only run the instrumentation server module if were not running a module that already contains an http server
	m.RegisterInvisibleModule(modules.InstrumentationServer, func() (services.Service, error) {
		if m.IsModuleEnabled(modules.All) || m.IsModuleEnabled(modules.Core) || m.IsModuleEnabled(modules.FrontendServer) {
			return services.NewBasicService(nil, nil, nil).WithName(modules.InstrumentationServer), nil
		}
		return NewInstrumentationService(s.log, s.cfg, s.promGatherer)
	})

	m.RegisterModule(modules.Core, func() (services.Service, error) {
		return NewService(s.cfg, s.opts, s.apiOpts)
	})

	// TODO: uncomment this once the apiserver is ready to be run as a standalone target
	//if s.features.IsEnabled(featuremgmt.FlagGrafanaAPIServer) {
	//	m.RegisterModule(modules.GrafanaAPIServer, func() (services.Service, error) {
	//		return grafanaapiserver.New(path.Join(s.cfg.DataPath, "k8s"))
	//	})
	//} else {
	//	s.log.Debug("apiserver feature is disabled")
	//}

	m.RegisterModule(modules.StorageServer, func() (services.Service, error) {
		docBuilders, err := InitializeDocumentBuilders(s.cfg)
		if err != nil {
			return nil, err
		}
		return sql.ProvideUnifiedStorageGrpcService(s.cfg, s.features, nil, s.log, nil, docBuilders, s.storageMetrics, s.indexMetrics)
	})

	m.RegisterModule(modules.ZanzanaServer, func() (services.Service, error) {
		return authz.ProvideZanzanaService(s.cfg, s.features)
	})

	m.RegisterModule(modules.FrontendServer, func() (services.Service, error) {
		return frontend.ProvideFrontendService(s.cfg, s.promGatherer, s.license)
	})

	m.RegisterModule(modules.All, nil)

	return m.Run(s.context)
}

// Shutdown initiates Grafana graceful shutdown. This shuts down all
// running background services. Since Run blocks Shutdown supposed to
// be run from a separate goroutine.
func (s *ModuleServer) Shutdown(ctx context.Context, reason string) error {
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
func (s *ModuleServer) writePIDFile() error {
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
func (s *ModuleServer) notifySystemd(state string) {
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
