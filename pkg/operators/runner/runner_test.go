package runner

import (
	"context"
	"errors"
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
}
