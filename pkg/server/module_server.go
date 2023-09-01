package server

import (
	"context"
	"fmt"
	"net"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/featuremgmt"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

// NewModule returns an instance of a ModuleServer, responsible for managing
// dskit modules (services).
func NewModule(opts Options, apiOpts api.ServerOptions, features featuremgmt.FeatureToggles, cfg *setting.Cfg) (*ModuleServer, error) {
	s, err := newModuleServer(opts, apiOpts, features, cfg)
	if err != nil {
		return nil, err
	}

	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newModuleServer(opts Options, apiOpts api.ServerOptions, features featuremgmt.FeatureToggles, cfg *setting.Cfg) (*ModuleServer, error) {
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

	pidFile     string
	version     string
	commit      string
	buildBranch string
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

	// Only allow individual dskit modules to run in dev mode.
	if s.cfg.Env != "dev" {
		if len(s.cfg.Target) > 1 || s.cfg.Target[0] != "all" {
			s.log.Error("dskit module targeting is only supported in dev mode. Falling back to 'all'")
			s.cfg.Target = []string{"all"}
		}
	}

	m := modules.New(s.cfg.Target)

	m.RegisterModule(modules.Core, func() (services.Service, error) {
		return NewService(s.cfg, s.opts, s.apiOpts)
	})

	if s.features.IsEnabled(featuremgmt.FlagGrafanaAPIServer) {
		m.RegisterModule(modules.GrafanaAPIServer, func() (services.Service, error) {
			return grafanaapiserver.New(path.Join(s.cfg.DataPath, "k8s"))
		})
	} else {
		s.log.Debug("apiserver feature is disabled")
	}

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
