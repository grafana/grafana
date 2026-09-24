package controller

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestQueueWaitTrackerOldestAge(t *testing.T) {
	base := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)

	t.Run("empty tracker reports no delay", func(t *testing.T) {
		var q queueWaitTracker
		assert.Equal(t, time.Duration(0), q.oldestAge(base))
	})

	t.Run("single key reports time since its enqueue", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("a", base)
		assert.Equal(t, 30*time.Second, q.oldestAge(base.Add(30*time.Second)))
	})

	t.Run("reports the earliest enqueue regardless of insertion order", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("newer", base.Add(10*time.Second))
		q.mark("older", base)
		// oldest is "older", enqueued at base.
		assert.Equal(t, time.Minute, q.oldestAge(base.Add(time.Minute)))
	})

	t.Run("re-mark of a pending key keeps the first timestamp", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("a", base)
		q.mark("a", base.Add(time.Minute)) // coalesced re-add must not reset the clock
		assert.Equal(t, 90*time.Second, q.oldestAge(base.Add(90*time.Second)))
	})

	t.Run("popped key no longer contributes", func(t *testing.T) {
		var q queueWaitTracker
		q.mark("older", base)
		q.mark("newer", base.Add(20*time.Second))

		q.pop("older")
		// only "newer" remains, enqueued at base+20s.
		assert.Equal(t, 40*time.Second, q.oldestAge(base.Add(time.Minute)))

		q.pop("newer")
		assert.Equal(t, time.Duration(0), q.oldestAge(base.Add(time.Minute)))
	})
}
