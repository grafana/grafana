package test

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"github.com/stretchr/testify/require"
)

// BenchmarkOptions configures the benchmark parameters
type BenchmarkOptions struct {
	NumResources     int // total number of resources to write
	Concurrency      int // number of concurrent writers
	NumNamespaces    int // number of different namespaces
	NumGroups        int // number of different groups
	NumResourceTypes int // number of different resource types
}

// DefaultBenchmarkOptions returns the default benchmark options
func DefaultBenchmarkOptions() *BenchmarkOptions {
	return &BenchmarkOptions{
		NumResources:     1000,
		Concurrency:      50,
		NumNamespaces:    1,
		NumGroups:        1,
		NumResourceTypes: 1,
	}
}

// BenchmarkResult contains the benchmark metrics
type BenchmarkResult struct {
	TotalDuration time.Duration
	WriteCount    int
	Throughput    float64 // writes per second
	P50Latency    time.Duration
	P90Latency    time.Duration
	P99Latency    time.Duration
}

// initializeBackend sets up the backend with initial resources for each group and resource type combination
func initializeBackend(ctx context.Context, backend resource.StorageBackend, opts *BenchmarkOptions) error {
	for ns := 0; ns < opts.NumNamespaces; ns++ {
		namespace := fmt.Sprintf("ns-%d", ns)
		for g := 0; g < opts.NumGroups; g++ {
			group := fmt.Sprintf("group-%d", g)
			for r := 0; r < opts.NumResourceTypes; r++ {
				resourceType := fmt.Sprintf("resource-%d", r)
				_, err := writeEvent(ctx, backend, "init", resourcepb.WatchEvent_ADDED,
					WithNamespace(namespace),
					WithGroup(group),
					WithResource(resourceType),
					WithValue("init"))
				if err != nil {
					return fmt.Errorf("failed to initialize backend: %w", err)
				}
			}
		}
	}
	return nil
}

// runStorageBackendBenchmark runs a write throughput benchmark
func runStorageBackendBenchmark(ctx context.Context, backend resource.StorageBackend, opts *BenchmarkOptions) (*BenchmarkResult, error) {
	if opts == nil {
		opts = DefaultBenchmarkOptions()
	}

	// Create channels for workers
	jobs := make(chan int, opts.NumResources)
	results := make(chan time.Duration, opts.NumResources)
	errors := make(chan error, opts.NumResources)

	// Fill the jobs channel
	for i := 0; i < opts.NumResources; i++ {
		jobs <- i
	}
	close(jobs)

	var wg sync.WaitGroup

	// Start workers
	startTime := time.Now()
	for workerID := 0; workerID < opts.Concurrency; workerID++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for jobID := range jobs {
				// Calculate a unique ID for this job that's guaranteed to be unique across all workers
				uniqueID := jobID

				// Generate deterministic and unique resource details
				namespace := fmt.Sprintf("ns-%d", uniqueID%opts.NumNamespaces)
				group := fmt.Sprintf("group-%d", uniqueID%opts.NumGroups)
				resourceType := fmt.Sprintf("resource-%d", uniqueID%opts.NumResourceTypes)
				// Ensure name is unique by using the global uniqueID
				name := fmt.Sprintf("item-%d", uniqueID)

				writeStart := time.Now()
				_, err := writeEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED,
					WithNamespace(namespace),
					WithGroup(group),
					WithResource(resourceType),
					WithValue(strings.Repeat("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20))) // ~1.21 KiB

				if err != nil {
					errors <- err
					return
				}

				results <- time.Since(writeStart)
			}
		}()
	}

	// Wait for all workers to complete
	wg.Wait()
	close(results)
	close(errors)

	// Check for errors
	if len(errors) > 0 {
		return nil, <-errors // Return the first error encountered
	}

	// Collect all latencies
	latencies := make([]time.Duration, 0, opts.NumResources)
	for latency := range results {
		latencies = append(latencies, latency)
	}

	// Sort latencies for percentile calculation
	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	totalDuration := time.Since(startTime)
	throughput := float64(opts.NumResources) / totalDuration.Seconds()

	return &BenchmarkResult{
		TotalDuration: totalDuration,
		WriteCount:    opts.NumResources,
		Throughput:    throughput,
		P50Latency:    latencies[len(latencies)*50/100],
		P90Latency:    latencies[len(latencies)*90/100],
		P99Latency:    latencies[len(latencies)*99/100],
	}, nil
}

// BenchmarkStorageBackend runs a benchmark test for a storage backend implementation
func BenchmarkStorageBackend(b testing.TB, backend resource.StorageBackend, opts *BenchmarkOptions) {
	ctx := context.Background()

	// Initialize the backend
	err := initializeBackend(ctx, backend, opts)
	require.NoError(b, err)

	// Run the benchmark
	result, err := runStorageBackendBenchmark(ctx, backend, opts)
	require.NoError(b, err)

	// Only report metrics if we're running a benchmark
	if bb, ok := b.(*testing.B); ok {
		bb.ReportMetric(result.Throughput, "writes/sec")
		bb.ReportMetric(float64(result.P50Latency.Milliseconds()), "p50-latency-ms")
		bb.ReportMetric(float64(result.P90Latency.Milliseconds()), "p90-latency-ms")
		bb.ReportMetric(float64(result.P99Latency.Milliseconds()), "p99-latency-ms")
	}

	// Also log the results for better visibility
	b.Logf("Benchmark Configuration: Workers=%d, Resources=%d, Namespaces=%d, Groups=%d, Resource Types=%d", opts.Concurrency, opts.NumResources, opts.NumNamespaces, opts.NumGroups, opts.NumResourceTypes)
	b.Logf("")
	b.Logf("Benchmark Results:")
	b.Logf("Total Duration: %v", result.TotalDuration)
	b.Logf("Write Count: %d", result.WriteCount)
	b.Logf("Throughput: %.2f writes/sec", result.Throughput)
	b.Logf("P50 Latency: %v", result.P50Latency)
	b.Logf("P90 Latency: %v", result.P90Latency)
	b.Logf("P99 Latency: %v", result.P99Latency)
}

// runSearchBackendBenchmarkWriteThroughput runs a write throughput benchmark for search backend
// This is a simple benchmark that writes a single resource/group/namespace because indices are per-tenant/group/resource.
func runSearchBackendBenchmarkWriteThroughput(ctx context.Context, backend resource.SearchBackend, opts *BenchmarkOptions) (*BenchmarkResult, error) {
	if opts == nil {
		opts = DefaultBenchmarkOptions()
	}

	// Create channels for workers
	jobs := make(chan int, opts.NumResources)
	results := make(chan time.Duration, opts.NumResources)
	errors := make(chan error, opts.NumResources)

	// Fill the jobs channel
	for i := 0; i < opts.NumResources; i++ {
		jobs <- i
	}
	close(jobs)

	var wg sync.WaitGroup

	// Initialize namespace and resource type
	nr := resource.NamespacedResource{
		Namespace: "ns-init",
		Group:     "group",
		Resource:  "resource",
	}

	// Build initial index
	size := int64(10000) // force the index to be on disk
	index, err := backend.BuildIndex(ctx, nr, size, 0, nil, "benchmark", func(index resource.ResourceIndex) (int64, error) {
		return 0, nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize backend: %w", err)
	}

	// Start workers
	startTime := time.Now()
	for workerID := 0; workerID < opts.Concurrency; workerID++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			batch := make([]*resource.BulkIndexItem, 0, 1000)

			for jobID := range jobs {
				doc := &resource.IndexableDocument{
					Key: &resourcepb.ResourceKey{
						Namespace: nr.Namespace,
						Group:     nr.Group,
						Resource:  nr.Resource,
						Name:      fmt.Sprintf("item-%d", jobID),
					},
					Title: fmt.Sprintf("Document %d", jobID),
					Tags:  []string{"tag1", "tag2"},
					Fields: map[string]interface{}{
						"field1": jobID,
						"field2": fmt.Sprintf("value-%d", jobID),
					},
				}

				batch = append(batch, &resource.BulkIndexItem{
					Action: resource.ActionIndex,
					Doc:    doc,
				})

				// If we've collected 100 items or this is the last job, process the batch
				if len(batch) == 100 || jobID == opts.NumResources-1 {
					writeStart := time.Now()
					err := index.BulkIndex(&resource.BulkIndexRequest{
						Items: batch,
					})
					if err != nil {
						errors <- err
						return
					}

					// Record the latency for each document in the batch
					latency := time.Since(writeStart)
					for i := 0; i < len(batch); i++ {
						results <- latency
					}

					// Reset the batch
					batch = batch[:0]
				}
			}
		}()
	}

	// Wait for all workers to complete
	wg.Wait()
	close(results)
	close(errors)

	// Check for errors
	if len(errors) > 0 {
		return nil, <-errors // Return the first error encountered
	}

	// Collect all latencies
	latencies := make([]time.Duration, 0, opts.NumResources)
	for latency := range results {
		latencies = append(latencies, latency)
	}

	// Sort latencies for percentile calculation
	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	totalDuration := time.Since(startTime)
	throughput := float64(opts.NumResources) / totalDuration.Seconds()

	return &BenchmarkResult{
		TotalDuration: totalDuration,
		WriteCount:    opts.NumResources,
		Throughput:    throughput,
		P50Latency:    latencies[len(latencies)*50/100],
		P90Latency:    latencies[len(latencies)*90/100],
		P99Latency:    latencies[len(latencies)*99/100],
	}, nil
}

// BenchmarkSearchBackend runs a benchmark test for a search backend implementation
func BenchmarkSearchBackend(tb testing.TB, backend resource.SearchBackend, opts *BenchmarkOptions) {
	ctx := context.Background()

	result, err := runSearchBackendBenchmarkWriteThroughput(ctx, backend, opts)
	require.NoError(tb, err)

	if b, ok := tb.(*testing.B); ok {
		b.ReportMetric(result.Throughput, "writes/sec")
		b.ReportMetric(float64(result.P50Latency.Milliseconds()), "p50-latency-ms")
		b.ReportMetric(float64(result.P90Latency.Milliseconds()), "p90-latency-ms")
		b.ReportMetric(float64(result.P99Latency.Milliseconds()), "p99-latency-ms")
	}

	// Also log the results for better visibility
	tb.Logf("Benchmark Configuration: Workers=%d, Resources=%d, Namespaces=%d, Groups=%d, Resource Types=%d", opts.Concurrency, opts.NumResources, opts.NumNamespaces, opts.NumGroups, opts.NumResourceTypes)
	tb.Logf("")
	tb.Logf("Benchmark Results:")
	tb.Logf("Total Duration: %v", result.TotalDuration)
	tb.Logf("Write Count: %d", result.WriteCount)
	tb.Logf("Throughput: %.2f writes/sec", result.Throughput)
	tb.Logf("P50 Latency: %v", result.P50Latency)
	tb.Logf("P90 Latency: %v", result.P90Latency)
	tb.Logf("P99 Latency: %v", result.P99Latency)
}

func BenchmarkIndexServer(tb testing.TB, ctx context.Context, backend resource.StorageBackend, searchBackend resource.SearchBackend, opts *BenchmarkOptions) {
	events := make(chan *resource.IndexEvent, opts.NumResources)
	groupsResources := make(map[string]string)
	for g := 0; g < opts.NumGroups; g++ {
		for r := 0; r < opts.NumResourceTypes; r++ {
			groupsResources[fmt.Sprintf("group-%d", g)] = fmt.Sprintf("resource-%d", r)
		}
	}
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
		Search: resource.SearchOptions{
			Backend:         searchBackend,
			IndexEventsChan: events,
			Resources:       &resource.TestDocumentBuilderSupplier{GroupsResources: groupsResources},
		},
	})
	require.NoError(tb, err)
	require.NotNil(tb, server)

	// Initialize the backend
	err = initializeBackend(ctx, backend, opts)
	require.NoError(tb, err)

	// Discard the latencies from the initial index build.
	for i := 0; i < (opts.NumGroups * opts.NumResourceTypes * opts.NumNamespaces); i++ {
		<-events
	}

	// Run the storage backend benchmark write throughput to create events
	startTime := time.Now()
	var result *BenchmarkResult
	// Channel to signal when the benchmark goroutine completes
	benchmarkDone := make(chan struct{})

	go func() {
		defer close(benchmarkDone)
		result, err = runStorageBackendBenchmark(ctx, backend, opts)
		require.NoError(tb, err)
	}()

	// Wait for all events to be processed
	latencies := make([]float64, 0, opts.NumResources)
	for i := 0; i < opts.NumResources; i++ {
		evt := <-events
		latencies = append(latencies, evt.Latency.Seconds())
	}
	totalDuration := time.Since(startTime)

	<-benchmarkDone
	// Calculate index latency percentiles
	sort.Float64s(latencies)
	var p50, p90, p99 float64
	if len(latencies) > 0 {
		p50 = latencies[len(latencies)*50/100]
		p90 = latencies[len(latencies)*90/100]
		p99 = latencies[len(latencies)*99/100]
	}

	// Report metrics if running a benchmark
	if b, ok := tb.(*testing.B); ok {
		b.ReportMetric(result.Throughput, "writes/sec")
		b.ReportMetric(float64(result.P50Latency.Milliseconds()), "p50-latency-ms")
		b.ReportMetric(float64(result.P90Latency.Milliseconds()), "p90-latency-ms")
		b.ReportMetric(float64(result.P99Latency.Milliseconds()), "p99-latency-ms")
		b.ReportMetric(p50, "p50-index-latency-s")
		b.ReportMetric(p90, "p90-index-latency-s")
		b.ReportMetric(p99, "p99-index-latency-s")
	}

	// Log results for better visibility
	tb.Logf("Benchmark Configuration: Workers=%d, Resources=%d, Namespaces=%d, Groups=%d, Resource Types=%d",
		opts.Concurrency, opts.NumResources, opts.NumNamespaces, opts.NumGroups, opts.NumResourceTypes)
	tb.Logf("")
	tb.Logf("Storage Benchmark Results:")
	tb.Logf("Total Duration: %v", result.TotalDuration)
	tb.Logf("Storage Write Count: %d", result.WriteCount)
	tb.Logf("Storage Write Throughput: %.2f writes/sec", result.Throughput)
	tb.Logf("P50 Write Latency: %v", result.P50Latency)
	tb.Logf("P90 Write Latency: %v", result.P90Latency)
	tb.Logf("P99 Write Latency: %v", result.P99Latency)
	tb.Logf("")
	tb.Logf("Index Latency Results:")
	tb.Logf("Indexing Throughput: %.2f events/sec", float64(len(latencies))/totalDuration.Seconds())
	tb.Logf("P50 Index Latency: %.3fs", p50)
	tb.Logf("P90 Index Latency: %.3fs", p90)
	tb.Logf("P99 Index Latency: %.3fs", p99)
}
