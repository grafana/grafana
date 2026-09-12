package localcache

import (
	"errors"
	"math/rand"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var errTest = errors.New("test error")

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

// TestGetOrExclusiveSet verifies that concurrent callers racing on a cold key
// only compute the value once: the winner runs getValue, the rest reuse the
// cached result via the post-lock re-check rather than recomputing.
func TestGetOrExclusiveSet(t *testing.T) {
	cache := New(time.Minute, time.Minute)

	const (
		numWorkers = 20
		key        = "test-key"
		want       = 42
	)

	var calls atomic.Int64
	getValue := func() (any, error) {
		calls.Add(1)
		// Hold the lock long enough that the other workers pile up behind it.
		time.Sleep(20 * time.Millisecond)
		return want, nil
	}

	var wg sync.WaitGroup
	start := make(chan struct{})
	results := make([]any, numWorkers)
	errs := make([]error, numWorkers)
	for i := range numWorkers {
		wg.Go(func() {
			<-start
			results[i], errs[i] = cache.GetOrExclusiveSet(key, getValue, time.Minute)
		})
	}

	close(start)
	wg.Wait()

	require.Equal(t, int64(1), calls.Load(), "getValue should run exactly once across concurrent callers")
	for i := range numWorkers {
		require.NoError(t, errs[i])
		require.Equal(t, want, results[i])
	}

	cached, ok := cache.Get(key)
	require.True(t, ok, "value should be cached")
	require.Equal(t, want, cached)

	// No one holds the lock anymore, so the locks map should be empty.
	require.Empty(t, cache.locks)
}

// TestGetOrExclusiveSet_Error verifies that a failing getValue is not cached and
// the error is propagated to the caller.
func TestGetOrExclusiveSet_Error(t *testing.T) {
	cache := New(time.Minute, time.Minute)

	wantErr := errTest
	_, err := cache.GetOrExclusiveSet("test-key", func() (any, error) {
		return nil, wantErr
	}, time.Minute)

	require.ErrorIs(t, err, wantErr)
	_, ok := cache.Get("test-key")
	require.False(t, ok, "failed value should not be cached")
	require.Empty(t, cache.locks)
}
