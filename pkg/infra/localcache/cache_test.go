package localcache

import (
	"math/rand"
	"sync"
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
				require.NoError(t, cache.ExclusiveSet(key, read, time.Minute))
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
		require.NoError(t, cache.ExclusiveSet(key, read, time.Minute))
	}

	cached, ok := cache.Get(key)
	require.True(t, ok, "value should be cached")
	require.Equal(t, truth, cached)

	// At the end of this process, no one is holding the lock to the `key`,
	// so this mapping should be empty.
	require.Empty(t, cache.locks)
}
