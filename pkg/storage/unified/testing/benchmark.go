package test

import (
	"context"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"golang.org/x/sync/errgroup"

	"github.com/stretchr/testify/require"
)

// BenchmarkOptions configures the benchmark parameters
type BenchmarkOptions struct {
	NumResources           int           // total number of resources to write
	Concurrency            int           // number of concurrent writers
	NumNamespaces          int           // number of different namespaces
	NumGroups              int           // number of different groups
	NumResourceTypes       int           // number of different resource types
	NumHistoryVersions     int           // history depth per resource for list seed (default 10)
	NumListIterations      int           // number of List calls to measure (default 100)
	IndexMinUpdateInterval time.Duration // minimum time between index updates (default 100ms)
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

	envOrDefaultDuration := func(name string, defaultVal time.Duration) time.Duration {
		envVar := fmt.Sprintf("US_BACKEND_BENCH_%s", name)
		if str := os.Getenv(envVar); str != "" {
			dur, err := time.ParseDuration(str)
			require.NoError(t, err)

			return dur
		}

		return defaultVal
	}

	return &BenchmarkOptions{
		NumResources:           envOrDefault("RESOURCES", 1000),
		Concurrency:            envOrDefault("CONCURRENCY", 50),
		NumNamespaces:          envOrDefault("NAMESPACES", 1),
		NumGroups:              envOrDefault("GROUPS", 1),
		NumResourceTypes:       envOrDefault("RESOURCE_TYPES", 1),
		NumHistoryVersions:     envOrDefault("HISTORY_VERSIONS", 10),
		NumListIterations:      envOrDefault("LIST_ITERATIONS", 100),
		IndexMinUpdateInterval: envOrDefaultDuration("INDEX_MIN_UPDATE_INTERVAL", 100*time.Millisecond),
	}
}

func (opts *BenchmarkOptions) String() string {
	return fmt.Sprintf(
		"Workers=%d, Resources=%d, Namespaces=%d, Groups=%d, Resource Types=%d, History Versions=%d, List Iterations=%d, Index Min Update Interval=%v",
		opts.Concurrency, opts.NumResources, opts.NumNamespaces, opts.NumGroups, opts.NumResourceTypes, opts.NumHistoryVersions, opts.NumListIterations, opts.IndexMinUpdateInterval,
	)
}

// BenchmarkResult contains the benchmark metrics for a particular operation.
type BenchmarkResult struct {
	TotalDuration time.Duration
	ReqCount      int
	Throughput    float64 // writes per second
	P50Latency    time.Duration
	P90Latency    time.Duration
	P99Latency    time.Duration
}

func (r BenchmarkResult) String() string {
	var out strings.Builder

	fmt.Fprintf(&out, "Total Duration: %v\n", r.TotalDuration)
	fmt.Fprintf(&out, "Req Count: %d\n", r.ReqCount)
	fmt.Fprintf(&out, "Throughput: %.2f reqs/sec\n", r.Throughput)
	fmt.Fprintf(&out, "P50 Latency: %v\n", r.P50Latency)
	fmt.Fprintf(&out, "P90 Latency: %v\n", r.P90Latency)
	fmt.Fprintf(&out, "P99 Latency: %v\n", r.P99Latency)

	return out.String()
}

// BenchmarkResults aggregates results of a benchmark run for
// create/update/delete/list operations.
type BenchmarkResults struct {
	CreateResults BenchmarkResult
	UpdateResults BenchmarkResult
	DeleteResults BenchmarkResult
	ListResults   BenchmarkResult
}

func (r BenchmarkResults) String() string {
	return fmt.Sprintf(
		"CREATE:\n%s\n\nUPDATE:\n%s\n\nDELETE:\n%s\n\nLIST:\n%s\n",
		r.CreateResults, r.UpdateResults, r.DeleteResults, r.ListResults,
	)
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
func runStorageBackendBenchmark(t *testing.T, backend resource.StorageBackend, opts *BenchmarkOptions) *BenchmarkResults {
	performOperation := func(operation func(context.Context, int, string, string, string, string) error) BenchmarkResult {
		// Create channels for workers
		jobs := make(chan int, opts.NumResources)
		latencies := make([]time.Duration, opts.NumResources)

		// Fill the jobs channel
		for i := 0; i < opts.NumResources; i++ {
			jobs <- i
		}
		close(jobs)

		g, groupCtx := errgroup.WithContext(t.Context())
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

					opStart := time.Now()
					if err := operation(groupCtx, jobID, namespace, group, resourceType, name); err != nil {
						return err
					}
					latencies[jobID] = time.Since(opStart)
				}

				return nil
			})
		}

		// Wait for all workers to complete
		require.NoError(t, g.Wait())

		// Sort latencies for percentile calculation
		slices.Sort(latencies)

		totalDuration := time.Since(startTime)
		return BenchmarkResult{
			TotalDuration: time.Since(startTime),
			ReqCount:      opts.NumResources,
			Throughput:    float64(opts.NumResources) / totalDuration.Seconds(),
			P50Latency:    latencies[len(latencies)*50/100],
			P90Latency:    latencies[len(latencies)*90/100],
			P99Latency:    latencies[len(latencies)*99/100],
		}
	}

	rvs := make([]int64, opts.NumResources)

	createResult := performOperation(func(ctx context.Context, jobID int, namespace, group, resource, name string) error {
		var err error
		rvs[jobID], err = WriteEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED,
			WithNamespace(namespace),
			WithGroup(group),
			WithResource(resource),
			WithValue(strings.Repeat("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20))) // ~1.21 KiB

		return err
	})

	updateResult := performOperation(func(ctx context.Context, jobID int, namespace, group, resource, name string) error {
		var err error
		rvs[jobID], err = WriteEvent(ctx, backend, name, resourcepb.WatchEvent_MODIFIED,
			WithNamespaceAndRV(namespace, rvs[jobID]),
			WithGroup(group),
			WithResource(resource),
			WithValue(strings.Repeat("9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba", 20))) // ~1.21 KiB

		return err
	})

	deleteResult := performOperation(func(ctx context.Context, jobID int, namespace, group, resource, name string) error {
		_, err := WriteEvent(ctx, backend, name, resourcepb.WatchEvent_DELETED,
			WithNamespaceAndRV(namespace, rvs[jobID]),
			WithGroup(group),
			WithResource(resource),
		)

		return err
	})

	return &BenchmarkResults{
		CreateResults: createResult,
		UpdateResults: updateResult,
		DeleteResults: deleteResult,
	}
}

// runListBenchmark seeds resources with history and measures concurrent List latency.
func runListBenchmark(t *testing.T, backend resource.StorageBackend, opts *BenchmarkOptions) BenchmarkResult {
	ctx := t.Context()

	// All resources go into a single namespace/group/resource to maximize scan scope.
	const (
		listNS       = "bench-list-ns"
		listGroup    = "bench-list-group"
		listResource = "bench-list-resource"
	)

	// --- Seed phase (sequential to avoid Optimistic locking conflicts) ---
	t.Log("List benchmark: seeding resources with history...")
	seedStart := time.Now()

	rvs := make([]int64, opts.NumResources)
	for i := 0; i < opts.NumResources; i++ {
		name := fmt.Sprintf("list-item-%d", i)

		// Create
		rv, err := WriteEvent(ctx, backend, name, resourcepb.WatchEvent_ADDED,
			WithNamespace(listNS),
			WithGroup(listGroup),
			WithResource(listResource),
			WithValue(strings.Repeat("abcdefghijklmnopqrstuvwxyz", 10)))
		require.NoError(t, err)
		rvs[i] = rv

		// Add history versions (MODIFIED events)
		for v := 0; v < opts.NumHistoryVersions; v++ {
			rv, err = WriteEvent(ctx, backend, name, resourcepb.WatchEvent_MODIFIED,
				WithNamespaceAndRV(listNS, rvs[i]),
				WithGroup(listGroup),
				WithResource(listResource),
				WithValue(strings.Repeat("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10)))
			require.NoError(t, err)
			rvs[i] = rv
		}
	}
	t.Logf("List benchmark: seeded %d resources x %d versions in %v",
		opts.NumResources, opts.NumHistoryVersions+1, time.Since(seedStart))

	// --- Measure phase (concurrent List calls) ---
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: listNS,
				Group:     listGroup,
				Resource:  listResource,
			},
		},
	}

	jobs := make(chan int, opts.NumListIterations)
	latencies := make([]time.Duration, opts.NumListIterations)

	for i := 0; i < opts.NumListIterations; i++ {
		jobs <- i
	}
	close(jobs)

	g, groupCtx := errgroup.WithContext(ctx)
	startTime := time.Now()

	for w := 0; w < opts.Concurrency; w++ {
		g.Go(func() error {
			for jobID := range jobs {
				opStart := time.Now()
				_, err := backend.ListIterator(groupCtx, listReq, func(iter resource.ListIterator) error {
					for iter.Next() {
						if err := iter.Error(); err != nil {
							return err
						}
						_ = iter.Value() // drain the iterator
					}
					return iter.Error()
				})
				if err != nil {
					return err
				}
				latencies[jobID] = time.Since(opStart)
			}
			return nil
		})
	}

	require.NoError(t, g.Wait())

	slices.Sort(latencies)
	totalDuration := time.Since(startTime)

	return BenchmarkResult{
		TotalDuration: totalDuration,
		ReqCount:      opts.NumListIterations,
		Throughput:    float64(opts.NumListIterations) / totalDuration.Seconds(),
		P50Latency:    latencies[len(latencies)*50/100],
		P90Latency:    latencies[len(latencies)*90/100],
		P99Latency:    latencies[len(latencies)*99/100],
	}
}

// RunStorageBackendBenchmark runs a benchmark test for a storage backend implementation
func RunStorageBackendBenchmark(t *testing.T, backend resource.StorageBackend, opts *BenchmarkOptions) {
	// Initialize the backend
	require.NoError(t, initializeBackend(t.Context(), backend, opts))

	results := runStorageBackendBenchmark(t, backend, opts)

	results.ListResults = runListBenchmark(t, backend, opts)

	// Log the results for better visibility.
	t.Logf("Benchmark Configuration: %s", opts)
	t.Logf("")
	t.Logf("Benchmark Results:")
	t.Logf("\n%s", results)
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
	}, nil, false, time.Time{})
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
		ReqCount:      opts.NumResources,
		Throughput:    throughput,
		P50Latency:    latencies[len(latencies)*50/100],
		P90Latency:    latencies[len(latencies)*90/100],
		P99Latency:    latencies[len(latencies)*99/100],
	}, nil
}

// StorageAndSearchBenchmarkResults aggregates results of a combined storage + search benchmark run.
type StorageAndSearchBenchmarkResults struct {
	WriteResults  BenchmarkResult
	SearchResults BenchmarkResult
}

func (r StorageAndSearchBenchmarkResults) String() string {
	return fmt.Sprintf(
		"WRITES:\n%s\n\nSEARCHES:\n%s\n",
		r.WriteResults, r.SearchResults,
	)
}

// runStorageAndSearchBenchmark runs a benchmark that writes to storage while
// periodically searching through an index kept up-to-date from that storage.
// It also exercises our ability to search-after-write for every resource written
// during the benchmark.
func runStorageAndSearchBenchmark(
	t *testing.T,
	backend resource.StorageBackend,
	searchOpts resource.SearchOptions,
	opts *BenchmarkOptions,
) *StorageAndSearchBenchmarkResults {
	ctx := t.Context()

	if opts.NumGroups != opts.NumResourceTypes {
		t.Logf("WARNING: benchmark only supports NumGroups=NumResourceTypes, one resource type per group")
	}

	// Discover group/resource pairs from the configured document builders
	builders, err := searchOpts.Resources.GetDocumentBuilders()
	require.NoError(t, err)
	require.NotEmpty(t, builders, "search options must have at least one document builder")

	type groupResource struct {
		group    string
		resource string
	}
	pairs := make([]groupResource, len(builders))
	for i, b := range builders {
		t.Logf("using group=%s resource=%s", b.GroupResource.Group, b.GroupResource.Resource)
		pairs[i] = groupResource{group: b.GroupResource.Group, resource: b.GroupResource.Resource}
	}

	searchServer, err := resource.NewSearchServer(resource.ResourceServerOptions{
		Backend: backend,
		Search:  searchOpts,
	})
	require.NoError(t, err)

	type searchJob struct {
		namespace string
		group     string
		resource  string
		title     string
		idx       int // index into searchLatencies
	}

	searchCh := make(chan searchJob, opts.NumResources)
	searchLatencies := make([]time.Duration, opts.NumResources)

	// Dispatcher goroutine: reads from searchCh and spawns a search goroutine per write.
	var dispatcherDone sync.WaitGroup
	searchG, searchCtx := errgroup.WithContext(ctx)
	dispatcherDone.Go(func() {
		for job := range searchCh {
			req := &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Namespace: job.namespace,
						Group:     job.group,
						Resource:  job.resource,
					},
				},
				Query: job.title,
				QueryFields: []*resourcepb.ResourceSearchRequest_QueryField{
					{
						Name: "title",
						Type: resourcepb.QueryFieldType_KEYWORD,
					},
				},
				Limit: 10,
			}
			idx := job.idx
			searchG.Go(func() error {
				start := time.Now()
				resp, err := searchServer.Search(searchCtx, req)
				searchLatencies[idx] = time.Since(start)
				if err != nil {
					return fmt.Errorf(
						"search failed for %s/%s %s: %w",
						req.Options.Key.Group, req.Options.Key.Resource, req.Options.Key.Name, err,
					)
				}
				if resp.TotalHits != 1 {
					return fmt.Errorf(
						"expected 1 hit for %s/%s %s, got %d",
						req.Options.Key.Group, req.Options.Key.Resource, req.Query, resp.TotalHits,
					)
				}
				return nil
			})
		}
	})

	// Background goroutine: continuously issues wildcard searches across all
	// group/resource pairs to exercise index updates while writes are in flight.
	bgSearchCtx, bgSearchCancel := context.WithCancel(ctx)
	defer bgSearchCancel()
	var bgSearchDone sync.WaitGroup
	bgSearchDone.Go(func() {
		for i := 0; ; i++ {
			select {
			case <-bgSearchCtx.Done():
				return
			case <-time.After(50 * time.Millisecond):
			}
			pair := pairs[i%len(pairs)]
			namespace := fmt.Sprintf("ns-%d", i%opts.NumNamespaces)
			_, err := searchServer.Search(bgSearchCtx, &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Namespace: namespace,
						Group:     pair.group,
						Resource:  pair.resource,
					},
				},
				Query: "*",
				Limit: 10,
			})
			if err != nil && bgSearchCtx.Err() == nil {
				t.Errorf("background search failed for %s/%s: %v", pair.group, pair.resource, err)
				return
			}
		}
	})

	// Start write workers — distribute across group/resource pairs like the storage benchmark.
	// After each write, send a search job through the channel.
	jobs := make(chan int, opts.NumResources)
	writeLatencies := make([]time.Duration, opts.NumResources)
	for i := 0; i < opts.NumResources; i++ {
		jobs <- i
	}
	close(jobs)

	g, groupCtx := errgroup.WithContext(ctx)
	writeStart := time.Now()
	value := strings.Repeat("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20) // ~1.21 KiB

	for workerID := 0; workerID < opts.Concurrency; workerID++ {
		g.Go(func() error {
			for jobID := range jobs {
				pair := pairs[jobID%len(pairs)]
				namespace := fmt.Sprintf("ns-%d", jobID%opts.NumNamespaces)
				name := fmt.Sprintf("item-%d", jobID)
				title := fmt.Sprintf("%s %d", name, time.Now().Unix())
				opStart := time.Now()
				_, err := WriteEvent(groupCtx, backend, name, resourcepb.WatchEvent_ADDED,
					WithGroup(pair.group),
					WithResource(pair.resource),
					WithNamespace(namespace),
					WithValueAndTitle(value, title),
				)
				if err != nil {
					return err
				}
				writeLatencies[jobID] = time.Since(opStart)
				// Sleep to simulate what the resource server does to
				// provide search-after-write guarantees to the caller.
				if opts.IndexMinUpdateInterval > 0 {
					time.Sleep(opts.IndexMinUpdateInterval)
				}
				// Make sure we are able to search the resource just created.
				searchCh <- searchJob{
					namespace: namespace,
					group:     pair.group,
					resource:  pair.resource,
					title:     title,
					idx:       jobID,
				}
			}
			return nil
		})
	}

	require.NoError(t, g.Wait())
	writeDuration := time.Since(writeStart)

	// Wait for dispatcher to finish spawning, then for all searches to complete
	close(searchCh)
	dispatcherDone.Wait()
	require.NoError(t, searchG.Wait())
	searchDuration := time.Since(writeStart)

	// Stop background search goroutine
	bgSearchCancel()
	bgSearchDone.Wait()

	// Compute write results
	slices.Sort(writeLatencies)
	writeResult := BenchmarkResult{
		TotalDuration: writeDuration,
		ReqCount:      opts.NumResources,
		Throughput:    float64(opts.NumResources) / writeDuration.Seconds(),
		P50Latency:    writeLatencies[len(writeLatencies)*50/100],
		P90Latency:    writeLatencies[len(writeLatencies)*90/100],
		P99Latency:    writeLatencies[len(writeLatencies)*99/100],
	}

	// Compute search results
	slices.Sort(searchLatencies)
	searchResult := BenchmarkResult{
		TotalDuration: searchDuration,
		ReqCount:      opts.NumResources,
		Throughput:    float64(opts.NumResources) / searchDuration.Seconds(),
		P50Latency:    searchLatencies[opts.NumResources*50/100],
		P90Latency:    searchLatencies[opts.NumResources*90/100],
		P99Latency:    searchLatencies[opts.NumResources*99/100],
	}

	return &StorageAndSearchBenchmarkResults{
		WriteResults:  writeResult,
		SearchResults: searchResult,
	}
}

// RunStorageAndSearchBenchmark runs a benchmark that combines storage writes with search.
func RunStorageAndSearchBenchmark(
	t *testing.T,
	backend resource.StorageBackend,
	searchOpts resource.SearchOptions,
	opts *BenchmarkOptions,
) {
	results := runStorageAndSearchBenchmark(t, backend, searchOpts, opts)

	t.Logf("Benchmark Configuration: %s", opts)
	t.Logf("")
	t.Logf("Benchmark Results:")
	t.Logf("\n%s", results)
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
	t.Logf("Req Count: %d", result.ReqCount)
	t.Logf("Throughput: %.2f req/sec", result.Throughput)
	t.Logf("P50 Latency: %v", result.P50Latency)
	t.Logf("P90 Latency: %v", result.P90Latency)
	t.Logf("P99 Latency: %v", result.P99Latency)
}
