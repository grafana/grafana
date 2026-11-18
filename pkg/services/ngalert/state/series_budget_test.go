package state

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSeriesBudget(t *testing.T) {
	t.Run("refuses once full and admits again after a release", func(t *testing.T) {
		b := NewSeriesBudget(2)
		require.True(t, b.Admit())
		require.True(t, b.Admit())
		require.False(t, b.Admit())
		require.EqualValues(t, 2, b.Used())

		b.Release(1)
		require.EqualValues(t, 1, b.Used())
		require.True(t, b.Admit())
		require.False(t, b.Admit())
	})

	t.Run("never admits more than the limit concurrently", func(t *testing.T) {
		const limit = 100
		b := NewSeriesBudget(limit)

		var admitted atomic.Int64
		var wg sync.WaitGroup
		for range 64 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for range 50 {
					if b.Admit() {
						admitted.Add(1)
					}
				}
			}()
		}
		wg.Wait()

		require.EqualValues(t, limit, admitted.Load())
		require.EqualValues(t, limit, b.Used())
	})

	t.Run("release never takes the count below zero", func(t *testing.T) {
		b := NewSeriesBudget(5)
		require.True(t, b.Admit())
		b.Release(10)
		require.EqualValues(t, 0, b.Used())
		b.Release(-3)
		require.EqualValues(t, 0, b.Used())
	})

	t.Run("a limit of zero is unlimited but still counts", func(t *testing.T) {
		b := NewSeriesBudget(0)
		for range 1000 {
			require.True(t, b.Admit())
		}
		require.EqualValues(t, 1000, b.Used())
	})

	t.Run("a nil budget is unlimited", func(t *testing.T) {
		var b *SeriesBudget
		require.True(t, b.Admit())
		b.Release(1)
		require.EqualValues(t, 0, b.Used())
	})
}
