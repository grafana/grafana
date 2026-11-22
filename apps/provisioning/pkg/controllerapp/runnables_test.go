package controllerapp

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
)

func TestLogErrorsKeepsOtherRunnablesRunning(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		app, err := New("test", logging.DefaultLogger, nil)
		require.NoError(t, err)
		app.AddRunnable(LogErrors(logging.DefaultLogger, "failing loop", func(context.Context) error {
			return errors.New("boom")
		}))
		stopped := make(chan struct{})
		app.AddRunnable(RunnableFunc(func(ctx context.Context) error {
			<-ctx.Done()
			close(stopped)
			return nil
		}))

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		synctest.Wait()

		select {
		case <-stopped:
			t.Fatal("a failed LogErrors runnable stopped the app's other runnables")
		default:
		}

		cancel()
		require.NoError(t, <-done)
		<-stopped
	})
}
