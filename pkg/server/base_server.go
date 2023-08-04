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

	"golang.org/x/sync/errgroup"

	_ "github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/setting"
)

// NewBase returns an instances of a BaseServer, responsible for managing dskit modules (services).
// TODO: rename to something dskittier.
func NewBase(opts Options, cfg *setting.Cfg,
	moduleService modules.Engine,
) (*BaseServer, error) {
	s, err := newBaseServer(opts, cfg, moduleService)
	if err != nil {
		return nil, err
	}

	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newBaseServer(opts Options, cfg *setting.Cfg,
	moduleService modules.Engine,
) (*BaseServer, error) {
	rootCtx, shutdownFn := context.WithCancel(context.Background())
	childRoutines, childCtx := errgroup.WithContext(rootCtx)

	s := &BaseServer{
		context:          childCtx,
		childRoutines:    childRoutines,
		shutdownFn:       shutdownFn,
		shutdownFinished: make(chan struct{}),
		log:              log.New("base-server"),
		cfg:              cfg,
		pidFile:          opts.PidFile,
		version:          opts.Version,
		commit:           opts.Commit,
		buildBranch:      opts.BuildBranch,
		moduleService:    moduleService,
	}

	return s, nil
}

// BaseServer is responsible for managing the lifecycle of services. The
// BaseServer does not include the HTTP server.
type BaseServer struct {
	context          context.Context
	shutdownFn       context.CancelFunc
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

	moduleService modules.Engine
}

// init initializes the server and its services.
func (s *BaseServer) init() error {
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
	return s.moduleService.Init(s.context)
}

// Run initializes and starts services. This will block until all services have
// exited. To initiate shutdown, call the Shutdown method in another goroutine.
func (s *BaseServer) Run() error {
	defer close(s.shutdownFinished)

	if err := s.init(); err != nil {
		return err
	}

	// Start dskit modules.
	s.childRoutines.Go(func() error {
		err := s.moduleService.Run(s.context)
		if err != nil && !errors.Is(err, context.Canceled) {
			return err
		}
		return nil
	})

	s.notifySystemd("READY=1")
	s.log.Debug("Waiting on services...")
	return s.childRoutines.Wait()
}

// Shutdown initiates Grafana graceful shutdown. This shuts down all
// running background services. Since Run blocks Shutdown supposed to
// be run from a separate goroutine.
func (s *BaseServer) Shutdown(ctx context.Context, reason string) error {
	var err error
	s.shutdownOnce.Do(func() {
		s.log.Info("Shutdown started", "reason", reason)
		if err := s.moduleService.Shutdown(ctx); err != nil {
			s.log.Error("Failed to shutdown modules", "error", err)
		}
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
func (s *BaseServer) writePIDFile() error {
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
func (s *BaseServer) notifySystemd(state string) {
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
