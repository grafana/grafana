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
			ctx, stop := watch(t.Context(), svc)
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
			ctx, stop := watch(t.Context(), svc)
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
		ctx, stop := watch(parent, svc)
		defer func() { require.NoError(t, stop()) }()
		require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
		cancel()
		stoppedCtx, stoppedCancel := context.WithTimeout(t.Context(), time.Second)
		defer stoppedCancel()
		require.NoError(t, svc.AwaitTerminated(stoppedCtx))
		require.ErrorIs(t, context.Cause(ctx), context.Canceled)
	})
}

func TestStart(t *testing.T) {
	t.Run("startup failure is reported and stop still cleans up", func(t *testing.T) {
		failure := errors.New("subscriber failed")
		svc := services.NewBasicService(func(context.Context) error { return failure }, func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}, nil)
		ctx, stop, err := Start(t.Context(), svc)
		require.ErrorIs(t, err, failure)
		<-ctx.Done()
		require.ErrorIs(t, context.Cause(ctx), failure)
		require.ErrorIs(t, stop(), failure)
	})

	t.Run("running service is stopped on stop", func(t *testing.T) {
		svc := services.NewIdleService(nil, nil)
		ctx, stop, err := Start(t.Context(), svc)
		require.NoError(t, err)
		require.Equal(t, services.Running, svc.State())
		require.NoError(t, ctx.Err())
		require.NoError(t, stop())
		require.Equal(t, services.Terminated, svc.State())
	})
}

func TestStart_MultipleServices(t *testing.T) {
	t.Run("a later startup failure still stops the services already started", func(t *testing.T) {
		failure := errors.New("manifest watcher failed")
		first := services.NewIdleService(nil, nil)
		second := services.NewBasicService(func(context.Context) error { return failure }, func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}, nil)

		_, stop, err := Start(t.Context(), first, second)
		require.ErrorIs(t, err, failure)
		require.ErrorIs(t, stop(), failure)
		require.Equal(t, services.Terminated, first.State())
	})

	t.Run("a running failure cancels the operator and stop reports it", func(t *testing.T) {
		failure := errors.New("subscriber failed")
		fail := make(chan struct{})
		failing := services.NewBasicService(nil, func(ctx context.Context) error {
			select {
			case <-fail:
				return failure
			case <-ctx.Done():
				return nil
			}
		}, nil)
		healthy := services.NewIdleService(nil, nil)

		ctx, stop, err := Start(t.Context(), failing, healthy)
		require.NoError(t, err)
		close(fail)
		select {
		case <-ctx.Done():
			require.ErrorIs(t, context.Cause(ctx), failure)
		case <-time.After(time.Second):
			t.Fatal("service failure did not cancel operator")
		}
		require.ErrorIs(t, stop(), failure)
		require.Equal(t, services.Terminated, healthy.State())
	})

	t.Run("stops services in reverse start order", func(t *testing.T) {
		var stopped []string
		newService := func(name string) services.Service {
			return services.NewIdleService(nil, func(error) error {
				stopped = append(stopped, name)
				return nil
			})
		}

		_, stop, err := Start(t.Context(), newService("subscriber"), newService("watcher"))
		require.NoError(t, err)
		require.NoError(t, stop())
		require.Equal(t, []string{"watcher", "subscriber"}, stopped)
	})

	t.Run("no services", func(t *testing.T) {
		ctx, stop, err := Start(t.Context())
		require.NoError(t, err)
		require.NoError(t, ctx.Err())
		require.NoError(t, stop())
	})
}
