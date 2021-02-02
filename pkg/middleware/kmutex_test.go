package middleware

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestMiddlewareKmutex(t *testing.T) {
	t.Run("When unlock a key does not exist, panic raised", func(t *testing.T) {
		mtx := NewKmutex()

		defer func() {
			r := recover()
			require.Equal(t, r, "kmutex: unlock of unlocked mutex")
		}()

		mtx.Unlock("xyz")
	})

	t.Run("When lock unlock with success", func(t *testing.T) {
		// The following is the code under test
		wg := sync.WaitGroup{}
		mtx := NewKmutex()
		ids := []string{
			"datasource1",
			"datasource2",
			"datasource3",
		}
		ii := 0
		for i := 0; i < 3; i++ {
			wg.Add(1)
			go func(iii int, i int) {
				mtx.Lock(ids[iii])
				time.Sleep(time.Second)
				require.True(t, mtx.IsLocked(ids[iii]))
				mtx.Unlock(ids[iii])
				require.False(t, mtx.IsLocked(ids[iii]))
				wg.Done()
			}(ii, i)
			ii++
		}
		wg.Wait()
	})
}
