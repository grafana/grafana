package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueueWaitTrackerLag(t *testing.T) {
	base := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)

	t.Run("empty tracker reports no lag", func(t *testing.T) {
		var q queueWaitTracker
		assert.Equal(t, time.Duration(0), q.lag(base))
	})

	t.Run("single waiting key reports time since its enqueue", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("a", base)
		assert.Equal(t, 30*time.Second, q.lag(base.Add(30*time.Second)))
	})

	t.Run("reports the earliest enqueue regardless of insertion order", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("newer", base.Add(10*time.Second))
		q.mark("older", base)
		assert.Equal(t, time.Minute, q.lag(base.Add(time.Minute)))
	})

	t.Run("re-mark of a waiting key keeps the first timestamp", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("a", base)
		q.mark("a", base.Add(time.Minute)) // coalesced re-add must not reset the clock
		assert.Equal(t, 90*time.Second, q.lag(base.Add(90*time.Second)))
	})

	t.Run("in-flight key still counts toward lag, measured from first enqueue", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("a", base)

		enqueuedAt, ok := q.startProcessing("a")
		require.True(t, ok)
		assert.Equal(t, base, enqueuedAt)

		// Queue is now drained (nothing waiting) but "a" is still being processed;
		// lag must keep climbing from the original enqueue, not read 0.
		assert.Equal(t, 2*time.Minute, q.lag(base.Add(2*time.Minute)))

		q.finishProcessing("a")
		assert.Equal(t, time.Duration(0), q.lag(base.Add(2*time.Minute)))
	})

	t.Run("startProcessing on an untracked key reports no wait and no inflight", func(t *testing.T) {
		var q queueWaitTracker
		_, ok := q.startProcessing("ghost")
		assert.False(t, ok)
		assert.Equal(t, time.Duration(0), q.lag(base))
	})

	t.Run("finishProcessing is idempotent", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("a", base)
		_, ok := q.startProcessing("a")
		require.True(t, ok)
		q.finishProcessing("a")
		q.finishProcessing("a") // second call must not panic or resurrect state
		assert.Equal(t, time.Duration(0), q.lag(base.Add(time.Minute)))
	})

	t.Run("oldest across waiting and inflight wins", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("inflight-old", base)
		_, ok := q.startProcessing("inflight-old")
		require.True(t, ok)
		q.mark("waiting-new", base.Add(20*time.Second))

		// inflight-old (base) is older than waiting-new (base+20s).
		assert.Equal(t, time.Minute, q.lag(base.Add(time.Minute)))

		// Once the old in-flight key finishes, the waiting key drives lag.
		q.finishProcessing("inflight-old")
		assert.Equal(t, 40*time.Second, q.lag(base.Add(time.Minute)))
	})
}
