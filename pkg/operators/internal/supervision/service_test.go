package supervision

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
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

	t.Run("stops services one at a time in reverse start order", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svcs := newBlockingServices("subscriber", "watcher", "controller")
			_, stop, err := Start(t.Context(), svcs.services()...)
			require.NoError(t, err)

			stopErr := make(chan error, 1)
			go func() { stopErr <- stop() }()
			svcs.requireStoppedInOrder(t, "controller", "watcher", "subscriber")
			require.NoError(t, <-stopErr)
		})
	})

	t.Run("parent cancellation leaves services running until stop", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			parent, cancel := context.WithCancel(t.Context())
			svcs := newBlockingServices("subscriber", "watcher", "controller")
			ctx, stop, err := Start(parent, svcs.services()...)
			require.NoError(t, err)

			cancel()
			synctest.Wait()
			require.ErrorIs(t, ctx.Err(), context.Canceled)
			for _, svc := range svcs.services() {
				require.Equal(t, services.Running, svc.State())
			}

			stopErr := make(chan error, 1)
			go func() { stopErr <- stop() }()
			svcs.requireStoppedInOrder(t, "controller", "watcher", "subscriber")
			require.NoError(t, <-stopErr)
		})
	})

	t.Run("no services", func(t *testing.T) {
		ctx, stop, err := Start(t.Context())
		require.NoError(t, err)
		require.NoError(t, ctx.Err())
		require.NoError(t, stop())
	})
}

// blockingServices run until their context is cancelled, then block in their
// stopping function until released, so a test can see which ones are stopping.
type blockingServices struct {
	names    []string
	byName   map[string]services.Service
	stopping map[string]chan struct{}
	release  map[string]chan struct{}
}

func newBlockingServices(names ...string) *blockingServices {
	b := &blockingServices{
		names:    names,
		byName:   map[string]services.Service{},
		stopping: map[string]chan struct{}{},
		release:  map[string]chan struct{}{},
	}
	for _, name := range names {
		stopping, release := make(chan struct{}), make(chan struct{})
		b.stopping[name], b.release[name] = stopping, release
		b.byName[name] = services.NewIdleService(nil, func(error) error {
			close(stopping)
			<-release
			return nil
		})
	}
	return b
}

func (b *blockingServices) services() []services.Service {
	svcs := make([]services.Service, 0, len(b.names))
	for _, name := range b.names {
		svcs = append(svcs, b.byName[name])
	}
	return svcs
}

// requireStoppedInOrder releases the services one at a time and requires that
// only the next one in order has started stopping each time. Call it inside a
// synctest bubble while stop runs in another goroutine.
func (b *blockingServices) requireStoppedInOrder(t *testing.T, order ...string) {
	t.Helper()
	for i, name := range order {
		synctest.Wait()
		for _, later := range order[i+1:] {
			require.False(t, isClosed(b.stopping[later]), "%s started stopping before %s finished", later, name)
		}
		require.True(t, isClosed(b.stopping[name]), "%s did not start stopping", name)
		close(b.release[name])
	}
}

func isClosed(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}
