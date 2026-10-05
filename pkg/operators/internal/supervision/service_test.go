package supervision

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
)

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}

func TestWatch(t *testing.T) {
	failure := errors.New("subscriber failed")
	for _, phase := range []string{"startup", "running"} {
		t.Run(phase+" failure cancels operator", func(t *testing.T) {
			fail := make(chan struct{})
			svc := services.NewBasicService(func(context.Context) error {
				if phase == "startup" {
					return failure
				}
				return nil
			}, func(ctx context.Context) error {
				select {
				case <-fail:
					return failure
				case <-ctx.Done():
					return nil
				}
			}, nil)
			ctx, stop := Watch(t.Context(), svc)
			defer func() { require.ErrorIs(t, stop(), failure) }()
			if phase == "startup" {
				require.Error(t, services.StartAndAwaitRunning(ctx, svc))
			} else {
				require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
				close(fail)
			}
			select {
			case <-ctx.Done():
				require.ErrorIs(t, context.Cause(ctx), failure)
			case <-time.After(time.Second):
				t.Fatal("service failure did not cancel operator")
			}
			controllerErr := errors.New("controller failed")
			result := errors.Join(controllerErr, stop())
			require.ErrorIs(t, result, controllerErr)
			require.ErrorIs(t, result, failure)
		})
	}

	for name, started := range map[string]bool{"cleanup before startup": false, "normal shutdown": true} {
		t.Run(name, func(t *testing.T) {
			svc := services.NewIdleService(nil, nil)
			ctx, stop := Watch(t.Context(), svc)
			if started {
				require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
			}
			require.NoError(t, stop())
			require.ErrorIs(t, ctx.Err(), context.Canceled)
			require.Equal(t, services.Terminated, svc.State())
			require.Nil(t, svc.FailureCase())
		})
	}

	t.Run("parent cancellation", func(t *testing.T) {
		parent, cancel := context.WithCancel(t.Context())
		defer cancel()
		svc := services.NewIdleService(nil, nil)
		ctx, stop := Watch(parent, svc)
		defer func() { require.NoError(t, stop()) }()
		require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
		cancel()
		stoppedCtx, stoppedCancel := context.WithTimeout(t.Context(), time.Second)
		defer stoppedCancel()
		require.NoError(t, svc.AwaitTerminated(stoppedCtx))
		require.ErrorIs(t, context.Cause(ctx), context.Canceled)
	})
}
