package server

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	_ "github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/server/modules"
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
func New(opts Options, cfg *setting.Cfg, moduleService *modules.Modules) (*Server, error) {
	s := newServer(opts, cfg, moduleService)

	if err := s.init(context.Background()); err != nil {
		return nil, err
	}

	return s, nil
}

func newServer(opts Options, cfg *setting.Cfg, modulesEngine modules.Engine) *Server {
	return &Server{
		log:              log.New("server"),
		cfg:              cfg,
		shutdownFinished: make(chan struct{}),
		pidFile:          opts.PidFile,
		modulesEngine:    modulesEngine,
	}
}

// Server is responsible for managing the lifecycle of services.
type Server struct {
	modulesEngine    modules.Engine
	log              log.Logger
	cfg              *setting.Cfg
	shutdownOnce     sync.Once
	isInitialized    bool
	mtx              sync.Mutex
	pidFile          string
	shutdownFinished chan struct{}
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

	if err := metrics.SetEnvironmentInformation(s.cfg.MetricsGrafanaEnvironmentInfo); err != nil {
		return err
	}

	return s.modulesEngine.Init(ctx)
}

// Run initializes and starts services. This will block until all services have
// exited. To initiate shutdown, call the Shutdown method in another goroutine.
func (s *Server) Run(ctx context.Context) error {
	defer close(s.shutdownFinished)
	if err := s.init(ctx); err != nil {
		return err
	}

	s.notifySystemd("READY=1")

	s.log.Debug("Waiting on services...")
	return s.modulesEngine.Run(ctx)
}

// Shutdown initiates Grafana graceful shutdown. This shuts down all
// running background services. Since Run blocks Shutdown supposed to
// be run from a separate goroutine.
func (s *Server) Shutdown(ctx context.Context, reason string) error {
	var err error
	s.shutdownOnce.Do(func() {
		s.log.Info("Shutdown started", "reason", reason)

		if err = s.modulesEngine.Shutdown(ctx); err != nil {
			s.log.Error("Failed to stop modules", "error", err)
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
