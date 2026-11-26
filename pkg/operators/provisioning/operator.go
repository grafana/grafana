package provisioning

import (
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

func newOperatorLogger(name string) logging.Logger {
	return logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", name)
}

// awaitShutdown waits for the operator's goroutines to finish, giving up after
// timeout so a stuck goroutine cannot block the process from exiting.
func awaitShutdown(logger logging.Logger, wg *sync.WaitGroup, timeout time.Duration) {
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.Info("operator shutdown complete")
	case <-time.After(timeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", timeout)
	}
}
