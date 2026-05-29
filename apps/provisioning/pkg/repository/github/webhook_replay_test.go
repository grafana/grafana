package github

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestReplayCache(t *testing.T) {
	t.Run("first add returns false, duplicate returns true", func(t *testing.T) {
		c := newReplayCache(time.Hour)
		require.False(t, c.seenOrAdd("abc"))
		require.True(t, c.seenOrAdd("abc"))
	})

	t.Run("empty key is never considered seen", func(t *testing.T) {
		c := newReplayCache(time.Hour)
		require.False(t, c.seenOrAdd(""))
		require.False(t, c.seenOrAdd(""))
	})

	t.Run("entries expire after ttl", func(t *testing.T) {
		const ttl = 50 * time.Millisecond
		c := newReplayCache(ttl)

		require.False(t, c.seenOrAdd("abc"))
		require.True(t, c.seenOrAdd("abc"))

		// Get honors expiry on read, so sleeping past the TTL makes the entry
		// look absent without depending on the background sweeper.
		time.Sleep(ttl + 20*time.Millisecond)
		require.False(t, c.seenOrAdd("abc"))
	})

	t.Run("concurrent adds of the same key register exactly one as new", func(t *testing.T) {
		c := newReplayCache(time.Hour)

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
