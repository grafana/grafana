package localcache

import (
	"math/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestExclusiveSet simulates a real-world scenario of concurrent goroutines
// trying to read and write to the same cache key. Using standard Set and
// Delete, this test would fail with high probability.
func TestExclusiveSet(t *testing.T) {
	var truth int
	var mu sync.RWMutex
	const maxDelay = int(10 * time.Millisecond)
	read := func() (any, error) {
		mu.RLock()
		ret := truth
		mu.RUnlock()

		time.Sleep(time.Duration(rand.Intn(maxDelay)))
		return ret, nil
	}
	write := func(n int) {
		mu.Lock()
		truth = n
		mu.Unlock()
	}

	cache := New(time.Minute, time.Minute)
	var wg sync.WaitGroup
	const numWorkers = 10
	const key = "test-key"
	start := make(chan struct{})

	for val := range numWorkers {
		wg.Go(func() {
			<-start
			if _, ok := cache.Get(key); !ok {
				_, err := cache.ExclusiveGetOrSet(key, read, time.Minute)
				require.NoError(t, err)
			}
		})

		wg.Go(func() {
			<-start
			write(val)
			cache.ExclusiveDelete(key)
		})
	}

	close(start)
	wg.Wait()

	// It is still possible that the last operation to be performed was a write,
	// which would delete the cache entry.
	_, ok := cache.Get(key)
	if !ok {
		_, err := cache.ExclusiveGetOrSet(key, read, time.Minute)
		require.NoError(t, err)
	}

	cached, ok := cache.Get(key)
	require.True(t, ok, "value should be cached")
	require.Equal(t, truth, cached)

	// At the end of this process, no one is holding the lock to the `key`,
	// so this mapping should be empty.
	require.Empty(t, cache.locks)
}

func TestExclusiveGetOrSetCoalescing(t *testing.T) {
	var calls int32
	barrier := make(chan struct{})
	getValue := func() (any, error) {
		atomic.AddInt32(&calls, 1)
		<-barrier // block until all requests are queued up
		return "hello", nil
	}

	cache := New(time.Minute, time.Minute)
	const numReqs = 5
	var wg sync.WaitGroup
	start := make(chan struct{})

	results := make([]any, numReqs)
	errs := make([]error, numReqs)

	for i := 0; i < numReqs; i++ {
		idx := i
		wg.Go(func() {
			<-start
			val, err := cache.ExclusiveGetOrSet("coalesce-key", getValue, time.Minute)
			results[idx] = val
			errs[idx] = err
		})
	}

	close(start)

	// Sleep briefly to ensure all goroutines enter ExclusiveGetOrSet and block.
	// The first goroutine will call getValue and block on barrier.
	// The other 4 goroutines will block on cache.Lock("coalesce-key").
	time.Sleep(50 * time.Millisecond)

	// Release the barrier so the first goroutine sets the value and unlocks
	close(barrier)

	wg.Wait()

	// Assert getValue was called exactly once
	require.Equal(t, int32(1), atomic.LoadInt32(&calls))

	// Assert all callers got the correct result without error
	for i := 0; i < numReqs; i++ {
		require.NoError(t, errs[i])
		require.Equal(t, "hello", results[i])
	}
}
