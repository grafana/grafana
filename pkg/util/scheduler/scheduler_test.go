package scheduler

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestScheduler(t *testing.T) {
	t.Parallel()

	t.Run("ConfigValidation", func(t *testing.T) {
		t.Parallel()

		t.Run("ValidConfig", func(t *testing.T) {
			cfg := Config{
				NumWorkers: 5,
				MaxBackoff: 1 * time.Second,
				Logger:     log.New("qos.test"),
			}
			err := cfg.validate()
			require.NoError(t, err)
			require.NotNil(t, cfg.Logger)
		})

		t.Run("ZeroWorkersGetDefault", func(t *testing.T) {
			cfg := Config{
				NumWorkers: 0,
				MaxBackoff: 1 * time.Second,
			}
			err := cfg.validate()
			require.NoError(t, err)
			require.Equal(t, cfg.NumWorkers, DefaultNumWorkers)
			require.NotNil(t, cfg.Logger, "Logger should not be nil")
		})

		t.Run("NilLoggerGetsDefault", func(t *testing.T) {
			cfg := Config{
				NumWorkers: 1,
				MaxBackoff: 1 * time.Second,
				Logger:     nil,
			}
			err := cfg.validate()
			require.NoError(t, err)
			require.NotNil(t, cfg.Logger)
		})

		t.Run("ZeroTimeoutGetsDefault", func(t *testing.T) {
			cfg := Config{
				NumWorkers: 1,
				MaxBackoff: 0,
				Logger:     log.New("qos.test"),
			}
			err := cfg.validate()
			require.NoError(t, err)
			require.Equal(t, cfg.MaxBackoff, DefaultMaxBackoff)
		})

		t.Run("ZeroRetriesGetsDefault", func(t *testing.T) {
			cfg := Config{
				NumWorkers: 1,
				MaxBackoff: 1 * time.Second,
				MaxRetries: 0,
				Logger:     log.New("qos.test"),
			}
			err := cfg.validate()
			require.NoError(t, err)
			require.Equal(t, cfg.MaxRetries, DefaultMaxRetries)
		})
	})

	t.Run("NewScheduler", func(t *testing.T) {
		t.Parallel()

		t.Run("ValidParameters", func(t *testing.T) {
			q := NewQueue(QueueOptionsWithDefaults(nil))
			require.NoError(t, services.StartAndAwaitRunning(context.Background(), q))

			cfg := Config{
				NumWorkers: 2,
				MaxBackoff: 1 * time.Second,
				Logger:     log.New("qos.test"),
			}
			scheduler, err := NewScheduler(q, &cfg)
			require.NoError(t, err)
			require.NotNil(t, scheduler)
			require.NoError(t, services.StartAndAwaitRunning(context.Background(), scheduler))
			require.Equal(t, q, scheduler.queue)
			require.Equal(t, cfg.NumWorkers, scheduler.numWorkers)
			require.True(t, scheduler.State() == services.Running)
			require.NoError(t, services.StopAndAwaitTerminated(context.Background(), scheduler))
		})

		t.Run("NilQueue", func(t *testing.T) {
			cfg := Config{
				NumWorkers: 2,
				MaxBackoff: 1 * time.Second,
			}
			scheduler, err := NewScheduler(nil, &cfg)
			require.Error(t, err)
			require.Nil(t, scheduler)
		})
	})

	t.Run("Lifecycle", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(context.Background(), q))

		scheduler, err := NewScheduler(q, &Config{
			NumWorkers: 3,
			MaxBackoff: 100 * time.Millisecond,
			Logger:     log.New("qos.test"),
		})
		require.NoError(t, err)
		require.True(t, scheduler.State() == services.New)
		require.NoError(t, services.StartAndAwaitRunning(context.Background(), scheduler))
		require.True(t, scheduler.State() == services.Running)
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), scheduler))
		require.True(t, scheduler.State() == services.Terminated)
	})

	t.Run("ProcessItems", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 1000}))
		require.NoError(t, services.StartAndAwaitRunning(context.Background(), q))

		const itemCount = 1000
		var processed sync.Map
		var wg sync.WaitGroup
		wg.Add(itemCount)

		scheduler, err := NewScheduler(q, &Config{
			NumWorkers: 10,
			MaxBackoff: 100 * time.Millisecond,
			Logger:     log.New("qos.test"),
		})
		require.NoError(t, err)
		require.NoError(t, services.StartAndAwaitRunning(context.Background(), scheduler))

		for i := 0; i < itemCount; i++ {
			itemID := i
			tenantIndex := itemID % 10
			tenantID := fmt.Sprintf("tenant-%d", tenantIndex)
			require.NoError(t, q.Enqueue(context.Background(), tenantID, func() {
				processed.Store(itemID, true)
				time.Sleep(10 * time.Millisecond)
				wg.Done()
			}))
		}

		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatal("Timed out waiting for all items to be processed")
		}

		count := 0
		processed.Range(func(_, _ any) bool {
			count++
			return true
		})
		require.Equal(t, itemCount, count, "Not all items were processed")

		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), scheduler))
	})

	t.Run("GracefulShutdown", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(context.Background(), q))

		var processed atomic.Int32
		taskStarted := make(chan struct{})
		taskFinished := make(chan struct{})

		scheduler, err := NewScheduler(q, &Config{
			NumWorkers: 1,
			MaxBackoff: 100 * time.Millisecond,
			Logger:     log.New("qos.test"),
		})
		require.NoError(t, err)
		require.NoError(t, services.StartAndAwaitRunning(context.Background(), scheduler))

		for i := 0; i < 5; i++ {
			require.NoError(t, q.Enqueue(context.Background(), "tenant-1", func() {
				processed.Add(1)
			}))
		}

		require.NoError(t, q.Enqueue(context.Background(), "tenant-1", func() {
			close(taskStarted)
			time.Sleep(1 * time.Second)
			processed.Add(1)
			close(taskFinished)
		}))

		select {
		case <-taskStarted:
		case <-time.After(2 * time.Second):
			t.Fatal("Timed out waiting for long-running task to start")
		}

		scheduler.StopAsync()

		select {
		case <-taskFinished:
		case <-time.After(2 * time.Second):
			t.Fatal("Timed out waiting for long-running task to finish")
		}

		require.Equal(t, int32(6), processed.Load(), "Not all items were processed")
		require.NoError(t, scheduler.AwaitTerminated(context.Background()))
	})

	t.Run("WithQueueClosed", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(nil))

		scheduler, err := NewScheduler(q, &Config{
			NumWorkers: 2,
			MaxBackoff: 100 * time.Millisecond,
			Logger:     log.New("qos.test"),
		})
		require.NoError(t, err)
		require.ErrorContains(t, services.StartAndAwaitRunning(context.Background(), scheduler), "queue is not running")
	})
}
