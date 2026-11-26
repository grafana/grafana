package runner

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

func testDeps() server.OperatorDependencies {
	return server.OperatorDependencies{
		Config:         setting.NewCfg(),
		Registerer:     prometheus.NewRegistry(),
		HealthNotifier: server.NewHealthNotifier(),
	}
}

func recordingService(name string, events *[]string) services.Service {
	return services.NewIdleService(
		func(context.Context) error { *events = append(*events, "start "+name); return nil },
		func(error) error { *events = append(*events, "stop "+name); return nil },
	)
}

func TestOperatorRun(t *testing.T) {
	t.Run("starts services before Run and stops them in reverse order", func(t *testing.T) {
		var events []string
		deps := testDeps()
		op := Operator{Name: "test", Build: func(rt *Runtime) (*Parts, error) {
			require.NotNil(t, rt.Logger)
			require.Same(t, deps.Config, rt.Cfg)
			return &Parts{
				Services: []services.Service{recordingService("a", &events), recordingService("b", &events)},
				Run: func(ctx context.Context, ready func()) error {
					ready()
					assert.True(t, deps.HealthNotifier.IsReady())
					events = append(events, "run")
					return nil
				},
			}, nil
		}}

		require.NoError(t, op.Run(context.Background(), deps))
		assert.Equal(t, []string{"start a", "start b", "run", "stop b", "stop a"}, events)
		assert.False(t, deps.HealthNotifier.IsReady())
	})

	t.Run("returns Build and Run errors", func(t *testing.T) {
		buildErr := errors.New("build")
		err := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) { return nil, buildErr }}.Run(context.Background(), testDeps())
		require.ErrorIs(t, err, buildErr)

		runErr := errors.New("run")
		err = Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
			return &Parts{Run: func(context.Context, func()) error { return runErr }}, nil
		}}.Run(context.Background(), testDeps())
		require.ErrorIs(t, err, runErr)
	})

	t.Run("gives up on a stuck Run after the shutdown timeout", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			stuck := make(chan struct{})
			defer close(stuck)
			op := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
				return &Parts{
					Run:             func(context.Context, func()) error { <-stuck; return nil },
					ShutdownTimeout: time.Minute,
				}, nil
			}}

			done := make(chan error, 1)
			start := time.Now()
			go func() { done <- op.Run(ctx, testDeps()) }()
			cancel()
			require.NoError(t, <-done)
			assert.Equal(t, time.Minute, time.Since(start))
		})
	})

	t.Run("leaves the subscriber nil when the operator opts out of NATS", func(t *testing.T) {
		err := Operator{Name: "test", NoNATS: true, Build: func(rt *Runtime) (*Parts, error) {
			assert.Nil(t, rt.Subscriber)
			return &Parts{Run: func(context.Context, func()) error { return nil }}, nil
		}}.Run(context.Background(), testDeps())
		require.NoError(t, err)
	})

	t.Run("reports a failed service instead of the cancellation it caused", func(t *testing.T) {
		svcErr := errors.New("subscriber lost")
		fail := make(chan struct{})
		failing := services.NewBasicService(nil, func(ctx context.Context) error {
			select {
			case <-fail:
				return svcErr
			case <-ctx.Done():
				return nil
			}
		}, nil)
		err := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
			return &Parts{
				Services: []services.Service{failing},
				Run: func(ctx context.Context, _ func()) error {
					close(fail)
					<-ctx.Done()
					return ctx.Err()
				},
			}, nil
		}}.Run(context.Background(), testDeps())
		require.ErrorIs(t, err, svcErr)
		require.NotErrorIs(t, err, context.Canceled)
	})

	t.Run("reports a failed service stop on shutdown instead of the cancellation", func(t *testing.T) {
		stopErr := errors.New("flush failed")
		ctx, cancel := context.WithCancel(context.Background())
		failingStop := services.NewIdleService(nil, func(error) error { return stopErr })
		err := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
			return &Parts{
				Services: []services.Service{failingStop},
				Run: func(ctx context.Context, _ func()) error {
					cancel()
					<-ctx.Done()
					return ctx.Err()
				},
			}, nil
		}}.Run(ctx, testDeps())
		require.ErrorIs(t, err, stopErr)
		require.NotErrorIs(t, err, context.Canceled)
	})

	t.Run("keeps a Run error alongside a failed service stop", func(t *testing.T) {
		runErr, stopErr := errors.New("run"), errors.New("flush failed")
		failingStop := services.NewIdleService(nil, func(error) error { return stopErr })
		err := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
			return &Parts{
				Services: []services.Service{failingStop},
				Run:      func(context.Context, func()) error { return runErr },
			}, nil
		}}.Run(context.Background(), testDeps())
		require.ErrorIs(t, err, runErr)
		require.ErrorIs(t, err, stopErr)
	})

	t.Run("keeps Run's cleanup error alongside a failed service", func(t *testing.T) {
		svcErr, cleanupErr := errors.New("subscriber lost"), errors.New("cleanup failed")
		fail := make(chan struct{})
		failing := services.NewBasicService(nil, func(ctx context.Context) error {
			select {
			case <-fail:
				return svcErr
			case <-ctx.Done():
				return nil
			}
		}, nil)
		err := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
			return &Parts{
				Services: []services.Service{failing},
				Run: func(ctx context.Context, _ func()) error {
					close(fail)
					<-ctx.Done()
					return errors.Join(ctx.Err(), cleanupErr)
				},
			}, nil
		}}.Run(context.Background(), testDeps())
		require.ErrorIs(t, err, svcErr)
		require.ErrorIs(t, err, cleanupErr)
		require.NotErrorIs(t, err, context.Canceled)
	})

	t.Run("ignores a ready callback that arrives after shutdown began", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			deps := testDeps()
			lateReady := make(chan struct{})
			op := Operator{Name: "test", Build: func(*Runtime) (*Parts, error) {
				return &Parts{
					Run: func(ctx context.Context, ready func()) error {
						<-ctx.Done()
						<-lateReady
						ready()
						return nil
					},
					ShutdownTimeout: time.Minute,
				}, nil
			}}

			done := make(chan error, 1)
			go func() { done <- op.Run(ctx, deps) }()
			cancel()
			require.NoError(t, <-done)
			close(lateReady)
			synctest.Wait()
			assert.False(t, deps.HealthNotifier.IsReady())
		})
	})
}

func TestJoinStopError(t *testing.T) {
	runErr, stopErr := errors.New("run"), errors.New("stop")
	wrappedCancel := fmt.Errorf("watch: %w", context.Canceled)

	tests := []struct {
		name          string
		run, stop     error
		want          []error
		wantCancelled bool
	}{
		{name: "no errors"},
		{name: "plain shutdown stays a cancellation", run: context.Canceled, wantCancelled: true},
		{name: "stop failure hidden by Run cancellation", run: context.Canceled, stop: stopErr, want: []error{stopErr}},
		{name: "Run failure hidden by stop cancellation", run: runErr, stop: wrappedCancel, want: []error{runErr}},
		{name: "Run failure joined with cancellation", run: errors.Join(runErr, context.Canceled), want: []error{runErr}},
		{name: "Run failure inside a wrapped join", run: fmt.Errorf("controller: %w", errors.Join(context.Canceled, runErr)), want: []error{runErr}},
		{name: "stop failure inside a wrapped join", run: context.Canceled, stop: fmt.Errorf("watch: %w", errors.Join(stopErr, context.Canceled)), want: []error{stopErr}},
		{name: "both failures kept", run: errors.Join(context.Canceled, runErr), stop: stopErr, want: []error{runErr, stopErr}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := joinStopError(tt.run, tt.stop)
			for _, w := range tt.want {
				require.ErrorIs(t, err, w)
			}
			assert.Equal(t, tt.wantCancelled, errors.Is(err, context.Canceled))
			if tt.want == nil && !tt.wantCancelled {
				assert.NoError(t, err)
			}
		})
	}
}

// uncomparableErr cannot be compared with ==, and its Unwrap returns nil like
// errutil.Error.
type uncomparableErr struct{ details []string }

func (e uncomparableErr) Error() string { return "uncomparable" }
func (e uncomparableErr) Unwrap() error { return nil }

func TestJoinStopErrorKeepsWrappersIntact(t *testing.T) {
	t.Run("keeps a wrapper with nothing to strip", func(t *testing.T) {
		stopErr := fmt.Errorf("stop store: %w", errors.New("flush failed"))
		err := joinStopError(context.Canceled, stopErr)
		require.ErrorIs(t, err, stopErr)
		require.NotErrorIs(t, err, context.Canceled)
		assert.Equal(t, "stop store: flush failed", err.Error())
	})

	t.Run("keeps an error whose Unwrap returns nil", func(t *testing.T) {
		stopErr := uncomparableErr{details: []string{"a"}}
		err := joinStopError(context.Canceled, stopErr)
		require.ErrorAs(t, err, new(uncomparableErr))
		require.NotErrorIs(t, err, context.Canceled)
	})

	t.Run("does not panic on uncomparable errors next to cancellation", func(t *testing.T) {
		stopErr := fmt.Errorf("stop: %w", errors.Join(uncomparableErr{details: []string{"a"}}, context.Canceled))
		var err error
		require.NotPanics(t, func() { err = joinStopError(context.Canceled, stopErr) })
		require.ErrorAs(t, err, new(uncomparableErr))
		require.NotErrorIs(t, err, context.Canceled)
		assert.Equal(t, stopErr.Error(), err.Error())
	})
}

func TestReadinessIgnoresReadyAfterContextDone(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	notifier := server.NewHealthNotifier()
	r := &readiness{ctx: ctx, notifier: notifier}

	assert.False(t, r.ready())
	assert.False(t, notifier.IsReady())
}
