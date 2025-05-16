package qos

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestQueue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		opts QueueOptions
		test func(t *testing.T, q *Queue)
	}{
		{
			name: "Simple Enqueue and Dequeue",
			opts: QueueOptions{MaxSizePerTenant: 10},
			test: func(t *testing.T, q *Queue) {
				ctx := context.Background()
				var wg sync.WaitGroup
				const numItems = 5
				const tenantID = "tenant-a"

				// Enqueue items
				for i := 0; i < numItems; i++ {
					val := i // Capture loop variable
					err := q.Enqueue(ctx, tenantID, func() {
						// Simple work item
						_ = val
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
						runnable, ok, err := q.Dequeue(dequeueCtx)
						require.NoError(t, err, "Dequeue should succeed")
						require.True(t, ok, "Dequeue should return ok=true")
						require.NotNil(t, runnable, "Dequeued runnable should not be nil")
						// In a real test, you might execute runnable() and check side effects
						// For this basic test, just ensure we got something back.
						// Using atomics or mutexes for shared state like dequeuedCount is safer,
						// but for this simple case, direct increment might be okay assuming
						// the test framework handles goroutine safety.
						// Let's use a mutex for correctness.
						// Note: Mutex is not needed here as we are just counting in separate goroutines
						// and waiting on the WaitGroup. The final count check is outside the goroutines.
					}()
				}

				wg.Wait()

				// Let's simplify the dequeue check: Dequeue sequentially after enqueueing.
				qSimple := NewQueue(&QueueOptions{MaxSizePerTenant: 10})
				defer qSimple.Close()
				defer qSimple.StopWait()

				for i := 0; i < numItems; i++ {
					err := qSimple.Enqueue(ctx, tenantID, func() {})
					require.NoError(t, err)
				}
				require.Equal(t, numItems, qSimple.Len(), "Queue length after enqueue (simple)")
				require.Equal(t, 1, qSimple.ActiveTenantsLen(), "Active tenants after enqueue (simple)")

				for i := 0; i < numItems; i++ {
					dequeueCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
					runnable, ok, err := qSimple.Dequeue(dequeueCtx)
					cancel() // Cancel context after use
					require.NoError(t, err, "Dequeue %d should succeed (simple)", i)
					require.True(t, ok, "Dequeue %d should return ok=true (simple)", i)
					require.NotNil(t, runnable, "Dequeued runnable %d should not be nil (simple)", i)
				}

				require.Equal(t, 0, qSimple.Len(), "Queue length after dequeue (simple)")
				require.Equal(t, 0, qSimple.ActiveTenantsLen(), "Active tenants after dequeue (simple)")

				// Check dequeue on empty queue times out
				dequeueCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
				_, ok, err := qSimple.Dequeue(dequeueCtx)
				cancel()
				require.ErrorIs(t, err, context.DeadlineExceeded, "Dequeue on empty queue should time out")
				require.False(t, ok, "Dequeue on empty queue should return ok=false")

			},
		},
		{
			name: "Round Robin Between Tenants",
			opts: QueueOptions{MaxSizePerTenant: 5},
			test: func(t *testing.T, q *Queue) {
				ctx := context.Background()
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

				// First tenant A, then B, then A, then B
				err := q.Enqueue(ctx, tenantA, makeRunnable(tenantA))
				require.NoError(t, err)
				err = q.Enqueue(ctx, tenantB, makeRunnable(tenantB))
				require.NoError(t, err)
				err = q.Enqueue(ctx, tenantA, makeRunnable(tenantA))
				require.NoError(t, err)
				err = q.Enqueue(ctx, tenantB, makeRunnable(tenantB))
				require.NoError(t, err)

				// Verify queue state
				require.Equal(t, 4, q.Len(), "Queue should have 4 items")
				require.Equal(t, 2, q.ActiveTenantsLen(), "Should have 2 active tenants")

				// Use a longer timeout to handle CI environment variability
				dequeueTimeout := 3 * time.Second

				// Dequeue and execute the four items
				for i := 0; i < 4; i++ {
					// Use a more reliable context with longer timeout for CI environments
					dequeueCtx, cancel := context.WithTimeout(ctx, dequeueTimeout)
					runnable, ok, err := q.Dequeue(dequeueCtx)
					if !ok || err != nil {
						// If there's an error, let's check if queue state is still consistent
						t.Logf("Dequeue %d failed: ok=%v, err=%v", i, ok, err)
						t.Logf("Queue state: Len=%d, ActiveTenantsLen=%d", q.Len(), q.ActiveTenantsLen())
					}

					cancel()
					require.NoError(t, err, "Dequeue %d should succeed", i)
					require.True(t, ok, "Dequeue %d should return ok=true", i)
					require.NotNil(t, runnable, "Dequeued runnable %d should not be nil", i)
					runnable() // Execute to record the tenant ID
				}

				// Check execution order - should alternate between tenants
				resultsMu.Lock()
				expectedOrder := []string{tenantA, tenantB, tenantA, tenantB}
				equal := len(results) == len(expectedOrder)
				if equal {
					for i, v := range expectedOrder {
						if i >= len(results) || results[i] != v {
							equal = false
							break
						}
					}
				}

				if !equal {
					t.Errorf("Execution order mismatch: expected %v, got %v", expectedOrder, results)
				}
				resultsMu.Unlock()

				// Verify queue is now empty
				require.Equal(t, 0, q.Len())
				require.Equal(t, 0, q.ActiveTenantsLen())
			},
		},
		{
			name: "Tenant Queue Full Error",
			opts: QueueOptions{MaxSizePerTenant: 2},
			test: func(t *testing.T, q *Queue) {
				ctx := context.Background()
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
				_, ok, err := q.Dequeue(dequeueCtx)
				cancel()
				require.NoError(t, err)
				require.True(t, ok)
				require.Equal(t, 1, q.Len())

				// Now enqueue should succeed again
				err = q.Enqueue(ctx, tenantID, func() {})
				require.NoError(t, err, "Enqueue should succeed after dequeueing one item")
				require.Equal(t, 2, q.Len(), "Length should be back to 2")
			},
		},
		{
			name: "Close Queue",
			opts: QueueOptions{MaxSizePerTenant: 5},
			test: func(t *testing.T, q *Queue) {
				ctx := context.Background()
				tenantID := "tenant-a"

				// Create a channel to signal when the dequeue goroutine has started
				dequeueStarted := make(chan struct{})
				dequeueErrChan := make(chan error, 1)
				var wg sync.WaitGroup
				wg.Add(1)
				go func() {
					defer wg.Done()

					// Signal that we're about to start dequeuing
					close(dequeueStarted)

					// This will block until queue is closed or something is enqueued
					_, _, err := q.Dequeue(context.Background())
					dequeueErrChan <- err // Send the error result
				}()

				// Wait until the dequeue operation has started
				<-dequeueStarted

				// Close the queue - this should unblock the dequeue with ErrQueueClosed
				q.Close()

				// Verify the error is ErrQueueClosed
				select {
				case err := <-dequeueErrChan:
					require.ErrorIs(t, err, ErrQueueClosed, "Dequeue should return ErrQueueClosed when queue is closed")
				case <-time.After(3 * time.Second): // Longer timeout for CI environments
					t.Fatal("Timed out waiting for blocked Dequeue to return ErrQueueClosed")
				}

				// Wait for the dequeue goroutine to finish
				wg.Wait()

				// Further operations should error appropriately
				_, ok, err := q.Dequeue(ctx)
				require.ErrorIs(t, err, ErrQueueClosed, "Dequeue after Close should return ErrQueueClosed")
				require.False(t, ok, "Dequeue after Close should return ok=false")

				err = q.Enqueue(ctx, tenantID, func() {})
				require.ErrorIs(t, err, ErrQueueClosed, "Enqueue after Close should return ErrQueueClosed")

				// Stop the queue to clean up completely
				q.StopWait()
			},
		},
		{
			name: "Enqueue Context Cancellation",
			opts: QueueOptions{MaxSizePerTenant: 10}, // Use a higher limit to avoid queue full errors
			test: func(t *testing.T, q *Queue) {
				// Create an already canceled context instead of sleeping
				cancelCtx, cancel := context.WithCancel(context.Background())
				cancel() // Cancel immediately

				// This should fail with context canceled because the context is already canceled
				err := q.Enqueue(cancelCtx, "tenant-id", func() {})
				require.ErrorIs(t, err, context.Canceled, "Expected context canceled error")

				// Now verify the queue is still usable with a valid context
				err = q.Enqueue(context.Background(), "tenant-id", func() {})
				require.NoError(t, err, "Should be able to enqueue with valid context")

				// And we can dequeue
				dequeueCtx, dequeueCancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
				runnable, ok, err := q.Dequeue(dequeueCtx)
				dequeueCancel()
				require.NoError(t, err)
				require.True(t, ok)
				require.NotNil(t, runnable)
			},
		},
		{
			name: "Dequeue Context Cancellation",
			opts: QueueOptions{MaxSizePerTenant: 5},
			test: func(t *testing.T, q *Queue) {
				// Create an already canceled context instead of using timeout
				cancelCtx, cancel := context.WithCancel(context.Background())
				cancel() // Cancel immediately

				// This should return with context.Canceled error immediately
				runnable, ok, err := q.Dequeue(cancelCtx)

				// Verify the result - should be context.Canceled, not DeadlineExceeded
				require.Nil(t, runnable, "Runnable should be nil on context cancellation")
				require.False(t, ok, "ok should be false on context cancellation")
				require.ErrorIs(t, err, context.Canceled, "Expected context canceled error")
			},
		},
		// Add more test cases here
	}

	for _, tc := range tests {
		tc := tc // Capture range variable
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel() // Run table entries in parallel

			q := NewQueue(&tc.opts)
			// Defer close and stopwait to ensure cleanup even if test fails
			// Order matters: Close needs to be called before StopWait
			defer func() {
				q.Close()
				q.StopWait()
			}()

			tc.test(t, q)
		})
	}
}

// TestQueueCleanup tests that the queue can be properly closed and stopped.
// This is a basic sanity check to ensure our cleanup logic functions correctly.
func TestQueueCleanup(t *testing.T) {
	q := NewQueue(&QueueOptions{MaxSizePerTenant: 10})

	// Explicitly close and wait for dispatcher to stop
	q.Close()
	q.StopWait()

	// Queue should now be in a clean, shutdown state
	_, ok, err := q.Dequeue(context.Background())
	require.False(t, ok)
	require.ErrorIs(t, err, ErrQueueClosed)
}
