package provisioning

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"
)

func TestLoopbackService_Run(t *testing.T) {
	t.Run("a controller failure fails the service", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			builder.publishLoopbackConfig(&clientrest.Config{})
			errController := errors.New("controller failed")
			svc := newLoopbackService("test", builder, func(context.Context, *clientrest.Config) error {
				return errController
			})

			require.ErrorIs(t, svc.Run(t.Context()), errController)
			require.Equal(t, services.Failed, svc.State())
		})
	})

	t.Run("waits for waitFor before running", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			builder.publishLoopbackConfig(&clientrest.Config{})
			ran := make(chan struct{})
			svc := newLoopbackService("test", builder, func(context.Context, *clientrest.Config) error {
				close(ran)
				return nil
			})
			waitFor := make(chan struct{})
			svc.waitFor = waitFor

			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()
			require.False(t, isClosed(ran))

			close(waitFor)
			require.NoError(t, <-runErr)
			require.True(t, isClosed(ran))
		})
	})

	t.Run("calls onStop when stopped before the API is served", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			svc := newLoopbackService("test", builder, func(context.Context, *clientrest.Config) error {
				t.Error("run must not be called before the API is served")
				return nil
			})
			stopped := make(chan struct{})
			svc.onStop = func() { close(stopped) }

			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.True(t, isClosed(stopped))
		})
	})

	t.Run("a cancellation that is not a shutdown fails the service", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			builder.publishLoopbackConfig(&clientrest.Config{})
			svc := newLoopbackService("test", builder, func(context.Context, *clientrest.Config) error {
				return context.Canceled
			})

			require.ErrorIs(t, svc.Run(t.Context()), context.Canceled)
			require.Equal(t, services.Failed, svc.State())
		})
	})
}
