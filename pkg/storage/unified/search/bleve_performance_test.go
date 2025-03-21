package search_test

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
)

func setupIndex() (resource.ResourceIndex, string) {
	// size := 1000000  // TODO: 200k documents standard size?
	size := 200000
	// batchSize := 1000 slower 8s (for 200k documents) - 34s (for 1M documents)
	// batchSize := 10000 // faster 5s  (for 200k documents) - 27s (for 1M documents)
	batchSize := 100000 // fasterer 3.5s  (for 200k documents) - 27s  (for 1M documents)
	writer := newTestWriter(size, batchSize)
	return newTestDashboardsIndex(nil, 1, int64(size), int64(batchSize), writer)
}

const maxAllowedTime = 20 * time.Millisecond // Reasonable (can vary per env) performance threshold per query (e.g., 20ms)
const maxAllowedAllocMB = 1                  // 1MB memory per operation
const maxAllowedAlloc = maxAllowedAllocMB * 1024 * 1024
const verbose = false

// BenchmarkBleveQuery measures the time, mem, cpu to execute a search query
// changes the the indexer settings can cause unforeseen performance issues ( for example: using wildcard queries )
// this will fail if the stats exceed the "normal" thresholds
func BenchmarkBleveQuery(b *testing.B) {
	var memStatsStart runtime.MemStats
	var memStatsAfterIndex runtime.MemStats
	runtime.ReadMemStats(&memStatsStart)

	testIndex, testIndexDir := setupIndex()
	defer func() {
		err := os.RemoveAll(testIndexDir)
		if err != nil {
			fmt.Printf("Error removing index directory: %v\n", err)
		}
	}()

	runtime.ReadMemStats(&memStatsAfterIndex)

	allocDiff := memStatsAfterIndex.Alloc - memStatsStart.Alloc

	logVerbose(fmt.Sprintf("Memory allocated for index: %d bytes", allocDiff))

	searchRequest := newQueryByTitle("name99999")

	b.ResetTimer()   // Reset timer before benchmarking
	b.ReportAllocs() // Track memory allocations

	for i := 0; i < b.N; i++ {
		start := time.Now() // Start timer
		var memStatsBefore, memStatsAfter runtime.MemStats
		runtime.ReadMemStats(&memStatsBefore)

		_, err := testIndex.Search(context.Background(), nil, searchRequest, nil)

		elapsed := time.Since(start) // Calculate elapsed time
		runtime.ReadMemStats(&memStatsAfter)
		allocDiff := (memStatsAfter.Alloc - memStatsBefore.Alloc)
		if memStatsAfter.Alloc < memStatsBefore.Alloc {
			// This can happen due to memory being freed after the search operation
			allocDiff = 0 // don't care if it goes down
		}

		logVerbose(fmt.Sprintf("Memory allocated for query: %d bytes", allocDiff))

		require.NoError(b, err)

		// Fail if query takes longer than maxAllowedTime
		if elapsed > maxAllowedTime {
			b.Fatalf("Query too slow: %v (limit: %v)", elapsed, maxAllowedTime)
		}
		// Check memory allocation limit
		if allocDiff > maxAllowedAlloc {
			b.Fatalf("Excessive memory usage: %d mb (limit: %d mb)", allocDiff, maxAllowedAllocMB)
		}
	}
}

func newTestWriter(size int, batchSize int) IndexWriter {
	key := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	return func(index resource.ResourceIndex) (int64, error) {
		total := time.Now()
		start := time.Now()
		for i := range size {
			name := fmt.Sprintf("name%d", i)
			err := index.Write(&resource.IndexableDocument{
				RV:   int64(i),
				Name: name,
				Key: &resource.ResourceKey{
					Name:      name,
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
				Title: name + "-title",
			})
			if err != nil {
				return 0, err
			}
			// show progress for every batch
			if i%batchSize == 0 && verbose {
				fmt.Printf("Indexed %d documents\n", i)
				end := time.Now()
				fmt.Printf("Time taken for indexing batch: %s\n", end.Sub(start))
				start = time.Now()
			}
		}
		end := time.Now()
		logVerbose(fmt.Sprintf("Indexed %d documents in %s", size, end.Sub(total)))
		return 0, nil
	}
}

func logVerbose(msg string) {
	if verbose {
		fmt.Println(msg)
	}
}
