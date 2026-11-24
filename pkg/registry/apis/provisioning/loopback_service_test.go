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

	t.Run("runs on the loopback config without waiting for the bootstrap repository unless asked to", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{}), bootstrapDone: make(chan struct{})}
			builder.publishLoopbackConfig(&clientrest.Config{})
			svc := newLoopbackService("test", builder, func(ctx context.Context, _ *clientrest.Config) error {
				return nil
			})

			require.NoError(t, svc.Run(t.Context()))
			require.False(t, isClosed(builder.bootstrapDone))
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
