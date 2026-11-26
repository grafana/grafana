package swrcache

import (
	"context"
	"errors"
	"runtime"
	"slices"
	"strconv"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func validOptions() Options {
	return Options{
		MetricsPrefix:      "test_cache",
		TTL:                time.Hour,
		RefreshInterval:    time.Minute,
		MinRefreshInterval: 5 * time.Second,
		StaleWait:          200 * time.Millisecond,
		LoadTimeout:        10 * time.Second,
		MaxEntries:         16,
	}
}

func TestOptions_Validate(t *testing.T) {
	t.Run("should reject options when MetricsPrefix is not a valid metric name", func(t *testing.T) {
		for _, prefix := range []string{"", "1cache", "my-cache", "a:b"} {
			opts := validOptions()
			opts.MetricsPrefix = prefix
			err := opts.Validate()
			require.ErrorContains(t, err, "MetricsPrefix")
		}
	})

	t.Run("should reject options when TTL, RefreshInterval or LoadTimeout is zero", func(t *testing.T) {
		tests := map[string]func(*Options){
			"TTL":             func(opts *Options) { opts.TTL = 0 },
			"RefreshInterval": func(opts *Options) { opts.RefreshInterval = 0 },
			"LoadTimeout":     func(opts *Options) { opts.LoadTimeout = 0 },
		}
		for field, zero := range tests {
			opts := validOptions()
			zero(&opts)
			err := opts.Validate()
			require.ErrorContains(t, err, field+" must be greater than zero")
		}
	})

	t.Run("should accept options when StaleWait and MinRefreshInterval are zero", func(t *testing.T) {
		opts := validOptions()
		opts.StaleWait = 0
		opts.MinRefreshInterval = 0
		require.NoError(t, opts.Validate())
	})

	t.Run("should reject options when StaleWait or MinRefreshInterval is negative", func(t *testing.T) {
		tests := map[string]func(*Options){
			"StaleWait":          func(opts *Options) { opts.StaleWait = -1 },
			"MinRefreshInterval": func(opts *Options) { opts.MinRefreshInterval = -1 },
		}
		for field, negative := range tests {
			opts := validOptions()
			negative(&opts)
			err := opts.Validate()
			require.ErrorContains(t, err, field+" must not be negative")
		}
	})

	t.Run("should reject options when MaxEntries is zero", func(t *testing.T) {
		opts := validOptions()
		opts.MaxEntries = 0
		require.ErrorContains(t, opts.Validate(), "MaxEntries must be greater than zero")
	})

	t.Run("should reject options when MinRefreshInterval exceeds RefreshInterval", func(t *testing.T) {
		opts := validOptions()
		opts.MinRefreshInterval = opts.RefreshInterval + 1
		require.ErrorContains(t, opts.Validate(), "MinRefreshInterval must not exceed RefreshInterval")
	})

	t.Run("should reject options when RefreshInterval exceeds TTL", func(t *testing.T) {
		opts := validOptions()
		opts.RefreshInterval = opts.TTL + 1
		require.ErrorContains(t, opts.Validate(), "RefreshInterval must not exceed TTL")
	})

	t.Run("should accept options when MinRefreshInterval equals RefreshInterval and RefreshInterval equals TTL", func(t *testing.T) {
		opts := validOptions()
		opts.MinRefreshInterval = time.Minute
		opts.RefreshInterval = time.Minute
		opts.TTL = time.Minute
		require.NoError(t, opts.Validate())
	})
}

func TestNew(t *testing.T) {
	t.Run("should fail when the loader is nil", func(t *testing.T) {
		_, err := New[string, int](nil, validOptions())
		require.Error(t, err)
	})

	t.Run("should fail when the options are invalid", func(t *testing.T) {
		opts := validOptions()
		opts.MaxEntries = 0
		_, err := New(func(ctx context.Context, key string) (int, error) { return 0, nil }, opts)
		require.Error(t, err)
	})
}

type ctxKey struct{}

var errBoom = errors.New("boom")

// scriptedLoader returns its call number unless fn is set. Tests never call require inside fn.
type scriptedLoader struct {
	calls atomic.Int32
	fn    func(ctx context.Context, key string, call int) (int, error)
}

func (l *scriptedLoader) load(ctx context.Context, key string) (int, error) {
	call := int(l.calls.Add(1))
	if l.fn == nil {
		return call, nil
	}
	return l.fn(ctx, key, call)
}

func (l *scriptedLoader) callCount() int {
	return int(l.calls.Load())
}

type loadFunc = func(ctx context.Context, key string, call int) (int, error)

func blockCalls(release <-chan struct{}, blocked ...int) loadFunc {
	return func(ctx context.Context, key string, call int) (int, error) {
		if slices.Contains(blocked, call) {
			select {
			case <-release:
			case <-ctx.Done():
				return 0, ctx.Err()
			}
		}
		return call, nil
	}
}

func failCalls(failing ...int) loadFunc {
	return func(ctx context.Context, key string, call int) (int, error) {
		if slices.Contains(failing, call) {
			return 0, errBoom
		}
		return call, nil
	}
}

func newTestCache(t *testing.T, opts Options, loader *scriptedLoader) *Cache[string, int] {
	t.Helper()
	cache, err := New(loader.load, opts)
	require.NoError(t, err)
	return cache
}

func mustGet(t *testing.T, cache *Cache[string, int], key string) int {
	t.Helper()
	value, err := cache.Get(t.Context(), key)
	require.NoError(t, err)
	return value
}

type getResult struct {
	value int
	err   error
}

func getAsync(ctx context.Context, cache *Cache[string, int], key string) <-chan getResult {
	result := make(chan getResult, 1)
	go func() {
		value, err := cache.Get(ctx, key)
		result <- getResult{value: value, err: err}
	}()
	return result
}

func runInBubble(t *testing.T, name string, fn func(t *testing.T)) {
	t.Helper()
	t.Run(name, func(t *testing.T) {
		synctest.Test(t, fn)
	})
}

func TestCache_Get(t *testing.T) {
	runInBubble(t, "should load once and serve fresh values when the entry is younger than RefreshInterval", func(t *testing.T) {
		opts := validOptions()
		loader := &scriptedLoader{}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval / 2)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 1, loader.callCount())
	})

	runInBubble(t, "should return the loader error and keep no entry when the first load fails", func(t *testing.T) {
		loader := &scriptedLoader{fn: failCalls(1)}
		cache := newTestCache(t, validOptions(), loader)

		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, errBoom)
		require.Equal(t, 0, cache.Len())
	})

	runInBubble(t, "should call the loader again on the next Get when the first load failed", func(t *testing.T) {
		loader := &scriptedLoader{fn: failCalls(1)}
		cache := newTestCache(t, validOptions(), loader)

		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, errBoom)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should refresh and return the new value when the entry is older than RefreshInterval and the load finishes within StaleWait", func(t *testing.T) {
		opts := validOptions()
		loadDelay := opts.StaleWait / 4
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 2 {
				time.Sleep(loadDelay)
			}
			return call, nil
		}}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should serve the old value when the refresh takes longer than StaleWait, then serve the new value after it finishes", func(t *testing.T) {
		opts := validOptions()
		loadDelay := opts.StaleWait * 5
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 2 {
				time.Sleep(loadDelay)
			}
			return call, nil
		}}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(loadDelay)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should serve the old value when the refresh fails", func(t *testing.T) {
		opts := validOptions()
		loader := &scriptedLoader{fn: failCalls(2)}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should serve the old value without loading when an age-based refresh started less than MinRefreshInterval ago", func(t *testing.T) {
		opts := validOptions()
		loader := &scriptedLoader{fn: failCalls(2)}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())

		synctest.Sleep(opts.MinRefreshInterval)
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should refresh on the next read when MarkStale is called less than MinRefreshInterval after a refresh", func(t *testing.T) {
		opts := validOptions()
		loader := &scriptedLoader{}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		cache.MarkStale("tenant-a")
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should serve the old value on every failed refresh spaced more than MinRefreshInterval apart until TTL, then return the loader error", func(t *testing.T) {
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call > 1 {
				return 0, errBoom
			}
			return call, nil
		}}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		const failedRefreshes = 5
		// Each step exceeds RefreshInterval and MinRefreshInterval, so every read starts a refresh.
		step := opts.TTL / (failedRefreshes + 1)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		for i := range failedRefreshes {
			synctest.Sleep(step)
			require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
			require.Equal(t, i+2, loader.callCount())
		}
		synctest.Sleep(opts.TTL - failedRefreshes*step + time.Second)
		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, errBoom)
		require.Equal(t, 7, loader.callCount())
	})

	for _, tt := range []struct {
		name string
		exit func()
	}{
		{"panics", func() { panic("kaboom") }},
		{"calls runtime.Goexit", runtime.Goexit},
	} {
		runInBubble(t, "should serve the old value and keep the entry when the loader "+tt.name+" during a refresh", func(t *testing.T) {
			loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
				if call == 2 {
					tt.exit()
				}
				return call, nil
			}}
			opts := validOptions()
			cache := newTestCache(t, opts, loader)

			require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
			synctest.Sleep(opts.RefreshInterval)
			require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
			require.Equal(t, 1, cache.Len())

			synctest.Sleep(opts.MinRefreshInterval)
			require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
			require.Equal(t, 1, cache.Len())
		})
	}

	runInBubble(t, "should load again and not serve the old value when the entry is older than TTL", func(t *testing.T) {
		opts := validOptions()
		loader := &scriptedLoader{}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.TTL)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should keep serving the old value until TTL when every refresh fails, then return the loader error", func(t *testing.T) {
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call > 1 {
				return 0, errBoom
			}
			return call, nil
		}}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.TTL - opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval * 2)
		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, errBoom)
		require.Equal(t, 0, cache.Len())
	})

	runInBubble(t, "should store the refreshed value when the entry expires while its refresh is running", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 2)}
		opts := validOptions()
		opts.LoadTimeout = opts.TTL * 3
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.TTL)

		expired := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		close(release)
		require.Equal(t, getResult{value: 2}, <-expired)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should return the loader error and keep no entry when the entry expires while its refresh fails", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 2 {
				select {
				case <-release:
				case <-ctx.Done():
				}
				return 0, errBoom
			}
			return call, nil
		}}
		opts := validOptions()
		opts.LoadTimeout = opts.TTL * 3
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.TTL)

		expired := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		close(release)
		require.ErrorIs(t, (<-expired).err, errBoom)
		require.Equal(t, 0, cache.Len())
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should refresh on the next read when MarkStale is called on a fresh entry", func(t *testing.T) {
		loader := &scriptedLoader{}
		cache := newTestCache(t, validOptions(), loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		cache.MarkStale("tenant-a")
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should not affect other keys when MarkStale is called", func(t *testing.T) {
		loader := &scriptedLoader{}
		cache := newTestCache(t, validOptions(), loader)

		mustGet(t, cache, "tenant-a")
		mustGet(t, cache, "tenant-b")
		cache.MarkStale("tenant-a")
		require.Equal(t, 2, mustGet(t, cache, "tenant-b"))
		require.Equal(t, 2, loader.callCount())
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should refresh every key when MarkAllStale is called", func(t *testing.T) {
		loader := &scriptedLoader{}
		cache := newTestCache(t, validOptions(), loader)

		mustGet(t, cache, "tenant-a")
		mustGet(t, cache, "tenant-b")
		cache.MarkAllStale()
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 4, mustGet(t, cache, "tenant-b"))
	})

	runInBubble(t, "should ignore MarkStale for a key not in the cache", func(t *testing.T) {
		loader := &scriptedLoader{}
		cache := newTestCache(t, validOptions(), loader)

		cache.MarkStale("tenant-a")
		require.Equal(t, 0, cache.Len())
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 1, loader.callCount())
	})

	runInBubble(t, "should store the result as stale when MarkStale runs during the load", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 2)}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		cache.MarkStale("tenant-a")
		close(release)
		synctest.Wait()

		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should store the result as stale when MarkStale runs during the first load of a key", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		first := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		cache.MarkStale("tenant-a")
		close(release)

		require.Equal(t, getResult{value: 1}, <-first)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should give a Get that joins a load started before MarkStale the loaded value, and refresh on the read after it", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		first := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		cache.MarkStale("tenant-a")
		joiner := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		close(release)

		require.Equal(t, getResult{value: 1}, <-first)
		require.Equal(t, getResult{value: 1}, <-joiner)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should refresh on the read after a joined load when MarkStale ran during that load", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 2)}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		cache.MarkStale("tenant-a")
		joiner := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		close(release)

		require.Equal(t, getResult{value: 2}, <-joiner)
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 3, loader.callCount())
	})

	runInBubble(t, "should refresh on the read after a joined load that fails when MarkStale ran during that load", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 2 {
				select {
				case <-release:
				case <-ctx.Done():
				}
				return 0, errBoom
			}
			return call, nil
		}}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		cache.MarkStale("tenant-a")
		joiner := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		close(release)

		require.Equal(t, getResult{value: 1}, <-joiner)
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 3, loader.callCount())
	})

	runInBubble(t, "should store the result as stale when MarkStale runs during a refresh that outlives TTL", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 2)}
		opts := validOptions()
		opts.LoadTimeout = opts.TTL * 3
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.TTL)
		cache.MarkStale("tenant-a")
		close(release)
		synctest.Wait()

		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 3, loader.callCount())
	})

	runInBubble(t, "should store the result as stale when MarkAllStale runs during the first load of a key", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		first := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		cache.MarkAllStale()
		close(release)

		require.Equal(t, getResult{value: 1}, <-first)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should keep the entry of a running first load when a concurrent Get joins it", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		first := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		second := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		require.Equal(t, 1, cache.Len())
		close(release)

		require.Equal(t, getResult{value: 1}, <-first)
		require.Equal(t, getResult{value: 1}, <-second)
		require.Equal(t, 1, loader.callCount())
	})

	runInBubble(t, "should give the loader a ctx with the LoadTimeout deadline and the values of the caller's ctx", func(t *testing.T) {
		type observed struct {
			deadline    time.Time
			hasDeadline bool
			value       any
		}
		seen := make(chan observed, 1)
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			deadline, hasDeadline := ctx.Deadline()
			seen <- observed{deadline: deadline, hasDeadline: hasDeadline, value: ctx.Value(ctxKey{})}
			return call, nil
		}}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		callerCtx := context.WithValue(t.Context(), ctxKey{}, "caller-value")
		start := time.Now()
		_, err := cache.Get(callerCtx, "tenant-a")
		require.NoError(t, err)

		got := <-seen
		require.True(t, got.hasDeadline)
		require.Equal(t, start.Add(opts.LoadTimeout), got.deadline)
		require.Equal(t, "caller-value", got.value)
	})

	runInBubble(t, "should keep the loader ctx alive when the caller's ctx is cancelled during the load", func(t *testing.T) {
		release := make(chan struct{})
		loaderCtxErr := make(chan error, 1)
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			<-release
			loaderCtxErr <- ctx.Err()
			return call, nil
		}}
		cache := newTestCache(t, validOptions(), loader)

		cancelCtx, cancel := context.WithCancel(context.WithValue(t.Context(), ctxKey{}, "caller-value"))
		pending := getAsync(cancelCtx, cache, "tenant-a")
		synctest.Wait()
		cancel()
		require.ErrorIs(t, (<-pending).err, context.Canceled)
		close(release)

		require.NoError(t, <-loaderCtxErr)
	})

	runInBubble(t, "should return the deadline error when the loader outlasts LoadTimeout", func(t *testing.T) {
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			<-ctx.Done()
			return 0, ctx.Err()
		}}
		cache := newTestCache(t, validOptions(), loader)

		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})

	runInBubble(t, "should return the old value at once when StaleWait is zero, then the new value after the refresh", func(t *testing.T) {
		opts := validOptions()
		// Derived before StaleWait is zeroed: the refresh would fit within the original StaleWait.
		loadDelay := opts.StaleWait / 4
		opts.StaleWait = 0
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 2 {
				time.Sleep(loadDelay)
			}
			return call, nil
		}}
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		start := time.Now()
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, start, time.Now())
		synctest.Sleep(loadDelay * 2)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should refresh again on the next stale read when MinRefreshInterval is zero and the last refresh failed", func(t *testing.T) {
		loader := &scriptedLoader{fn: failCalls(2)}
		opts := validOptions()
		opts.MinRefreshInterval = 0
		cache := newTestCache(t, opts, loader)

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		synctest.Sleep(opts.RefreshInterval)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 3, loader.callCount())
	})

	runInBubble(t, "should count an expired entry in Len when no read has touched it since it expired", func(t *testing.T) {
		opts := validOptions()
		cache := newTestCache(t, opts, &scriptedLoader{})

		mustGet(t, cache, "tenant-a")
		synctest.Sleep(opts.TTL)

		require.Equal(t, 1, cache.Len())
	})

	runInBubble(t, "should count an entry whose first load is running in Len", func(t *testing.T) {
		release := make(chan struct{})
		cache := newTestCache(t, validOptions(), &scriptedLoader{fn: blockCalls(release, 1)})

		pending := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		require.Equal(t, 1, cache.Len())
		close(release)
		<-pending
	})

	runInBubble(t, "should call the loader once when N concurrent Gets miss the same key", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		results := make([]<-chan getResult, 10)
		for i := range results {
			results[i] = getAsync(t.Context(), cache, "tenant-a")
		}
		synctest.Wait()
		close(release)

		for _, result := range results {
			require.Equal(t, getResult{value: 1}, <-result)
		}
		require.Equal(t, 1, loader.callCount())
	})

	runInBubble(t, "should call the loader once per key when concurrent Gets miss two keys", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1, 2)}
		cache := newTestCache(t, validOptions(), loader)

		results := make([]<-chan getResult, 0, 10)
		for range 5 {
			results = append(results, getAsync(t.Context(), cache, "tenant-a"), getAsync(t.Context(), cache, "tenant-b"))
		}
		synctest.Wait()
		close(release)

		for _, result := range results {
			require.NoError(t, (<-result).err)
		}
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should return ctx.Err() to a cancelled caller on the absent path and still fill the cache for the others", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		cancelCtx, cancel := context.WithCancel(t.Context())
		cancelled := getAsync(cancelCtx, cache, "tenant-a")
		other := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		cancel()
		require.ErrorIs(t, (<-cancelled).err, context.Canceled)
		close(release)

		require.Equal(t, getResult{value: 1}, <-other)
		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 1, loader.callCount())
	})

	runInBubble(t, "should return the old value when the caller is cancelled while waiting for a refresh", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 2)}
		opts := validOptions()
		cache := newTestCache(t, opts, loader)

		mustGet(t, cache, "tenant-a")
		synctest.Sleep(opts.RefreshInterval)
		cancelCtx, cancel := context.WithCancel(t.Context())
		cancelled := getAsync(cancelCtx, cache, "tenant-a")
		synctest.Wait()
		cancel()

		require.Equal(t, getResult{value: 1}, <-cancelled)
		close(release)
		synctest.Wait()
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should finish the load and fill the cache when the caller that started it is cancelled", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		cache := newTestCache(t, validOptions(), loader)

		cancelCtx, cancel := context.WithCancel(t.Context())
		starter := getAsync(cancelCtx, cache, "tenant-a")
		synctest.Wait()
		cancel()
		require.ErrorIs(t, (<-starter).err, context.Canceled)
		close(release)
		synctest.Wait()

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 1, loader.callCount())
	})

	runInBubble(t, "should return the value to the caller and drop it when the key was evicted during the load", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		opts := validOptions()
		opts.MaxEntries = 1
		cache := newTestCache(t, opts, loader)

		evicted := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		require.Equal(t, 2, mustGet(t, cache, "tenant-b"))
		close(release)

		require.Equal(t, getResult{value: 1}, <-evicted)
		require.Equal(t, 1, cache.Len())
		require.Equal(t, 3, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should join the running load when a Get arrives after its key was evicted during that load", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: blockCalls(release, 1)}
		opts := validOptions()
		opts.MaxEntries = 1
		cache := newTestCache(t, opts, loader)

		first := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		require.Equal(t, 2, mustGet(t, cache, "tenant-b"))
		joiner := getAsync(t.Context(), cache, "tenant-a")
		synctest.Wait()
		require.Equal(t, 2, loader.callCount())
		close(release)

		require.Equal(t, getResult{value: 1}, <-first)
		require.Equal(t, getResult{value: 1}, <-joiner)
		require.Equal(t, 2, loader.callCount())
	})

	runInBubble(t, "should evict the least recently used key when MaxEntries is exceeded", func(t *testing.T) {
		loader := &scriptedLoader{}
		opts := validOptions()
		opts.MaxEntries = 2
		cache := newTestCache(t, opts, loader)

		mustGet(t, cache, "tenant-a")
		mustGet(t, cache, "tenant-b")
		mustGet(t, cache, "tenant-a")
		mustGet(t, cache, "tenant-c")
		require.Equal(t, 2, cache.Len())

		require.Equal(t, 1, mustGet(t, cache, "tenant-a"))
		require.Equal(t, 3, loader.callCount())
		require.Equal(t, 4, mustGet(t, cache, "tenant-b"))
	})

	runInBubble(t, "should return an error wrapping ErrLoaderPanic and keep serving afterwards when the loader panics", func(t *testing.T) {
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 1 {
				panic("kaboom")
			}
			return call, nil
		}}
		cache := newTestCache(t, validOptions(), loader)

		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, ErrLoaderPanic)
		require.ErrorContains(t, err, "kaboom")
		require.Equal(t, 0, cache.Len())
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should return an error wrapping ErrLoaderPanic to every waiter when the loader calls runtime.Goexit", func(t *testing.T) {
		release := make(chan struct{})
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			if call == 1 {
				<-release
				runtime.Goexit()
			}
			return call, nil
		}}
		cache := newTestCache(t, validOptions(), loader)

		waiters := []<-chan getResult{
			getAsync(t.Context(), cache, "tenant-a"),
			getAsync(t.Context(), cache, "tenant-a"),
			getAsync(t.Context(), cache, "tenant-a"),
		}
		synctest.Wait()
		close(release)

		for _, waiter := range waiters {
			require.ErrorIs(t, (<-waiter).err, ErrLoaderPanic)
		}
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})

	runInBubble(t, "should keep no entry when the loader calls runtime.Goexit during the first load", func(t *testing.T) {
		loader := &scriptedLoader{fn: func(ctx context.Context, key string, call int) (int, error) {
			runtime.Goexit()
			return 0, nil
		}}
		cache := newTestCache(t, validOptions(), loader)

		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, ErrLoaderPanic)
		require.Equal(t, 0, cache.Len())
	})

	runInBubble(t, "should work with a nil Logger and Tracer and without registering the cache as a collector", func(t *testing.T) {
		opts := validOptions()
		opts.Logger = nil
		opts.Tracer = nil
		loader := &scriptedLoader{fn: failCalls(1)}
		cache := newTestCache(t, opts, loader)

		_, err := cache.Get(t.Context(), "tenant-a")
		require.ErrorIs(t, err, errBoom)
		require.Equal(t, 2, mustGet(t, cache, "tenant-a"))
	})
}

func TestMetrics(t *testing.T) {
	t.Run("should expose every series with the MetricsPrefix and lint-clean names right after New", func(t *testing.T) {
		cache := newTestCache(t, validOptions(), &scriptedLoader{})
		registry := prometheus.NewRegistry()
		require.NoError(t, registry.Register(cache))

		families, err := registry.Gather()
		require.NoError(t, err)
		labelsByName := make(map[string][]string, len(families))
		for _, family := range families {
			labels := []string{}
			for _, metric := range family.GetMetric() {
				for _, label := range metric.GetLabel() {
					labels = append(labels, label.GetName()+"="+label.GetValue())
				}
			}
			slices.Sort(labels)
			labelsByName[family.GetName()] = labels
		}
		require.Equal(t, map[string][]string{
			"test_cache_entries":               {},
			"test_cache_load_duration_seconds": {"result=error", "result=success"},
			"test_cache_requests_total": {
				"result=cancelled", "result=fresh", "result=miss", "result=refreshed",
				"result=stale_cancelled", "result=stale_error", "result=stale_throttled", "result=stale_timeout",
			},
		}, labelsByName)

		problems, err := testutil.CollectAndLint(cache)
		require.NoError(t, err)
		require.Empty(t, problems)
	})
}

// BenchmarkCache_Get reads 2000 keys whose entries go stale every few milliseconds, so the
// benchmark also exercises refreshes, stale timeouts and failed refreshes. heap-growth-B is the
// change in live heap across the run, measured after loads still running have finished and a GC;
// it should stay flat as -benchtime grows. Each parallel goroutine starts at its own key offset.
func BenchmarkCache_Get(b *testing.B) {
	const entries = 2000
	const slowLoad = 2 * time.Millisecond

	keys := make([]string, entries)
	for i := range keys {
		keys[i] = "tenant-" + strconv.Itoa(i)
	}

	var calls, running atomic.Int64
	load := func(ctx context.Context, key string) (int, error) {
		running.Add(1)
		defer running.Add(-1)
		call := calls.Add(1)
		switch {
		case call%1000 == 0:
			return 0, errBoom
		case call%10 == 0:
			select {
			case <-time.After(slowLoad):
			case <-ctx.Done():
				return 0, ctx.Err()
			}
		}
		return int(call), nil
	}
	cache, err := New(load, Options{
		MetricsPrefix:      "bench_cache",
		TTL:                time.Second,
		RefreshInterval:    10 * time.Millisecond,
		MinRefreshInterval: 5 * time.Millisecond,
		StaleWait:          slowLoad / 2,
		LoadTimeout:        time.Second,
		MaxEntries:         entries,
	})
	require.NoError(b, err)
	for _, key := range keys {
		_, _ = cache.Get(b.Context(), key)
	}

	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)
	b.ReportAllocs()
	b.ResetTimer()

	const offsetStep = 7919 // prime, so parallel goroutines start at different keys
	var workers atomic.Int64
	b.RunParallel(func(pb *testing.PB) {
		i := int(workers.Add(1)) * offsetStep % entries
		for pb.Next() {
			_, _ = cache.Get(b.Context(), keys[i%entries])
			i++
		}
	})

	b.StopTimer()
	for range 1000 {
		if running.Load() == 0 {
			break
		}
		time.Sleep(time.Millisecond)
	}
	runtime.GC()
	runtime.ReadMemStats(&after)
	b.ReportMetric(float64(int64(after.HeapAlloc)-int64(before.HeapAlloc)), "heap-growth-B")
	b.ReportMetric(float64(cache.Len()), "entries")
}
