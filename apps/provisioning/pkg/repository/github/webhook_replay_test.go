package github

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDeliveryIDCache(t *testing.T) {
	t.Run("first add returns false, duplicate returns true", func(t *testing.T) {
		c := newDeliveryIDCache(time.Hour)
		require.False(t, c.seenOrAdd("abc"))
		require.True(t, c.seenOrAdd("abc"))
	})

	t.Run("empty id is never considered seen", func(t *testing.T) {
		c := newDeliveryIDCache(time.Hour)
		require.False(t, c.seenOrAdd(""))
		require.False(t, c.seenOrAdd(""))
	})

	t.Run("entries expire after ttl", func(t *testing.T) {
		c := newDeliveryIDCache(time.Hour)
		now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		c.now = func() time.Time { return now }

		require.False(t, c.seenOrAdd("abc"))
		require.True(t, c.seenOrAdd("abc"))

		now = now.Add(2 * time.Hour)
		require.False(t, c.seenOrAdd("abc"))
	})

	t.Run("concurrent adds of the same id register exactly one as new", func(t *testing.T) {
		c := newDeliveryIDCache(time.Hour)

		const goroutines = 64
		var wg sync.WaitGroup
		wg.Add(goroutines)

		var newCount int64
		var mu sync.Mutex
		for i := 0; i < goroutines; i++ {
			go func() {
				defer wg.Done()
				if !c.seenOrAdd("same") {
					mu.Lock()
					newCount++
					mu.Unlock()
				}
			}()
		}
		wg.Wait()

		require.Equal(t, int64(1), newCount)
	})
}
