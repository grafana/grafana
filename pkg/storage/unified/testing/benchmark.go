package test

import (
	"context"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"golang.org/x/sync/errgroup"

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
func DefaultBenchmarkOptions(t *testing.T) *BenchmarkOptions {
	envOrDefault := func(name string, defaultVal int) int {
		envVar := fmt.Sprintf("US_BACKEND_BENCH_%s", name)
		if str := os.Getenv(envVar); str != "" {
			n, err := strconv.ParseInt(str, 10, 64)
			require.NoError(t, err)

			return int(n)
		}

		return defaultVal
	}

	return &BenchmarkOptions{
		NumResources:     envOrDefault("RESOURCES", 1000),
		Concurrency:      envOrDefault("CONCURRENCY", 50),
		NumNamespaces:    envOrDefault("NAMESPACES", 1),
		NumGroups:        envOrDefault("GROUPS", 1),
		NumResourceTypes: envOrDefault("RESOURCE_TYPES", 1),
	}
}

func (opts *BenchmarkOptions) String() string {
	return fmt.Sprintf(
		"Workers=%d, Resources=%d, Namespaces=%d, Groups=%d, Resource Types=%d",
		opts.Concurrency, opts.NumResources, opts.NumNamespaces, opts.NumGroups, opts.NumResourceTypes,
	)
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
				_, err := WriteEvent(ctx, backend, "init", resourcepb.WatchEvent_ADDED,
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
	// Create channels for workers
	jobs := make(chan int, opts.NumResources)
	latencies := make([]time.Duration, opts.NumResources)

	// Fill the jobs channel
	for i := 0; i < opts.NumResources; i++ {
		jobs <- i
	}
	close(jobs)

	g, ctx := errgroup.WithContext(ctx)

	// Start workers
	startTime := time.Now()
	for workerID := 0; workerID < opts.Concurrency; workerID++ {
		g.Go(func() error {
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
				_, err := WriteEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED,
					WithNamespace(namespace),
					WithGroup(group),
					WithResource(resourceType),
					WithValue(strings.Repeat("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20))) // ~1.21 KiB

				if err != nil {
					return err
				}

				latencies[jobID] = time.Since(writeStart)
			}

			return nil
		})
	}

	// Wait for all workers to complete
	if err := g.Wait(); err != nil {
		return nil, err
	}

	totalDuration := time.Since(startTime)
	throughput := float64(opts.NumResources) / totalDuration.Seconds()

	// Sort latencies for percentile calculation
	slices.Sort(latencies)

	return &BenchmarkResult{
		TotalDuration: totalDuration,
		WriteCount:    opts.NumResources,
		Throughput:    throughput,
		P50Latency:    latencies[len(latencies)*50/100],
		P90Latency:    latencies[len(latencies)*90/100],
		P99Latency:    latencies[len(latencies)*99/100],
	}, nil
}

// RunStorageBackendBenchmark runs a benchmark test for a storage backend implementation
func RunStorageBackendBenchmark(t *testing.T, backend resource.StorageBackend, opts *BenchmarkOptions) {
	// Initialize the backend
	require.NoError(t, initializeBackend(t.Context(), backend, opts))

	// Run the benchmark
	result, err := runStorageBackendBenchmark(t.Context(), backend, opts)
	require.NoError(t, err)

	// Log the results for better visibility.
	t.Logf("Benchmark Configuration: %s", opts)
	t.Logf("")
	t.Logf("Benchmark Results:")
	t.Logf("Total Duration: %v", result.TotalDuration)
	t.Logf("Write Count: %d", result.WriteCount)
	t.Logf("Throughput: %.2f writes/sec", result.Throughput)
	t.Logf("P50 Latency: %v", result.P50Latency)
	t.Logf("P90 Latency: %v", result.P90Latency)
	t.Logf("P99 Latency: %v", result.P99Latency)
}

// runSearchBackendBenchmarkWriteThroughput runs a write throughput benchmark for search backend
// This is a simple benchmark that writes a single resource/group/namespace because indices are per-tenant/group/resource.
func runSearchBackendBenchmarkWriteThroughput(ctx context.Context, backend resource.SearchBackend, opts *BenchmarkOptions) (*BenchmarkResult, error) {
	// Create channels for workers
	jobs := make(chan int, opts.NumResources)
	latencies := make([]time.Duration, opts.NumResources)

	// Fill the jobs channel
	for i := 0; i < opts.NumResources; i++ {
		jobs <- i
	}
	close(jobs)

	g, ctx := errgroup.WithContext(ctx)

	// Initialize namespace and resource type
	nr := resource.NamespacedResource{
		Namespace: "ns-init",
		Group:     "group",
		Resource:  "resource",
	}

	// Build initial index
	size := int64(10000) // force the index to be on disk
	index, err := backend.BuildIndex(ctx, nr, size, nil, "benchmark", func(index resource.ResourceIndex) (int64, error) {
		return 0, nil
	}, nil, false)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize backend: %w", err)
	}

	// Start workers
	startTime := time.Now()
	for workerID := 0; workerID < opts.Concurrency; workerID++ {
		g.Go(func() error {
			batch := make([]*resource.BulkIndexItem, 0, 1000)
			var jobIDs []int

			for jobID := range jobs {
				jobIDs = append(jobIDs, jobID)

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
						return err
					}

					// Record the latency for each document in the batch
					for _, jid := range jobIDs {
						latencies[jid] = time.Since(writeStart)
					}

					// Reset the batch
					batch = batch[:0]
					jobIDs = nil
				}
			}

			return nil
		})
	}

	// Wait for all workers to complete
	if err := g.Wait(); err != nil {
		return nil, err
	}

	// Sort latencies for percentile calculation
	slices.Sort(latencies)

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

// RunSearchBackendBenchmark runs a benchmark test for a search backend implementation
func RunSearchBackendBenchmark(t *testing.T, backend resource.SearchBackend, opts *BenchmarkOptions) {
	result, err := runSearchBackendBenchmarkWriteThroughput(t.Context(), backend, opts)
	require.NoError(t, err)

	// Log the results for better visibility
	t.Logf("Benchmark Configuration: %s", opts)
	t.Logf("")
	t.Logf("Benchmark Results:")
	t.Logf("Total Duration: %v", result.TotalDuration)
	t.Logf("Write Count: %d", result.WriteCount)
	t.Logf("Throughput: %.2f writes/sec", result.Throughput)
	t.Logf("P50 Latency: %v", result.P50Latency)
	t.Logf("P90 Latency: %v", result.P90Latency)
	t.Logf("P99 Latency: %v", result.P99Latency)
}
