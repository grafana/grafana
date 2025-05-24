package scheduler

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestSchedulerConfig(t *testing.T) {
	tests := []struct {
		name          string
		config        Config
		expectError   bool
		expectedError string
	}{
		{
			name: "Valid config",
			config: Config{
				NumWorkers: 5,
				MaxBackoff: 1 * time.Second,
				Logger:     log.New("qos.test"),
			},
			expectError: false,
		},
		{
			name: "Zero workers",
			config: Config{
				NumWorkers: 0,
				MaxBackoff: 1 * time.Second,
			},
			expectError:   true,
			expectedError: "NumWorkers must be positive",
		},
		{
			name: "Negative workers",
			config: Config{
				NumWorkers: -1,
				MaxBackoff: 1 * time.Second,
			},
			expectError:   true,
			expectedError: "NumWorkers must be positive",
		},
		{
			name: "Nil logger gets default",
			config: Config{
				NumWorkers: 1,
				MaxBackoff: 1 * time.Second,
				Logger:     nil,
			},
			expectError: false,
		},
		{
			name: "Zero timeout gets default",
			config: Config{
				NumWorkers: 1,
				MaxBackoff: 0,
				Logger:     log.New("qos.test"),
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.config.validate()
			if tc.expectError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tc.expectedError)
			} else {
				require.NoError(t, err)
				if tc.config.MaxBackoff == 0 {
					require.Greater(t, tc.config.MaxBackoff, time.Duration(0))
				}
				require.NotNil(t, tc.config.Logger)
			}
		})
	}
}

func TestNewScheduler(t *testing.T) {
	tests := []struct {
		name        string
		queue       *Queue
		config      Config
		expectError bool
	}{
		{
			name:  "Valid parameters",
			queue: NewQueue(QueueOptionsWithDefaults(nil)),
			config: Config{
				NumWorkers: 2,
				MaxBackoff: 1 * time.Second,
				Logger:     log.New("qos.test"),
			},
			expectError: false,
		},
		{
			name:  "Nil queue",
			queue: nil,
			config: Config{
				NumWorkers: 2,
				MaxBackoff: 1 * time.Second,
			},
			expectError: true,
		},
		{
			name:  "Invalid config",
			queue: NewQueue(QueueOptionsWithDefaults(nil)),
			config: Config{
				NumWorkers: 0, // Invalid
				MaxBackoff: 1 * time.Second,
			},
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scheduler, err := NewScheduler(tc.queue, &tc.config)
			if tc.expectError {
				require.Error(t, err)
				require.Nil(t, scheduler)
				return
			}

			require.NoError(t, scheduler.StartAsync(context.Background()))
			require.NoError(t, scheduler.AwaitRunning(context.Background()))
			require.NoError(t, err)
			require.NotNil(t, scheduler)
			require.Equal(t, tc.queue, scheduler.queue)
			require.Equal(t, tc.config.NumWorkers, scheduler.numWorkers)
			require.True(t, scheduler.State() == services.Running)

			if tc.queue != nil {
				tc.queue.StopAsync()
				require.NoError(t, tc.queue.AwaitTerminated(context.Background()))
			}
		})
	}
}

func TestSchedulerLifecycle(t *testing.T) {
	q := NewQueue(QueueOptionsWithDefaults(nil))

	scheduler, err := NewScheduler(q, &Config{
		NumWorkers: 3,
		MaxBackoff: 100 * time.Millisecond,
		Logger:     log.New("qos.test"),
	})
	require.NoError(t, err)

	// Test initial state
	require.True(t, scheduler.State() == services.New)

	// Test starting the scheduler
	require.NoError(t, scheduler.StartAsync(context.Background()))
	require.NoError(t, scheduler.AwaitRunning(context.Background()))
	require.True(t, scheduler.State() == services.Running)
	// Test stopping the scheduler
	scheduler.StopAsync()
	err = scheduler.AwaitTerminated(context.Background())
	require.NoError(t, err)
	require.True(t, scheduler.State() == services.Terminated)
}

func TestSchedulerProcessItems(t *testing.T) {
	q := NewQueue(QueueOptionsWithDefaults(nil))

	const itemCount = 10
	var processed sync.Map
	var wg sync.WaitGroup
	wg.Add(itemCount)

	scheduler, err := NewScheduler(q, &Config{
		NumWorkers: 2,
		MaxBackoff: 100 * time.Millisecond,
		Logger:     log.New("qos.test"),
	})
	require.NoError(t, err)

	// Start the scheduler and wait until it's running
	require.NoError(t, scheduler.StartAsync(context.Background()))
	require.NoError(t, scheduler.AwaitRunning(context.Background()))

	// Enqueue items
	for i := 0; i < itemCount; i++ {
		itemID := i
		require.NoError(t, q.Enqueue(context.Background(), "tenant-1", func() {
			processed.Store(itemID, true)
			wg.Done()
		}))
	}

	// Wait for all items to be processed or timeout
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

	// Verify all items were processed
	count := 0
	processed.Range(func(_, _ any) bool {
		count++
		return true
	})
	require.Equal(t, itemCount, count, "Not all items were processed")

	// Stop the scheduler and verify it's terminated
	scheduler.StopAsync()
	require.NoError(t, scheduler.AwaitTerminated(context.Background()))
	require.Equal(t, services.Terminated, scheduler.State())
}

func TestSchedulerGracefulShutdown(t *testing.T) {
	q := NewQueue(QueueOptionsWithDefaults(nil))

	var processed atomic.Int32
	taskStarted := make(chan struct{})
	taskFinished := make(chan struct{})

	scheduler, err := NewScheduler(q, &Config{
		NumWorkers: 1,
		MaxBackoff: 100 * time.Millisecond,
		Logger:     log.New("qos.test"),
	})
	require.NoError(t, err)

	require.NoError(t, scheduler.StartAsync(context.Background()))
	require.NoError(t, scheduler.AwaitRunning(context.Background()))

	// Enqueue quick items
	for i := 0; i < 5; i++ {
		require.NoError(t, q.Enqueue(context.Background(), "tenant-1", func() {
			processed.Add(1)
		}))
	}

	// Enqueue a long-running item
	require.NoError(t, q.Enqueue(context.Background(), "tenant-1", func() {
		close(taskStarted)
		time.Sleep(1 * time.Second) // Simulate long-running task
		processed.Add(1)
		close(taskFinished)
	}))

	// Wait for the long-running item to start
	select {
	case <-taskStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("Timed out waiting for long-running task to start")
	}

	// Initiate graceful shutdown
	scheduler.StopAsync()

	// Wait for the long-running item to finish
	select {
	case <-taskFinished:
	case <-time.After(2 * time.Second):
		t.Fatal("Timed out waiting for long-running task to finish")
	}

	require.Equal(t, int32(6), processed.Load(), "Not all items were processed")
	require.NoError(t, scheduler.AwaitTerminated(context.Background()))
}

func TestSchedulerWithErrorInQueue(t *testing.T) {
	q := NewQueue(QueueOptionsWithDefaults(nil))

	var processedCount atomic.Int32
	const totalItems = 5
	var wg sync.WaitGroup
	wg.Add(totalItems)

	scheduler, err := NewScheduler(q, &Config{
		NumWorkers: 2,
		MaxBackoff: 100 * time.Millisecond,
		Logger:     log.New("qos.test"),
	})
	require.NoError(t, err)

	require.NoError(t, scheduler.StartAsync(context.Background()))
	require.NoError(t, scheduler.AwaitRunning(context.Background()))

	// Enqueue items
	for i := 0; i < totalItems; i++ {
		require.NoError(t, q.Enqueue(context.Background(), "tenant-1", func() {
			processedCount.Add(1)
			wg.Done()
		}))
	}

	// Wait for items to be processed or timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		// Some items may not process if queue is closed early
	}

	// Close the queue to simulate an error condition
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	q.StopAsync()
	require.NoError(t, q.AwaitTerminated(ctx))

	// Enqueue should fail after queue is closed
	err = q.Enqueue(context.Background(), "tenant-1", func() {})
	require.ErrorIs(t, err, ErrQueueClosed)

	// Stop the scheduler and verify it's terminated
	scheduler.StopAsync()
	require.NoError(t, scheduler.AwaitTerminated(context.Background()))

	// Processed count should be at most totalItems
	require.LessOrEqual(t, processedCount.Load(), int32(totalItems))
}
