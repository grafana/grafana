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

func TestSeriesBudgetChild(t *testing.T) {
	t.Run("children never exceed their own limit or the parent's, concurrently", func(t *testing.T) {
		parent := NewSeriesBudget(100)
		a, b := parent.Child(70), parent.Child(70)

		var admittedA, admittedB atomic.Int64
		var wg sync.WaitGroup
		for i := range 64 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				child, counter := a, &admittedA
				if i%2 == 1 {
					child, counter = b, &admittedB
				}
				for range 50 {
					if child.Admit() {
						counter.Add(1)
					}
				}
			}()
		}
		wg.Wait()

		require.EqualValues(t, 100, admittedA.Load()+admittedB.Load(), "the parent is filled exactly")
		require.EqualValues(t, 100, parent.Used())
		require.LessOrEqual(t, admittedA.Load(), int64(70))
		require.LessOrEqual(t, admittedB.Load(), int64(70))
		require.EqualValues(t, admittedA.Load(), a.Used())
		require.EqualValues(t, admittedB.Load(), b.Used())
	})

	t.Run("a refusal by the parent rolls the child back", func(t *testing.T) {
		parent := NewSeriesBudget(1)
		a, b := parent.Child(10), parent.Child(10)
		require.True(t, a.Admit())

		require.False(t, b.Admit())
		require.EqualValues(t, 0, b.Used(), "the reservation in the child was given back")
		require.EqualValues(t, 1, parent.Used())

		a.Release(1)
		require.True(t, b.Admit(), "room freed in the parent is usable by the other child")
	})

	t.Run("a refusal by the child leaves the parent alone", func(t *testing.T) {
		parent := NewSeriesBudget(10)
		child := parent.Child(1)
		require.True(t, child.Admit())
		require.False(t, child.Admit())
		require.EqualValues(t, 1, parent.Used())
	})

	t.Run("release gives room back to both", func(t *testing.T) {
		parent := NewSeriesBudget(10)
		child := parent.Child(5)
		for range 4 {
			require.True(t, child.Admit())
		}
		child.Release(3)
		require.EqualValues(t, 1, child.Used())
		require.EqualValues(t, 1, parent.Used())
	})

	t.Run("releasing more than the child holds does not take the parent's room", func(t *testing.T) {
		parent := NewSeriesBudget(10)
		a, b := parent.Child(0), parent.Child(0)
		require.True(t, a.Admit())
		require.True(t, b.Admit())
		require.True(t, b.Admit())

		a.Release(5)
		require.EqualValues(t, 0, a.Used())
		require.EqualValues(t, 2, parent.Used(), "only the one series a held went back")
	})

	t.Run("a child without a limit still counts upward and the parent limit holds", func(t *testing.T) {
		parent := NewSeriesBudget(2)
		child := parent.Child(0)
		require.True(t, child.Admit())
		require.True(t, child.Admit())
		require.False(t, child.Admit())
		require.EqualValues(t, 2, child.Used())
		require.EqualValues(t, 2, parent.Used())
	})

	t.Run("an unlimited parent only counts", func(t *testing.T) {
		parent := NewSeriesBudget(0)
		child := parent.Child(3)
		for range 3 {
			require.True(t, child.Admit())
		}
		require.False(t, child.Admit())
		require.EqualValues(t, 3, parent.Used())
	})

	t.Run("a child of a nil budget is a plain budget", func(t *testing.T) {
		var parent *SeriesBudget
		child := parent.Child(1)
		require.True(t, child.Admit())
		require.False(t, child.Admit())
	})
}
