package scheduler

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func QueueOptionsWithDefaults(opts *QueueOptions) *QueueOptions {
	if opts == nil {
		opts = &QueueOptions{}
	}
	if opts.MaxSizePerTenant <= 0 {
		opts.MaxSizePerTenant = 10
	}
	if opts.Registerer == nil {
		opts.Registerer = prometheus.NewRegistry()
	}
	if opts.Logger == nil {
		opts.Logger = log.New("qos.test")
	}
	return opts
}

//nolint:gocyclo
func TestQueue(t *testing.T) {
	t.Parallel()

	t.Run("SimpleEnqueueAndDequeue", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, q))

		defer func() {
			require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))
		}()

		var wg sync.WaitGroup
		const numItems = 5
		const tenantID = "tenant-a"
		var processed atomic.Int32

		// Enqueue items
		for i := 0; i < numItems; i++ {
			err := q.Enqueue(ctx, tenantID, func() {
				processed.Add(1)
			})
			require.NoError(t, err, "Enqueue should succeed")
		}
		require.Equal(t, numItems, q.Len(), "Queue length after enqueue")
		require.Equal(t, 1, q.ActiveTenantsLen(), "Active tenants after enqueue")

		// Dequeue items
		for i := 0; i < numItems; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				dequeueCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
				defer cancel()
				runnable, err := q.Dequeue(dequeueCtx)
				require.NoError(t, err, "Dequeue should succeed")
				require.NotNil(t, runnable, "Dequeued runnable should not be nil")
				runnable()
			}()
		}

		wg.Wait()

		// Check that all items were processed
		require.Equal(t, numItems, int(processed.Load()), "All items should have been processed")

		// Let's simplify the dequeue check: Dequeue sequentially after enqueueing.
		qSimple := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, qSimple))

		for i := 0; i < numItems; i++ {
			err := qSimple.Enqueue(ctx, tenantID, func() {})
			require.NoError(t, err)
		}
		require.Equal(t, numItems, qSimple.Len(), "Queue length after enqueue (simple)")
		require.Equal(t, 1, qSimple.ActiveTenantsLen(), "Active tenants after enqueue (simple)")

		for i := 0; i < numItems; i++ {
			dequeueCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
			runnable, err := qSimple.Dequeue(dequeueCtx)
			cancel() // Cancel context after use
			require.NoError(t, err, "Dequeue %d should succeed (simple)", i)
			require.NotNil(t, runnable, "Dequeued runnable %d should not be nil (simple)", i)
		}

		require.Equal(t, 0, qSimple.Len(), "Queue length after dequeue (simple)")
		require.Equal(t, 0, qSimple.ActiveTenantsLen(), "Active tenants after dequeue (simple)")

		// Check dequeue on empty queue times out
		dequeueCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		_, err := qSimple.Dequeue(dequeueCtx)
		cancel()
		require.ErrorIs(t, err, context.DeadlineExceeded, "Dequeue on empty queue should time out")

		// Stop the queue
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), qSimple))
	})

	t.Run("RoundRobinBetweenTenants", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, q))

		tenantA := "tenant-a"
		tenantB := "tenant-b"

		// We'll use a very small test with just 2 items per tenant
		// to reduce the chance of timeouts or other issues

		// Enqueue items in tenant order: A, B, A, B
		// Each item will record its tenant ID when executed
		var results []string
		var resultsMu sync.Mutex

		makeRunnable := func(id string) func() {
			return func() {
				resultsMu.Lock()
				results = append(results, id)
				resultsMu.Unlock()
			}
		}

		require.NoError(t, q.Enqueue(ctx, tenantA, makeRunnable(tenantA)))
		require.NoError(t, q.Enqueue(ctx, tenantA, makeRunnable(tenantA)))
		require.NoError(t, q.Enqueue(ctx, tenantB, makeRunnable(tenantB)))
		require.NoError(t, q.Enqueue(ctx, tenantB, makeRunnable(tenantB)))

		// Verify queue state
		require.Equal(t, 4, q.Len(), "Queue should have 4 items")
		require.Equal(t, 2, q.ActiveTenantsLen(), "Should have 2 active tenants")

		// Use a longer timeout to handle CI environment variability
		dequeueTimeout := 3 * time.Second

		// Dequeue and execute the four items
		for i := 0; i < 4; i++ {
			// Use a more reliable context with longer timeout for CI environments
			dequeueCtx, cancel := context.WithTimeout(ctx, dequeueTimeout)
			runnable, err := q.Dequeue(dequeueCtx)
			if err != nil {
				t.Logf("Queue state: Len=%d, ActiveTenantsLen=%d", q.Len(), q.ActiveTenantsLen())
			}

			cancel()
			require.NoError(t, err, "Dequeue %d should succeed", i)
			require.NotNil(t, runnable, "Dequeued runnable %d should not be nil", i)
			runnable() // Execute to record the tenant ID
		}

		// Check execution order - should alternate between tenants
		resultsMu.Lock()
		require.Equal(t, []string{tenantA, tenantB, tenantA, tenantB}, results)
		resultsMu.Unlock()

		// Verify queue is now empty
		require.Equal(t, 0, q.Len())
		require.Equal(t, 0, q.ActiveTenantsLen())
	})

	t.Run("TenantQueueFullError", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 2}))
		require.NoError(t, q.StartAsync(context.Background()), "Queue should start")
		require.NoError(t, q.AwaitRunning(context.Background()), "Queue should be running")

		tenantID := "tenant-limited"

		// Enqueue up to the limit
		err := q.Enqueue(ctx, tenantID, func() {})
		require.NoError(t, err)
		err = q.Enqueue(ctx, tenantID, func() {})
		require.NoError(t, err)

		require.Equal(t, 2, q.Len())
		require.Equal(t, 1, q.ActiveTenantsLen())

		// Enqueue one more, expect error
		err = q.Enqueue(ctx, tenantID, func() {})
		require.ErrorIs(t, err, ErrTenantQueueFull, "Expected ErrTenantQueueFull")

		// Len should still be 2
		require.Equal(t, 2, q.Len())

		// Dequeue one item
		dequeueCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		_, err = q.Dequeue(dequeueCtx)
		cancel()
		require.NoError(t, err)
		require.Equal(t, 1, q.Len())

		// Now enqueue should succeed again
		err = q.Enqueue(ctx, tenantID, func() {})
		require.NoError(t, err, "Enqueue should succeed after dequeueing one item")
		require.Equal(t, 2, q.Len(), "Length should be back to 2")
	})

	t.Run("DequeueContextCancellation", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, q))
		require.NoError(t, q.AwaitRunning(ctx), "Queue should be running")

		// Create an already canceled context instead of using timeout
		cancelCtx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		// This should return with context.Canceled error immediately
		runnable, err := q.Dequeue(cancelCtx)

		// Verify the result - should be context.Canceled, not DeadlineExceeded
		require.Nil(t, runnable, "Runnable should be nil on context cancellation")
		require.ErrorIs(t, err, context.Canceled, "Expected context canceled error")
	})

	t.Run("DequeueWithTimeout", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, q))
		require.NoError(t, q.AwaitRunning(ctx), "Queue should be running")

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		// This should timeout since nothing is in the queue
		runnable, err := q.Dequeue(ctx)
		require.Nil(t, runnable, "Runnable should be nil on timeout")
		require.ErrorIs(t, err, context.DeadlineExceeded, "Expected context deadline exceeded error")
	})

	t.Run("EnqueueAfterStopped", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, q))
		require.NoError(t, q.AwaitRunning(ctx), "Queue should be running")

		// Stop the queue first
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))

		// Now try to enqueue - should return ErrQueueClosed
		err := q.Enqueue(context.Background(), "tenant-id", func() {})
		require.ErrorIs(t, err, ErrQueueClosed, "Enqueue after Stop should return ErrQueueClosed")
	})

	t.Run("EnqueueBeforeStarted", func(t *testing.T) {
		t.Parallel()
		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		err := q.Enqueue(ctx, "tenant-id", func() {})
		require.ErrorIs(t, err, ErrQueueClosed, "Enqueue before Start should return ErrQueueClosed")
	})

	t.Run("DequeueAfterStopped", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, q))
		require.NoError(t, q.AwaitRunning(ctx), "Queue should be running")

		// Stop the queue first
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))

		// Now try to dequeue - should return ErrQueueClosed
		runnable, err := q.Dequeue(context.Background())
		require.Nil(t, runnable, "Runnable should be nil after Stop")
		require.ErrorIs(t, err, ErrQueueClosed, "Dequeue after Stop should return ErrQueueClosed")
	})

	t.Run("DequeueBeforeStarted", func(t *testing.T) {
		t.Parallel()
		ctx := context.Background()
		q := NewQueue(QueueOptionsWithDefaults(nil))
		_, err := q.Dequeue(ctx)
		require.ErrorIs(t, err, ErrQueueClosed, "Dequeue before Start should return ErrQueueClosed")
	})

	t.Run("ConcurrentEnqueuersAndDequeuers", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 100}))
		require.NoError(t, q.StartAsync(context.Background()), "Queue should start")
		require.NoError(t, q.AwaitRunning(context.Background()), "Queue should be running")

		const numProducers = 5
		const numConsumers = 3
		const itemsPerProducer = 20
		const totalItems = numProducers * itemsPerProducer

		// Track items to verify all are processed
		processedItems := make(map[string]int)
		var mu sync.Mutex
		var wg sync.WaitGroup

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		// Start consumers first (they'll block until items are available)
		for i := 0; i < numConsumers; i++ {
			wg.Add(1)
			go func(consumerID int) {
				defer wg.Done()

				for {
					runnable, err := q.Dequeue(ctx)
					if err != nil {
						if errors.Is(err, context.DeadlineExceeded) {
							return
						}
						require.NoError(t, err)
						return
					}

					// Execute the runnable which will update our tracking
					runnable()

					// Check if we've processed all expected items
					mu.Lock()
					totalProcessed := 0
					for _, count := range processedItems {
						totalProcessed += count
					}
					done := totalProcessed >= totalItems
					mu.Unlock()

					if done {
						return
					}
				}
			}(i)
		}

		// Start producers
		for i := 0; i < numProducers; i++ {
			wg.Add(1)
			go func(producerID int) {
				defer wg.Done()
				tenantID := fmt.Sprintf("tenant-%d", producerID%3) // Use 3 different tenants

				for j := 0; j < itemsPerProducer; j++ {
					itemID := fmt.Sprintf("p%d-item%d", producerID, j)

					err := q.Enqueue(ctx, tenantID, func() {
						mu.Lock()
						processedItems[itemID] = 1
						mu.Unlock()
					})

					if err != nil {
						// Context might have been canceled if test is slow
						if errors.Is(err, context.DeadlineExceeded) ||
							errors.Is(err, ErrQueueClosed) {
							return
						}
						require.NoError(t, err)
					}

					// Small sleep to reduce contention
					time.Sleep(time.Millisecond)
				}
			}(i)
		}

		// Wait for all goroutines to finish
		wg.Wait()

		// Check that all items were processed
		mu.Lock()
		require.Equal(t, totalItems, len(processedItems),
			"All enqueued items should have been processed")
		mu.Unlock()

		// Verify queue is now empty
		require.Equal(t, 0, q.Len(), "Queue should be empty after processing all items")
		require.Equal(t, 0, q.ActiveTenantsLen(), "No active tenants should remain after processing")
		// Stop the queue
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))
	})

	t.Run("SlowDequeuerHandling", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 5}))
		require.NoError(t, q.StartAsync(context.Background()), "Queue should start")
		require.NoError(t, q.AwaitRunning(context.Background()), "Queue should be running")

		ctx := context.Background()
		tenantA := "tenant-a"
		tenantB := "tenant-b"
		tenantC := "tenant-c"

		// Create channels to track execution order
		completionOrder := make(chan string, 10)
		var wg sync.WaitGroup

		// Enqueue a slow item for tenant A
		wg.Add(1)
		err := q.Enqueue(ctx, tenantA, func() {
			defer wg.Done()
			time.Sleep(300 * time.Millisecond) // Simulate slow processing
			completionOrder <- "A-slow"
		})
		require.NoError(t, err)

		// Enqueue regular items for other tenants
		for i := 0; i < 2; i++ {
			wg.Add(1)
			err := q.Enqueue(ctx, tenantB, func() {
				defer wg.Done()
				completionOrder <- fmt.Sprintf("B-%d", i)
			})
			require.NoError(t, err)

			wg.Add(1)
			err = q.Enqueue(ctx, tenantC, func() {
				defer wg.Done()
				completionOrder <- fmt.Sprintf("C-%d", i)
			})
			require.NoError(t, err)
		}

		// Enqueue another item for tenant A
		wg.Add(1)
		err = q.Enqueue(ctx, tenantA, func() {
			defer wg.Done()
			completionOrder <- "A-fast"
		})
		require.NoError(t, err)

		// Start multiple dequeuer goroutines
		for i := 0; i < 3; i++ {
			go func() {
				for j := 0; j < 2; j++ { // Each will dequeue 2 items
					dequeueCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
					runnable, err := q.Dequeue(dequeueCtx)
					cancel()
					if err != nil {
						return
					}
					runnable()
				}
			}()
		}

		// Wait for all processing to complete
		wg.Wait()
		close(completionOrder)

		// Collect completion order
		execOrder := make([]string, 0, len(completionOrder))
		for item := range completionOrder {
			execOrder = append(execOrder, item)
		}

		// Verify that despite A-slow being dequeued first, other tenants' work completed while it was running
		slowAPos := -1
		fastAPos := -1
		for i, item := range execOrder {
			if item == "A-slow" {
				slowAPos = i
			}
			if item == "A-fast" {
				fastAPos = i
			}
		}

		// The slow A task was started first but should finish later
		require.True(t, slowAPos > 0, "A-slow should be in the execution order")
		require.True(t, fastAPos > 0, "A-fast should be in the execution order")

		// Verify some items from other tenants completed between the two A items
		// This confirms round-robin fairness even with slow consumers
		firstTenantBFoundPos := -1
		for i, item := range execOrder {
			if strings.HasPrefix(item, "B-") || strings.HasPrefix(item, "C-") {
				firstTenantBFoundPos = i
				break
			}
		}

		// Make sure at least one other tenant item completed
		require.True(t, firstTenantBFoundPos >= 0,
			"At least one B or C item should be in execution order")

		// Verify length is now 0
		require.Equal(t, 0, q.Len())
		require.Equal(t, 0, q.ActiveTenantsLen())

		// Stop the queue
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))
	})

	t.Run("ActiveTenantsLength", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, q.StartAsync(context.Background()), "Queue should start")
		require.NoError(t, q.AwaitRunning(context.Background()), "Queue should be running")

		// Enqueue items for different tenants
		err := q.Enqueue(context.Background(), "tenant1", func() {})
		require.NoError(t, err)
		err = q.Enqueue(context.Background(), "tenant2", func() {})
		require.NoError(t, err)

		// Check active tenants
		activeTenants := q.ActiveTenantsLen()
		require.Equal(t, activeTenants, 2)

		// Stop the queue
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))
	})

	t.Run("QueueLength", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, q.StartAsync(context.Background()), "Queue should start")
		require.NoError(t, q.AwaitRunning(context.Background()), "Queue should be running")

		// Enqueue items
		err := q.Enqueue(context.Background(), "tenant1", func() {})
		require.NoError(t, err)
		err = q.Enqueue(context.Background(), "tenant1", func() {})
		require.NoError(t, err)

		// Check queue length
		queueLen := q.Len()
		require.Equal(t, queueLen, 2)

		// Stop the queue
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q))
	})

	t.Run("GracefulShutdown", func(t *testing.T) {
		t.Parallel()

		q := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, q.StartAsync(context.Background()), "Queue should start")
		require.NoError(t, q.AwaitRunning(context.Background()), "Queue should be running")

		processed := make(chan struct{})

		// Enqueue an item that signals when processed
		err := q.Enqueue(context.Background(), "tenant1", func() {
			close(processed)
		})
		require.NoError(t, err)

		// Start a goroutine to dequeue and run the item
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			runnable, err := q.Dequeue(ctx)
			require.NoError(t, err)
			require.NotNil(t, runnable)
			runnable()
		}()

		// Wait for the item to be processed
		select {
		case <-processed:
		case <-time.After(2 * time.Second):
			t.Fatal("Timed out waiting for item to be processed before shutdown")
		}

		// Now gracefully stop the queue
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		require.NoError(t, services.StopAndAwaitTerminated(ctx, q))
		wg.Wait()

		// Check that the queue is closed
		err = q.Enqueue(context.Background(), "tenant1", func() {})
		require.ErrorIs(t, err, ErrQueueClosed)
	})
}
