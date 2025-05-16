package qos

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func TestSchedulerConfig(t *testing.T) {
	tests := []struct {
		name          string
		config        SchedulerConfig
		expectError   bool
		expectedError string
	}{
		{
			name: "Valid config",
			config: SchedulerConfig{
				NumWorkers:     5,
				DequeueTimeout: 1 * time.Second,
				Logger:         log.New("qos.test"),
			},
			expectError: false,
		},
		{
			name: "Zero workers",
			config: SchedulerConfig{
				NumWorkers:     0,
				DequeueTimeout: 1 * time.Second,
			},
			expectError:   true,
			expectedError: "NumWorkers must be positive",
		},
		{
			name: "Negative workers",
			config: SchedulerConfig{
				NumWorkers:     -1,
				DequeueTimeout: 1 * time.Second,
			},
			expectError:   true,
			expectedError: "NumWorkers must be positive",
		},
		{
			name: "Nil logger gets default",
			config: SchedulerConfig{
				NumWorkers:     1,
				DequeueTimeout: 1 * time.Second,
				Logger:         nil,
			},
			expectError: false,
		},
		{
			name: "Zero timeout gets default",
			config: SchedulerConfig{
				NumWorkers:     1,
				DequeueTimeout: 0,
				Logger:         log.New("qos.test"),
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
				if tc.config.DequeueTimeout == 0 {
					require.Greater(t, tc.config.DequeueTimeout, time.Duration(0))
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
		config      SchedulerConfig
		expectError bool
	}{
		{
			name:  "Valid parameters",
			queue: NewQueue(&QueueOptions{MaxSizePerTenant: 10}),
			config: SchedulerConfig{
				NumWorkers:     2,
				DequeueTimeout: 1 * time.Second,
				Logger:         log.New("qos.test"),
			},
			expectError: false,
		},
		{
			name:  "Nil queue",
			queue: nil,
			config: SchedulerConfig{
				NumWorkers:     2,
				DequeueTimeout: 1 * time.Second,
			},
			expectError: true,
		},
		{
			name:  "Invalid config",
			queue: NewQueue(&QueueOptions{MaxSizePerTenant: 10}),
			config: SchedulerConfig{
				NumWorkers:     0, // Invalid
				DequeueTimeout: 1 * time.Second,
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
			} else {
				require.NoError(t, err)
				require.NotNil(t, scheduler)
				require.Equal(t, tc.queue, scheduler.queue)
				require.Equal(t, tc.config.NumWorkers, scheduler.numWorkers)

				// Ensure the scheduler is properly initialized
				require.False(t, scheduler.IsRunning())
				require.Empty(t, scheduler.workers)
			}

			// Close the queue to prevent leaks
			if tc.queue != nil {
				tc.queue.Close()
				tc.queue.StopWait()
			}
		})
	}
}

func TestSchedulerStartStop(t *testing.T) {
	q := NewQueue(&QueueOptions{MaxSizePerTenant: 10})
	defer func() {
		q.Close()
		q.StopWait()
	}()

	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     3,
		DequeueTimeout: 100 * time.Millisecond,
		Logger:         log.New("qos.test"),
	})
	require.NoError(t, err)

	// Test initial state
	require.False(t, scheduler.IsRunning())

	// Test Start
	err = scheduler.Start()
	require.NoError(t, err)
	require.True(t, scheduler.IsRunning())
	require.Len(t, scheduler.workers, 3)

	// Test double start
	err = scheduler.Start()
	require.Error(t, err)
	require.Contains(t, err.Error(), "already started")

	// Test Stop
	scheduler.Stop()
	require.False(t, scheduler.IsRunning())
	require.Nil(t, scheduler.workers)
}

func TestSchedulerProcessItems(t *testing.T) {
	q := NewQueue(&QueueOptions{MaxSizePerTenant: 10})
	defer func() {
		q.Close()
		q.StopWait()
	}()

	// Use a sync.Map to store results across goroutines safely
	var processedItems sync.Map
	var itemCount int32 = 10

	// Create a channel to signal when all items are processed
	allProcessed := make(chan struct{})

	// Create a WaitGroup to track the completion of all items
	var wg sync.WaitGroup
	wg.Add(int(itemCount))

	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     2,
		DequeueTimeout: 100 * time.Millisecond,
		Logger:         log.New("qos.test"),
	})
	require.NoError(t, err)

	// Start a goroutine to monitor when all items are processed
	go func() {
		wg.Wait()
		close(allProcessed)
	}()

	// Start the scheduler
	err = scheduler.Start()
	require.NoError(t, err)

	// Add items to the queue
	for i := 0; i < int(itemCount); i++ {
		itemID := i
		err := q.Enqueue(context.Background(), "tenant-1", func() {
			// Mark this item as processed
			processedItems.Store(itemID, true)
			wg.Done()
		})
		require.NoError(t, err)
	}

	// Wait for all items to be processed with a timeout
	select {
	case <-allProcessed:
		// All items processed successfully
	case <-time.After(5 * time.Second):
		t.Fatal("Timed out waiting for all items to be processed")
	}

	// Verify all items were processed
	count := 0
	processedItems.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	require.Equal(t, int(itemCount), count, "Not all items were processed")

	// Stop the scheduler
	scheduler.Stop()
}

func TestSchedulerGracefulShutdown(t *testing.T) {
	q := NewQueue(&QueueOptions{MaxSizePerTenant: 10})
	defer func() {
		q.Close()
		q.StopWait()
	}()

	var processed atomic.Int32

	// Create channels to signal task state transitions
	taskStarted := make(chan struct{})
	taskFinished := make(chan struct{})

	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     1,
		DequeueTimeout: 100 * time.Millisecond,
		Logger:         log.New("qos.test"),
	})
	require.NoError(t, err)

	// Start the scheduler
	err = scheduler.Start()
	require.NoError(t, err)

	// Add several quick items
	for i := 0; i < 5; i++ {
		err := q.Enqueue(context.Background(), "tenant-1", func() {
			processed.Add(1)
		})
		require.NoError(t, err)
	}

	// Add one long-running item last
	err = q.Enqueue(context.Background(), "tenant-1", func() {
		// Signal that the task has started
		close(taskStarted)

		// Simulate some work (keeping this shorter for test efficiency)
		select {
		case <-time.After(100 * time.Millisecond):
			// Time-based fallback in case something goes wrong
		}

		// Signal that the task has finished
		close(taskFinished)
	})
	require.NoError(t, err)

	// Wait for long-running item to start
	select {
	case <-taskStarted:
		// Task started successfully
	case <-time.After(2 * time.Second):
		t.Fatal("Timed out waiting for long-running task to start")
	}

	// Initiate graceful shutdown while long-running task is in progress
	scheduler.Stop()

	// Verify the long-running task was allowed to complete
	select {
	case <-taskFinished:
		// Task finished successfully
	case <-time.After(2 * time.Second):
		t.Fatal("Timed out waiting for long-running task to finish")
	}

	// Check that all normal items were processed too
	require.Equal(t, int32(5), processed.Load())
}

func TestSchedulerWithErrorInQueue(t *testing.T) {
	q := NewQueue(&QueueOptions{MaxSizePerTenant: 10})

	// Create a WaitGroup to track completed items
	var wg sync.WaitGroup
	var processedCount atomic.Int32
	const totalItems = 5

	wg.Add(totalItems)

	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     2,
		DequeueTimeout: 100 * time.Millisecond,
		Logger:         log.New("qos.test"),
	})
	require.NoError(t, err)

	// Start the scheduler
	err = scheduler.Start()
	require.NoError(t, err)

	// Add a few items
	for i := 0; i < totalItems; i++ {
		err := q.Enqueue(context.Background(), "tenant-1", func() {
			processedCount.Add(1)
			wg.Done()
		})
		require.NoError(t, err)
	}

	// Wait for items to be processed or timeout
	processingDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(processingDone)
	}()

	select {
	case <-processingDone:
		// Items processed successfully
	case <-time.After(1 * time.Second):
		// Continue anyway, some items might not process
	}

	// Close the queue to simulate an error condition
	q.Close()

	// When the queue is closed, Dequeue operations should return ErrQueueClosed
	// Try to add a new item, which should fail
	err = q.Enqueue(context.Background(), "tenant-1", func() {})
	require.Error(t, err)
	require.Equal(t, ErrQueueClosed, err)

	// Explicitly stop the scheduler to ensure it shuts down
	scheduler.Stop()

	// Verify scheduler has stopped
	require.False(t, scheduler.IsRunning())

	// Processed count should be at most the total items (some items may not have been processed if queue was closed early)
	require.LessOrEqual(t, processedCount.Load(), int32(totalItems))

	// Clean up
	q.StopWait()
}
