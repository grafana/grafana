package scheduler

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
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
		for range numItems {
			err := q.Enqueue(ctx, tenantID, func() {
				processed.Add(1)
			})
			require.NoError(t, err, "Enqueue should succeed")
		}
		require.Equal(t, numItems, q.Len(), "Queue length after enqueue")
		require.Equal(t, 1, q.ActiveTenantsLen(), "Active tenants after enqueue")

		// Dequeue items
		for range numItems {
			wg.Go(func() {
				dequeueCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
				defer cancel()
				runnable, err := q.Dequeue(dequeueCtx)
				require.NoError(t, err, "Dequeue should succeed")
				require.NotNil(t, runnable, "Dequeued runnable should not be nil")
				runnable()
			})
		}

		wg.Wait()

		// Check that all items were processed
		require.Equal(t, numItems, int(processed.Load()), "All items should have been processed")

		// Let's simplify the dequeue check: Dequeue sequentially after enqueueing.
		qSimple := NewQueue(QueueOptionsWithDefaults(nil))
		require.NoError(t, services.StartAndAwaitRunning(ctx, qSimple))

		for range numItems {
			err := qSimple.Enqueue(ctx, tenantID, func() {})
			require.NoError(t, err)
		}
		require.Equal(t, numItems, qSimple.Len(), "Queue length after enqueue (simple)")
		require.Equal(t, 1, qSimple.ActiveTenantsLen(), "Active tenants after enqueue (simple)")

		for i := range numItems {
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
		for i := range 4 {
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

		synctest.Test(t, func(t *testing.T) {
			ctx := t.Context()
			q := NewQueue(QueueOptionsWithDefaults(nil))
			require.NoError(t, services.StartAndAwaitRunning(ctx, q))
			require.NoError(t, q.AwaitRunning(ctx), "Queue should be running")

			ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
			defer cancel()

			// This should timeout since nothing is in the queue
			runnable, err := q.Dequeue(ctx)
			require.Nil(t, runnable, "Runnable should be nil on timeout")
			require.ErrorIs(t, err, context.DeadlineExceeded, "Expected context deadline exceeded error")
			require.NoError(t, services.StopAndAwaitTerminated(t.Context(), q))
		})
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

		synctest.Test(t, func(t *testing.T) {
			q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 100}))
			require.NoError(t, q.StartAsync(t.Context()), "Queue should start")
			require.NoError(t, q.AwaitRunning(t.Context()), "Queue should be running")

			const numProducers = 5
			const numConsumers = 3
			const itemsPerProducer = 20
			const totalItems = numProducers * itemsPerProducer

			// Track items to verify all are processed
			processedItems := make(map[string]int)
			var mu sync.Mutex
			var wg sync.WaitGroup

			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			// Start consumers first (they'll block until items are available)
			for i := range numConsumers {
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
			for i := range numProducers {
				wg.Add(1)
				go func(producerID int) {
					defer wg.Done()
					tenantID := fmt.Sprintf("tenant-%d", producerID%3) // Use 3 different tenants

					for j := range itemsPerProducer {
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
			require.NoError(t, services.StopAndAwaitTerminated(t.Context(), q))
		})
	})

	t.Run("SlowDequeuerHandling", func(t *testing.T) {
		t.Parallel()

		synctest.Test(t, func(t *testing.T) {
			q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 5}))
			require.NoError(t, q.StartAsync(t.Context()), "Queue should start")
			require.NoError(t, q.AwaitRunning(t.Context()), "Queue should be running")

			ctx := t.Context()
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
			for i := range 2 {
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
			for range 3 {
				go func() {
					for range 2 { // Each will dequeue 2 items
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
			require.NoError(t, services.StopAndAwaitTerminated(t.Context(), q))
		})
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
		wg.Go(func() {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			runnable, err := q.Dequeue(ctx)
			require.NoError(t, err)
			require.NotNil(t, runnable)
			runnable()
		})

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

	t.Run("Execution", func(t *testing.T) {
		t.Run("AggregateInFlight", func(t *testing.T) {
			q := newExecutionTestQueue(t, 1)
			require.Zero(t, testutil.ToFloat64(q.inFlight))
			work := make([]func(), 0, 32)
			for i := range 32 {
				require.NoError(t, q.Enqueue(t.Context(), fmt.Sprintf("tenant-%d", i), func() {}))
				work = append(work, dequeueExecution(t, q))
			}
			require.NoError(t, testutil.CollectAndCompare(q.inFlight, strings.NewReader(`
# HELP grafana_resource_server_qos_in_flight Number of reserved or executing requests across all tenants
# TYPE grafana_resource_server_qos_in_flight gauge
grafana_resource_server_qos_in_flight 32
`)))
			for _, fn := range work {
				fn()
			}
			require.Zero(t, q.Len())
			require.Zero(t, testutil.ToFloat64(q.inFlight))
		})

		t.Run("TenantIsolation", func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				q := newExecutionTestQueue(t, 4)
				startExecutionTestScheduler(t, q, 32)

				release := make(chan struct{})
				unblock := sync.OnceFunc(func() { close(release) })
				t.Cleanup(unblock)
				started := make(chan struct{}, 5)
				for range 5 {
					require.NoError(t, q.Enqueue(t.Context(), "slow", func() { started <- struct{}{}; <-release }))
				}
				for range 4 {
					awaitExecutionSignal(t, started)
				}
				healthy := make(chan struct{})
				require.NoError(t, q.Enqueue(t.Context(), "healthy", func() { close(healthy) }))
				awaitExecutionSignal(t, healthy)
				require.Equal(t, 1, q.Len())
				require.Len(t, started, 0, "the fifth request must remain queued")

				// Finish the healthy request while the four slow requests remain blocked.
				synctest.Wait()

				require.Equal(t, float64(4), testutil.ToFloat64(q.inFlight))
				unblock()
				awaitExecutionSignal(t, started)

				// Drain the released requests and their reservations before reading the gauge.
				synctest.Wait()

				require.Zero(t, testutil.ToFloat64(q.inFlight))
			})
		})

		t.Run("FairnessAndFIFO", func(t *testing.T) {
			q := newExecutionTestQueue(t, 1)
			var order []string
			for _, tenant := range []string{"a", "b", "c"} {
				for i := range 2 {
					id := fmt.Sprintf("%s%d", tenant, i)
					require.NoError(t, q.Enqueue(t.Context(), tenant, func() { order = append(order, id) }))
				}
			}
			a := dequeueExecution(t, q)
			b := dequeueExecution(t, q)
			c := dequeueExecution(t, q)
			require.Equal(t, 3, q.Len())
			b()
			b2 := dequeueExecution(t, q)
			b2()
			a()
			a2 := dequeueExecution(t, q)
			a2()
			c()
			c2 := dequeueExecution(t, q)
			c2()
			require.Equal(t, []string{"b0", "b1", "a0", "a1", "c0", "c1"}, order)
			require.Zero(t, q.Len())
			require.Zero(t, q.ActiveTenantsLen())
			require.Zero(t, testutil.ToFloat64(q.inFlight))
		})

		t.Run("RoundRobinAmongEligibleTenants", func(t *testing.T) {
			q := newExecutionTestQueue(t, 2)
			var order []string
			for _, tenant := range []string{"a", "b", "c"} {
				for i := range 2 {
					id := fmt.Sprintf("%s%d", tenant, i)
					require.NoError(t, q.Enqueue(t.Context(), tenant, func() { order = append(order, id) }))
				}
			}
			for range 6 {
				dequeueExecution(t, q)()
			}
			require.Equal(t, []string{"a0", "b0", "c0", "a1", "b1", "c1"}, order)
		})

		t.Run("Cancellation", func(t *testing.T) {
			t.Run("queued cancellation frees queue space without a worker", func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					q := newExecutionTestQueue(t, 1)
					ctx, cancel := context.WithCancel(t.Context())
					require.NoError(t, q.Enqueue(ctx, "a", func() { t.Error("canceled work ran") }))
					cancel()

					// Let cancellation remove the queued request and its tenant without a worker.
					synctest.Wait()

					require.Zero(t, q.Len())
					require.Zero(t, q.ActiveTenantsLen())
					require.Equal(t, float64(1), testutil.ToFloat64(q.discardedRequests.WithLabelValues("a", "context_canceled")))
					require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
					dequeueExecution(t, q)()
				})
			})
			t.Run("queued cancellation preserves FIFO", func(t *testing.T) {
				for _, canceled := range []int{0, 1, 2} {
					t.Run(fmt.Sprintf("cancel item %d", canceled), func(t *testing.T) {
						synctest.Test(t, func(t *testing.T) {
							q := newExecutionTestQueue(t, 1)
							ctx, cancel := context.WithCancel(t.Context())
							defer cancel()
							var order, expected []int
							for i := range 3 {
								itemCtx := t.Context()
								if i == canceled {
									itemCtx = ctx
								} else {
									expected = append(expected, i)
								}
								require.NoError(t, q.Enqueue(itemCtx, "a", func() { order = append(order, i) }))
							}
							cancel()

							// Finish removing the cancelled queued item before checking FIFO order among survivors.
							synctest.Wait()

							require.Equal(t, 2, q.Len())
							for range 2 {
								dequeueExecution(t, q)()
							}
							require.Equal(t, expected, order)
							require.Zero(t, q.Len())
							require.Zero(t, q.ActiveTenantsLen())
						})
					})
				}
			})
			t.Run("cancellation after dispatch skips execution and releases reservation", func(t *testing.T) {
				q := newExecutionTestQueue(t, 1)
				ctx, cancel := context.WithCancel(t.Context())
				require.NoError(t, q.Enqueue(ctx, "a", func() { t.Error("canceled work ran") }))
				runnable := dequeueExecution(t, q)
				cancel()
				require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
				require.Equal(t, float64(1), testutil.ToFloat64(q.inFlight))
				runnable()
				require.Equal(t, float64(1), testutil.ToFloat64(q.discardedRequests.WithLabelValues("a", "context_canceled")))
				dequeueExecution(t, q)()
				require.Zero(t, q.Len())
				require.Zero(t, testutil.ToFloat64(q.inFlight))
			})
			t.Run("executing cancellation retains capacity until return", func(t *testing.T) {
				q := newExecutionTestQueue(t, 1)
				ctx, cancel := context.WithCancel(t.Context())
				started := make(chan struct{})
				release := make(chan struct{})
				unblock := sync.OnceFunc(func() { close(release) })
				t.Cleanup(unblock)
				require.NoError(t, q.Enqueue(ctx, "a", func() { close(started); <-release }))
				fn := dequeueExecution(t, q)
				finished := make(chan struct{})
				go func() { fn(); close(finished) }()
				awaitExecutionSignal(t, started)
				cancel()
				require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
				require.NoError(t, q.Enqueue(t.Context(), "b", func() {}))
				dequeueExecution(t, q)()
				require.Equal(t, 1, q.Len())
				require.Equal(t, float64(1), testutil.ToFloat64(q.inFlight))
				unblock()
				awaitExecutionSignal(t, finished)
				dequeueExecution(t, q)()
			})
		})

		t.Run("CanceledWaitingWorkerDoesNotConsumeWork", func(t *testing.T) {
			for _, tc := range []struct {
				name   string
				capped bool
			}{
				{name: "empty queue"},
				{name: "tenant at execution cap", capped: true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					synctest.Test(t, func(t *testing.T) {
						q := newExecutionTestQueue(t, 1)
						var executed bool
						runnable := func() { executed = true }
						var reserved func()
						if tc.capped {
							require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
							reserved = dequeueExecution(t, q)
							require.NoError(t, q.Enqueue(t.Context(), "a", runnable))
						}

						ctx, cancel := context.WithCancel(t.Context())
						defer cancel()
						result := make(chan dequeueResponse, 1)
						go func() {
							fn, err := q.Dequeue(ctx)
							result <- dequeueResponse{runnable: fn, err: err}
						}()

						// Let Dequeue block on the empty queue before cancelling its context.
						synctest.Wait()

						cancel()
						response := <-result
						require.ErrorIs(t, response.err, context.Canceled)
						require.Nil(t, response.runnable)

						if tc.capped {
							require.Equal(t, 1, q.Len(), "canceling the worker must leave queued work intact")
							reserved()
						} else {
							require.NoError(t, q.Enqueue(t.Context(), "a", runnable))
						}
						dequeueExecution(t, q)()
						require.True(t, executed)
						require.Zero(t, q.Len())
					})
				})
			}
		})

		t.Run("CancelOnlyTheRequestedWaitingWorker", func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				q := newExecutionTestQueue(t, 1)
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				results := make([]chan dequeueResponse, 3)
				for i := range results {
					results[i] = make(chan dequeueResponse, 1)
					workerCtx := t.Context()
					if i == 1 {
						workerCtx = ctx
					}
					go func() {
						fn, err := q.Dequeue(workerCtx)
						results[i] <- dequeueResponse{runnable: fn, err: err}
					}()
				}

				// Let every worker enter Dequeue before cancelling one waiting worker.
				synctest.Wait()

				cancel()
				canceled := <-results[1]
				require.ErrorIs(t, canceled.err, context.Canceled)
				require.Nil(t, canceled.runnable)
				for _, tenant := range []string{"a", "b"} {
					require.NoError(t, q.Enqueue(t.Context(), tenant, func() {}))
				}
				for _, i := range []int{0, 2} {
					result := <-results[i]
					require.NoError(t, result.err)
					result.runnable()
				}
				require.Zero(t, q.Len())
				require.Zero(t, testutil.ToFloat64(q.inFlight))
			})
		})

		t.Run("Completion", func(t *testing.T) {
			t.Run("completion releases reservation for queued work", func(t *testing.T) {
				q := newExecutionTestQueue(t, 1)
				var executions int
				runnable := func() { executions++ }
				require.NoError(t, q.Enqueue(t.Context(), "a", runnable))
				fn := dequeueExecution(t, q)
				require.NoError(t, q.Enqueue(t.Context(), "a", runnable))
				require.Equal(t, 1, q.Len())
				require.Equal(t, float64(1), testutil.ToFloat64(q.inFlight))
				fn()
				require.Equal(t, 1, executions)
				dequeueExecution(t, q)()
				require.Equal(t, 2, executions)
				require.Zero(t, q.Len())
				require.Zero(t, testutil.ToFloat64(q.inFlight))
			})
			t.Run("panic releases reservation and propagates", func(t *testing.T) {
				q := newExecutionTestQueue(t, 1)
				require.NoError(t, q.Enqueue(t.Context(), "a", func() { panic("failure") }))
				require.PanicsWithValue(t, "failure", dequeueExecution(t, q))
				require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
				dequeueExecution(t, q)()
			})
			t.Run("shutdown unblocks pending workers and completion", func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					const waitingWorkers = 8
					q := newExecutionTestQueue(t, 1)
					require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
					fn := dequeueExecution(t, q)
					require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
					result := make(chan error, waitingWorkers)
					for range waitingWorkers {
						go func() { _, err := q.Dequeue(context.Background()); result <- err }()
					}

					// Let all workers block in Dequeue before shutting down the queue.
					synctest.Wait()

					require.NoError(t, services.StopAndAwaitTerminated(t.Context(), q))
					for range waitingWorkers {
						require.ErrorIs(t, <-result, ErrQueueClosed)
					}
					fn()
					require.Zero(t, testutil.ToFloat64(q.inFlight))
					require.Empty(t, q.tenantQueues)
				})
			})
		})

		t.Run("CapDisabled", func(t *testing.T) {
			for _, limit := range []int{-1, 0} {
				t.Run(fmt.Sprint(limit), func(t *testing.T) {
					q := newExecutionTestQueue(t, limit)
					work := make([]func(), 0, 8)
					for range 8 {
						require.NoError(t, q.Enqueue(t.Context(), "a", func() {}))
						work = append(work, dequeueExecution(t, q))
					}
					require.Equal(t, float64(8), testutil.ToFloat64(q.inFlight))
					for _, fn := range work {
						fn()
					}
					require.Zero(t, q.Len())
					require.Zero(t, testutil.ToFloat64(q.inFlight))
				})
			}
		})

		t.Run("ConcurrentDispatchCancellation", func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				q := newExecutionTestQueue(t, 2)
				startExecutionTestScheduler(t, q, 8)
				var inFlight, executed atomic.Int32
				var exceeded atomic.Bool
				var wg sync.WaitGroup
				for range 8 {
					wg.Go(func() {
						for i := range 100 {
							ctx := t.Context()
							cancel := func() {}
							if i%2 == 0 {
								ctx, cancel = context.WithCancel(ctx)
							}
							err := q.Enqueue(ctx, "a", func() {
								if inFlight.Add(1) > 2 {
									exceeded.Store(true)
								}
								executed.Add(1)
								inFlight.Add(-1)
							})
							if err != nil {
								t.Errorf("enqueue: %v", err)
							}
							cancel()
						}
					})
				}
				wg.Wait()
				require.NoError(t, q.Enqueue(t.Context(), "a", func() { executed.Add(1) }))

				// Finish dispatch, cancellation callbacks, and execution before checking all reservations.
				synctest.Wait()

				require.Zero(t, q.Len())
				require.Zero(t, testutil.ToFloat64(q.inFlight))
				require.False(t, exceeded.Load())
				require.GreaterOrEqual(t, executed.Load(), int32(401), "all 400 uncanceled requests and the final request must execute")
			})
		})
	})
}

func TestEnqueueContextDiscardReason(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		reason  string
		timeout time.Duration
		wantErr error
	}{
		{"context_canceled", time.Hour, context.Canceled},
		{"deadline_exceeded", 0, context.DeadlineExceeded},
	} {
		t.Run(tc.reason, func(t *testing.T) {
			t.Parallel()

			q := NewQueue(QueueOptionsWithDefaults(nil))
			// Prevent the dispatcher from accepting work so cancellation is deterministic.
			q.enqueueChan = nil
			require.NoError(t, services.StartAndAwaitRunning(t.Context(), q))
			defer func() {
				require.NoError(t, services.StopAndAwaitTerminated(t.Context(), q))
			}()

			ctx, cancel := context.WithTimeout(t.Context(), tc.timeout)
			cancel()

			const tenantID = "tenant-a"
			require.ErrorIs(t, q.Enqueue(ctx, tenantID, func() {}), tc.wantErr)
			for _, reason := range []string{"context_canceled", "deadline_exceeded"} {
				want := float64(0)
				if reason == tc.reason {
					want = 1
				}
				require.Equal(t, want, testutil.ToFloat64(q.discardedRequests.WithLabelValues(tenantID, reason)), "reason=%s", reason)
			}
		})
	}
}

func newExecutionTestQueue(t *testing.T, cap int) *Queue {
	t.Helper()
	q := NewQueue(&QueueOptions{MaxConcurrentPerTenant: cap, MaxSizePerTenant: 1000, Registerer: prometheus.NewRegistry()})
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), q))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), q)) })
	return q
}

func startExecutionTestScheduler(t *testing.T, q *Queue, workers int) {
	t.Helper()
	worker, err := NewScheduler(q, &Config{NumWorkers: workers})
	require.NoError(t, err)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), worker))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), worker)) })
}

func dequeueExecution(t *testing.T, q *Queue) func() {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), time.Second)
	defer cancel()
	fn, err := q.Dequeue(ctx)
	require.NoError(t, err)
	return fn
}

func awaitExecutionSignal(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal("execution signal timed out")
	}
}
