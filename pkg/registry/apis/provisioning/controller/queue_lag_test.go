package controller

import (
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueueLagTracker(t *testing.T) {
	t.Run("empty tracker reports no lag", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			assert.Equal(t, time.Duration(0), q.lag())
		})
	})

	t.Run("waiting key reports time since its enqueue", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			time.Sleep(30 * time.Second)
			assert.Equal(t, 30*time.Second, q.lag())
		})
	})

	t.Run("reports the earliest enqueue regardless of insertion order", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("older")
			time.Sleep(10 * time.Second)
			q.add("newer")
			time.Sleep(50 * time.Second)
			assert.Equal(t, time.Minute, q.lag()) // older has waited 60s
		})
	})

	t.Run("coalesced re-add keeps the first timestamp", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			time.Sleep(time.Minute)
			q.add("a") // must not reset the clock
			time.Sleep(30 * time.Second)
			assert.Equal(t, 90*time.Second, q.lag())
		})
	})

	t.Run("get returns the enqueue time for the wait log", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			time.Sleep(15 * time.Second)
			enqueuedAt, ok := q.get("a")
			require.True(t, ok)
			assert.Equal(t, 15*time.Second, time.Since(enqueuedAt))
		})
	})

	t.Run("in-flight key still counts toward lag from first enqueue", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			_, ok := q.get("a")
			require.True(t, ok)
			// Queue is now drained (nothing waiting) but "a" is still processing;
			// lag must keep climbing from the original enqueue, not read 0.
			time.Sleep(2 * time.Minute)
			assert.Equal(t, 2*time.Minute, q.lag())

			q.done("a")
			assert.Equal(t, time.Duration(0), q.lag())
		})
	})

	t.Run("re-add while in flight has its own enqueue time", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a") // first enqueue
			_, ok := q.get("a")
			require.True(t, ok)
			time.Sleep(time.Minute)
			q.add("a") // re-added while in flight (informer update or AddAfter)
			assert.Equal(t, time.Minute, q.lag())
			time.Sleep(10 * time.Second)
			q.done("a")
			assert.Equal(t, 10*time.Second, q.lag())
			time.Sleep(20 * time.Second)
			assert.Equal(t, 30*time.Second, q.lag())
		})
	})

	t.Run("get on an untracked key reports no wait and no inflight", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			_, ok := q.get("ghost")
			assert.False(t, ok)
			assert.Equal(t, time.Duration(0), q.lag())
		})
	})

	t.Run("done is idempotent", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			_, ok := q.get("a")
			require.True(t, ok)
			q.done("a")
			q.done("a") // second call must not panic or resurrect state
			assert.Equal(t, time.Duration(0), q.lag())
		})
	})

	t.Run("oldest across waiting and inflight wins", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("inflight-old")
			_, ok := q.get("inflight-old")
			require.True(t, ok)
			time.Sleep(20 * time.Second)
			q.add("waiting-new")
			time.Sleep(40 * time.Second)

			// inflight-old has waited 60s, waiting-new 40s.
			assert.Equal(t, time.Minute, q.lag())

			// Once the old in-flight key finishes, the waiting key drives lag.
			q.done("inflight-old")
			assert.Equal(t, 40*time.Second, q.lag())
		})
	})
}

func TestQueueLagTrackerCompletion(t *testing.T) {
	t.Run("repeated retries start a fresh wait and survive deferred cleanup", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			for range 3 {
				time.Sleep(10 * time.Second)
				enqueuedAt, ok := q.get("a")
				require.True(t, ok)
				assert.Equal(t, 10*time.Second, time.Since(enqueuedAt))
				time.Sleep(20 * time.Second)
				assert.Equal(t, 30*time.Second, q.lag())
				q.done("a")
				q.add("a")
				q.done("a")
				q.done("a")
				assert.Zero(t, q.lag())
			}
			_, ok := q.get("a")
			require.True(t, ok)
			q.done("a")
			assert.Zero(t, q.lag())
		})
	})

	t.Run("completion and duplicate enqueues preserve an in-flight update's wait", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			_, ok := q.get("a")
			require.True(t, ok)
			time.Sleep(time.Minute)
			q.add("a")
			time.Sleep(10 * time.Second)
			q.done("a")
			time.Sleep(10 * time.Second)
			q.done("a")
			q.add("a")
			q.done("a")
			assert.Equal(t, 20*time.Second, q.lag())
			enqueuedAt, ok := q.get("a")
			require.True(t, ok)
			assert.Equal(t, 20*time.Second, time.Since(enqueuedAt))
			q.done("a")
			assert.Zero(t, q.lag())
		})
	})

	t.Run("completion preserves enqueue order across waiting and in-flight entries", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("retry")
			_, ok := q.get("retry")
			require.True(t, ok)
			time.Sleep(10 * time.Second)
			q.add("waiting")
			time.Sleep(5 * time.Second)
			q.add("retry")
			time.Sleep(5 * time.Second)
			q.add("inflight")
			_, ok = q.get("inflight")
			require.True(t, ok)
			time.Sleep(10 * time.Second)
			q.done("retry")
			assert.Equal(t, 20*time.Second, q.lag())
			_, ok = q.get("waiting")
			require.True(t, ok)
			q.done("waiting")
			assert.Equal(t, 15*time.Second, q.lag())
			enqueuedAt, ok := q.get("retry")
			require.True(t, ok)
			assert.Equal(t, 15*time.Second, time.Since(enqueuedAt))
			q.done("retry")
			assert.Equal(t, 10*time.Second, q.lag())
			q.done("inflight")
			assert.Zero(t, q.lag())
		})
	})

	t.Run("completion without redelivery removes the key", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.add("a")
			_, ok := q.get("a")
			require.True(t, ok)
			time.Sleep(time.Minute)
			q.done("a")
			q.done("a")
			assert.Empty(t, q.waiting)
			assert.Empty(t, q.inflight)
			assert.Zero(t, q.lag())
		})
	})

	t.Run("completion without an in-flight attempt leaves waiting keys alone", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			var q queueLagTracker
			q.done("untracked")
			assert.Empty(t, q.waiting)
			assert.Zero(t, q.lag())
			q.add("waiting")
			time.Sleep(time.Minute)
			q.done("waiting")
			assert.Equal(t, time.Minute, q.lag())
		})
	})
}
