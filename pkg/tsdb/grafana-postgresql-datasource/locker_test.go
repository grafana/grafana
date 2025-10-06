package postgres

import (
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestIntegrationLocker(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const notUpdated = "not_updated"
	const atThread1 = "at_thread_1"
	const atThread2 = "at_thread_2"
	t.Run("Should lock for same keys", func(t *testing.T) {
		updated := notUpdated
		locker := newLocker()
		locker.Lock(1)
		var wg sync.WaitGroup
		wg.Add(1)
		defer func() {
			locker.Unlock(1)
			wg.Wait()
		}()

		go func() {
			locker.RLock(1)
			defer func() {
				locker.RUnlock(1)
				wg.Done()
			}()
			require.Equal(t, atThread1, updated, "Value should be updated in different thread")
			updated = atThread2
		}()
		time.Sleep(time.Millisecond * 10)
		require.Equal(t, notUpdated, updated, "Value should not be updated in different thread")
		updated = atThread1
	})

	t.Run("Should not lock for different keys", func(t *testing.T) {
		updated := notUpdated
		locker := newLocker()
		locker.Lock(1)
		defer locker.Unlock(1)
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			locker.RLock(2)
			defer func() {
				locker.RUnlock(2)
				wg.Done()
			}()
			require.Equal(t, notUpdated, updated, "Value should not be updated in different thread")
			updated = atThread2
		}()
		wg.Wait()
		require.Equal(t, atThread2, updated, "Value should be updated in different thread")
		updated = atThread1
	})
}
