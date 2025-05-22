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

func benchScheduler(b *testing.B, numWorkers, numTenants, itemsPerTenant int) {
	tenantIDs := make([]string, numTenants)
	for i := range tenantIDs {
		tenantIDs[i] = fmt.Sprintf("tenant-%d", i)
	}

	b.ResetTimer()
	var processed atomic.Int64

	for n := 0; n < b.N; n++ {
		q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{
			MaxSizePerTenant: 10000,
		}))
		scheduler, err := NewScheduler(q, &Config{
			NumWorkers: numWorkers,
			MaxBackoff: 100 * time.Millisecond,
		})
		require.NoError(b, err)

		scheduler.StartAsync(context.Background())
		require.NoError(b, scheduler.AwaitRunning(context.Background()))

		var wg sync.WaitGroup
		totalItems := numTenants * itemsPerTenant
		wg.Add(totalItems)

		for i := 0; i < numTenants; i++ {
			tenantID := tenantIDs[i]
			for j := 0; j < itemsPerTenant; j++ {
				require.NoError(b, q.Enqueue(context.Background(), tenantID, func() {
					processed.Add(1)
					wg.Done()
				}))
			}
		}

		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(30 * time.Second):
			b.Fatalf("Timed out: Enqueued=%d, Processed=%d", totalItems, processed.Load())
		}

		scheduler.StopAsync()
		require.NoError(b, scheduler.AwaitTerminated(context.Background()))
		require.Equal(b, services.Terminated, scheduler.State())
	}

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
	q := NewQueue(QueueOptionsWithDefaults(&QueueOptions{MaxSizePerTenant: 10000}))
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		q.AwaitTerminated(ctx)
	}()

	scheduler, err := NewScheduler(q, &Config{
		NumWorkers: 4,
		MaxBackoff: 100 * time.Millisecond,
		Logger:     log.NewNopLogger(),
	})
	require.NoError(b, err)

	scheduler.StartAsync(context.Background())
	require.NoError(b, scheduler.AwaitRunning(context.Background()))
	defer func() {
		scheduler.StopAsync()
		require.NoError(b, scheduler.AwaitTerminated(context.Background()))
	}()

	const numTenants = 10
	const itemsPerTenant = 1000

	tenantIDs := make([]string, numTenants)
	for i := range tenantIDs {
		tenantIDs[i] = fmt.Sprintf("tenant-%d", i)
	}
	processedPerTenant := make([]atomic.Int64, numTenants)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		for i := range processedPerTenant {
			processedPerTenant[i].Store(0)
		}
		var wg sync.WaitGroup
		totalItems := numTenants * itemsPerTenant
		wg.Add(totalItems)

		for i := 0; i < numTenants; i++ {
			tenantID := tenantIDs[i]
			tenantIdx := i
			for j := 0; j < itemsPerTenant; j++ {
				require.NoError(b, q.Enqueue(context.Background(), tenantID, func() {
					processedPerTenant[tenantIdx].Add(1)
					wg.Done()
				}))
			}
		}

		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(30 * time.Second):
			b.Fatalf("Timed out waiting for items to be processed")
		}

		min, max, total := int64(itemsPerTenant+1), int64(0), int64(0)
		for i := 0; i < numTenants; i++ {
			count := processedPerTenant[i].Load()
			total += count
			if count < min {
				min = count
			}
			if count > max {
				max = count
			}
		}
		fairnessRatio := float64(min) / float64(max)
		b.ReportMetric(fairnessRatio, "fairness")
		b.ReportMetric(float64(total)/b.Elapsed().Seconds(), "items/sec")
	}
}

// Add a new benchmark with alternating tenant enqueuing pattern
func BenchmarkSchedulerFairnessAlternating(b *testing.B) {
	q := NewQueue(QueueOptionsWithDefaults(nil))
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		q.AwaitTerminated(ctx)
	}()

	scheduler, err := NewScheduler(q, &Config{
		NumWorkers: 4,
		MaxBackoff: 100 * time.Millisecond,
		Logger:     log.NewNopLogger(),
	})
	require.NoError(b, err)

	scheduler.StartAsync(context.Background())
	require.NoError(b, scheduler.AwaitRunning(context.Background()))
	defer func() {
		scheduler.StopAsync()
		require.NoError(b, scheduler.AwaitTerminated(context.Background()))
	}()

	const numTenants = 1000
	const itemsPerTenant = 1000

	tenantIDs := make([]string, numTenants)
	for i := 0; i < numTenants; i++ {
		tenantIDs[i] = fmt.Sprintf("tenant-%d", i)
	}
	processedPerTenant := make([]atomic.Int64, numTenants)

	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		for i := 0; i < numTenants; i++ {
			processedPerTenant[i].Store(0)
		}
		var wg sync.WaitGroup
		totalItems := numTenants * itemsPerTenant
		wg.Add(totalItems)

		// Enqueue in a round-robin pattern: 1 item per tenant per round
		for j := 0; j < itemsPerTenant; j++ {
			for i := 0; i < numTenants; i++ {
				tenantID := tenantIDs[i]
				tenantIdx := i
				require.NoError(b, q.Enqueue(context.Background(), tenantID, func() {
					processedPerTenant[tenantIdx].Add(1)
					wg.Done()
				}))
			}
		}

		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(30 * time.Second):
			b.Fatalf("Timed out waiting for items to be processed")
		}

		min, max, total := int64(itemsPerTenant+1), int64(0), int64(0)
		for i := 0; i < numTenants; i++ {
			count := processedPerTenant[i].Load()
			total += count
			if count < min {
				min = count
			}
			if count > max {
				max = count
			}
		}
		fairnessRatio := float64(min) / float64(max)
		b.ReportMetric(fairnessRatio, "fairness")
		b.ReportMetric(float64(total)/b.Elapsed().Seconds(), "items/sec")
	}
}
