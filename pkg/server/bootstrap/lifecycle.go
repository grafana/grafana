package bootstrap

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/process"
)

// shutdownTimeout bounds how long a graceful shutdown may take after a
// SIGINT/SIGTERM before the process gives up waiting on the server.
const shutdownTimeout = 30 * time.Second

// gserver is the small surface bootstrap needs from a running server or module
// server to drive graceful shutdown. Both *server.Server and
// *server.ModuleServer satisfy it.
type gserver interface {
	Shutdown(context.Context, string) error
}

// listenToSystemSignals blocks until an interrupt or termination signal is
// received, then triggers a graceful shutdown bounded by shutdownTimeout. SIGHUP
// reloads the loggers without shutting down.
func listenToSystemSignals(ctx context.Context, s gserver) {
	signalChan := make(chan os.Signal, 1)
	sighupChan := make(chan os.Signal, 1)

	signal.Notify(sighupChan, syscall.SIGHUP)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case <-sighupChan:
			if err := log.Reload(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to reload loggers: %s\n", err)
			}
		case sig := <-signalChan:
			ctx, cancel := context.WithTimeout(ctx, shutdownTimeout)
			defer cancel()
			if err := s.Shutdown(ctx, fmt.Sprintf("System signal: %s", sig)); err != nil {
				fmt.Fprintf(os.Stderr, "Timed out waiting for server to shut down\n")
			}
			return
		}
	}
}

// checkPrivileges warns on stderr when Grafana is running with elevated
// privileges, which is not recommended.
func checkPrivileges() {
	elevated, err := process.IsRunningWithElevatedPrivileges()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error checking server process execution privilege. error: %s\n", err.Error())
	}
	if elevated {
		fmt.Println("Grafana server is running with elevated privileges. This is not recommended")
	}
}

// recoverAndLog logs a panic (with stack trace) to Grafana's log files before
// re-panicking. It is the last place a crash can be recorded somewhere other
// than stderr, which operators may not be watching. Call it via defer.
func recoverAndLog(logger log.Logger) {
	if r := recover(); r != nil {
		reason := fmt.Sprintf("%v", r)
		logger.Error("Critical error", "reason", reason, "stackTrace", string(debug.Stack()))
		panic(r)
	}
}
