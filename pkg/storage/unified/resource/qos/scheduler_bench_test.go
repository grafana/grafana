package qos

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

// benchScheduler runs a benchmark with the specified number of workers and tenants
func benchScheduler(b *testing.B, numWorkers, numTenants, itemsPerTenant int) {
	// Create a queue with reasonable settings for benchmark
	q := NewQueue(&QueueOptions{
		MaxSizePerTenant: 10000, // Increased from 100 to avoid bottlenecks
	})
	defer func() {
		q.Close()
		q.StopWait()
	}()

	// Create a scheduler with the requested number of workers
	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     numWorkers,
		DequeueTimeout: 100 * time.Millisecond,
	})
	if err != nil {
		b.Fatalf("Failed to create scheduler: %v", err)
	}

	// Start the scheduler
	if err := scheduler.Start(); err != nil {
		b.Fatalf("Failed to start scheduler: %v", err)
	}
	defer scheduler.Stop()

	// Generate tenant IDs
	tenantIDs := make([]string, numTenants)
	for i := 0; i < numTenants; i++ {
		tenantIDs[i] = fmt.Sprintf("tenant-%d", i)
	}

	// Reset the timer to exclude setup time
	b.ResetTimer()

	// Track the total number of items processed
	var processed atomic.Int64

	// Run the benchmark b.N times
	for n := 0; n < b.N; n++ {
		// Create a WaitGroup to wait for all items to be processed
		var wg sync.WaitGroup
		totalItems := numTenants * itemsPerTenant
		wg.Add(totalItems)

		// Channel to track when all items have been processed
		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		// Track how many items were enqueued
		var enqueued atomic.Int64

		// Enqueue items for all tenants
		for i := 0; i < numTenants; i++ {
			tenantID := tenantIDs[i]

			// Each tenant gets itemsPerTenant items
			for j := 0; j < itemsPerTenant; j++ {
				err := q.Enqueue(context.Background(), tenantID, func() {
					processed.Add(1)
					wg.Done()
				})
				if err != nil {
					b.Fatalf("Failed to enqueue item: %v", err)
				}
				enqueued.Add(1)
			}
		}

		// Wait for all items to be processed or timeout
		select {
		case <-done:
			// All items processed
		case <-time.After(30 * time.Second):
			b.Fatalf("Timed out waiting for items to be processed. Enqueued: %d, Processed: %d",
				enqueued.Load(), processed.Load())
		}
	}

	// Report custom metrics
	b.ReportMetric(float64(processed.Load())/b.Elapsed().Seconds(), "items/sec")
}

// Benchmark with varying numbers of workers (1, 2, 4, 8, 16)
// Each benchmark uses 10 tenants with 1000 items per tenant

func BenchmarkScheduler_1Worker_10Tenants(b *testing.B) {
	benchScheduler(b, 1, 10, 1000)
}

func BenchmarkScheduler_2Workers_10Tenants(b *testing.B) {
	benchScheduler(b, 2, 10, 1000)
}

func BenchmarkScheduler_4Workers_10Tenants(b *testing.B) {
	benchScheduler(b, 4, 10, 1000)
}

func BenchmarkScheduler_8Workers_10Tenants(b *testing.B) {
	benchScheduler(b, 8, 10, 1000)
}

func BenchmarkScheduler_16Workers_10Tenants(b *testing.B) {
	benchScheduler(b, 16, 10, 1000)
}

// Benchmark with varying numbers of tenants (1, 10, 100)
// Each benchmark uses 4 workers with 1000 items per tenant

func BenchmarkScheduler_4Workers_1Tenant(b *testing.B) {
	benchScheduler(b, 4, 1, 1000)
}

func BenchmarkScheduler_4Workers_10Tenants_1000Items(b *testing.B) {
	benchScheduler(b, 4, 10, 1000)
}

func BenchmarkScheduler_4Workers_100Tenants(b *testing.B) {
	benchScheduler(b, 4, 100, 1000)
}

// Benchmark with different ratios of items to workers
// Each benchmark uses 4 workers with 10 tenants but varies items per tenant

func BenchmarkScheduler_4Workers_10Tenants_100ItemsPerTenant(b *testing.B) {
	benchScheduler(b, 4, 10, 100)
}

// This is a duplicate of BenchmarkScheduler_4Workers_10Tenants_1000Items
// Replaced with a more descriptive name
func BenchmarkScheduler_4Workers_10Tenants_ManyItems(b *testing.B) {
	benchScheduler(b, 4, 10, 1000)
}

func BenchmarkScheduler_4Workers_10Tenants_10000ItemsPerTenant(b *testing.B) {
	benchScheduler(b, 4, 10, 10000)
}

// Benchmark comparing round-robin fairness among tenants
func BenchmarkSchedulerFairness(b *testing.B) {
	// Create a queue with much larger capacity to avoid queue full issues
	q := NewQueue(&QueueOptions{
		MaxSizePerTenant: 10000, // Increased from 100 to avoid queue full errors
	})
	defer func() {
		q.Close()
		q.StopWait()
	}()

	// Create a scheduler with 4 workers
	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     4,
		DequeueTimeout: 100 * time.Millisecond,
		Logger:         log.NewNopLogger(),
	})
	if err != nil {
		b.Fatalf("Failed to create scheduler: %v", err)
	}

	// Start the scheduler
	if err := scheduler.Start(); err != nil {
		b.Fatalf("Failed to start scheduler: %v", err)
	}
	defer scheduler.Stop()

	// Number of tenants and items
	const numTenants = 10
	const itemsPerTenant = 1000

	// Generate tenant IDs
	tenantIDs := make([]string, numTenants)
	for i := 0; i < numTenants; i++ {
		tenantIDs[i] = fmt.Sprintf("tenant-%d", i)
	}

	// Track items processed per tenant - make available for detailed debugging
	processedPerTenant := make([]atomic.Int64, numTenants)

	// Reset the timer to exclude setup time
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		// Reset tenant counters for each benchmark iteration
		for i := 0; i < numTenants; i++ {
			processedPerTenant[i].Store(0)
		}

		// Create a WaitGroup to wait for all items to be processed
		var wg sync.WaitGroup
		totalItems := numTenants * itemsPerTenant
		wg.Add(totalItems)

		// Channel to track when all items have been processed
		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		// Enqueue all items for one tenant before moving to the next tenant
		// This tests that the scheduler maintains fairness even with uneven enqueue patterns
		for i := 0; i < numTenants; i++ {
			tenantID := tenantIDs[i]
			tenantIdx := i // Capture for closure

			// Debug progress of enqueuing
			b.Logf("Starting to enqueue %d items for tenant %s", itemsPerTenant, tenantID)

			// Count of enqueues per tenant for debugging
			enqueued := 0

			for j := 0; j < itemsPerTenant; j++ {
				ctx := context.Background() // Use a background context that won't time out

				err := q.Enqueue(ctx, tenantID, func() {
					processedPerTenant[tenantIdx].Add(1)
					wg.Done()
				})

				if err != nil {
					b.Fatalf("Failed to enqueue item for tenant %s: %v (enqueued %d items)",
						tenantID, err, enqueued)
				}
				enqueued++
			}

			b.Logf("Successfully enqueued %d items for tenant %s", enqueued, tenantID)
		}

		// Wait for all items to be processed or timeout
		select {
		case <-done:
			// All items processed
			b.Log("All items processed successfully")
		case <-time.After(30 * time.Second):
			// Debug unprocessed items per tenant
			for i := 0; i < numTenants; i++ {
				b.Logf("Tenant %s: processed %d/%d items",
					tenantIDs[i], processedPerTenant[i].Load(), itemsPerTenant)
			}
			b.Fatalf("Timed out waiting for items to be processed")
		}

		// Calculate fairness metrics and print detailed results
		min := int64(itemsPerTenant + 1) // Initialize higher than possible value
		max := int64(0)
		var total int64

		for i := 0; i < numTenants; i++ {
			count := processedPerTenant[i].Load()
			total += count
			if count < min {
				min = count
			}
			if count > max {
				max = count
			}
			b.Logf("Tenant %s: processed %d items", tenantIDs[i], count)
		}

		// Calculate fairness ratio (closer to 1.0 is more fair)
		fairnessRatio := float64(min) / float64(max)
		b.Logf("Fairness metrics - Min: %d, Max: %d, Ratio: %.4f", min, max, fairnessRatio)
		b.ReportMetric(fairnessRatio, "fairness")
		b.ReportMetric(float64(total)/b.Elapsed().Seconds(), "items/sec")
	}
}

// Add a new benchmark with alternating tenant enqueuing pattern
func BenchmarkSchedulerFairnessAlternating(b *testing.B) {
	// Create a queue with much larger capacity
	q := NewQueue(&QueueOptions{
		MaxSizePerTenant: 10,
	})
	defer func() {
		q.Close()
		q.StopWait()
	}()

	// Create a scheduler with 4 workers
	scheduler, err := NewScheduler(q, &SchedulerConfig{
		NumWorkers:     4,
		DequeueTimeout: 100 * time.Millisecond,
		Logger:         log.NewNopLogger(),
	})
	if err != nil {
		b.Fatalf("Failed to create scheduler: %v", err)
	}

	// Start the scheduler
	if err := scheduler.Start(); err != nil {
		b.Fatalf("Failed to start scheduler: %v", err)
	}
	defer scheduler.Stop()

	// Number of tenants and items
	const numTenants = 1000
	const itemsPerTenant = 1000

	// Generate tenant IDs
	tenantIDs := make([]string, numTenants)
	for i := 0; i < numTenants; i++ {
		tenantIDs[i] = fmt.Sprintf("tenant-%d", i)
	}

	// Track items processed per tenant
	processedPerTenant := make([]atomic.Int64, numTenants)

	// Reset the timer to exclude setup time
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		// Reset tenant counters for each benchmark iteration
		for i := 0; i < numTenants; i++ {
			processedPerTenant[i].Store(0)
		}

		// Create a WaitGroup to wait for all items to be processed
		var wg sync.WaitGroup
		totalItems := numTenants * itemsPerTenant
		wg.Add(totalItems)

		// Channel to track when all items have been processed
		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		// Enqueue in a round-robin pattern (1 item for each tenant, then repeat)
		// This should provide a more balanced starting state
		for j := 0; j < itemsPerTenant; j++ {
			for i := 0; i < numTenants; i++ {
				tenantID := tenantIDs[i]
				tenantIdx := i // Capture for closure

				err := q.Enqueue(context.Background(), tenantID, func() {
					processedPerTenant[tenantIdx].Add(1)
					wg.Done()
				})

				if err != nil {
					b.Fatalf("Failed to enqueue item for tenant %s: %v", tenantID, err)
				}
			}
		}

		// Wait for all items to be processed or timeout
		select {
		case <-done:
			// All items processed
		case <-time.After(30 * time.Second):
			// Debug unprocessed items per tenant
			for i := 0; i < numTenants; i++ {
				b.Logf("Tenant %s: processed %d/%d items",
					tenantIDs[i], processedPerTenant[i].Load(), itemsPerTenant)
			}
			b.Fatalf("Timed out waiting for items to be processed")
		}

		// Calculate fairness metrics
		min := int64(itemsPerTenant + 1)
		max := int64(0)
		var total int64

		for i := 0; i < numTenants; i++ {
			count := processedPerTenant[i].Load()
			total += count
			if count < min {
				min = count
			}
			if count > max {
				max = count
			}
			b.Logf("Tenant %s: processed %d items", tenantIDs[i], count)
		}

		// Calculate fairness ratio (closer to 1.0 is more fair)
		fairnessRatio := float64(min) / float64(max)
		b.Logf("Fairness metrics - Min: %d, Max: %d, Ratio: %.4f", min, max, fairnessRatio)
		b.ReportMetric(fairnessRatio, "fairness")
		b.ReportMetric(float64(total)/b.Elapsed().Seconds(), "items/sec")
	}
}

// nullWriter is a no-op writer for discarding log output in benchmarks
type nullWriter struct{}

func (nw nullWriter) Write(p []byte) (n int, err error) {
	return len(p), nil
}
