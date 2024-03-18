package ringq

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
)

func ints(n int) []int {
	ret := make([]int, n)
	for i := range ret {
		ret[i] = i + 1
	}
	return ret
}

func TestRingQ(t *testing.T) {
	t.Parallel()
	const (
		dLen     = 10
		dHalfLen = dLen / 2
	)
	data := ints(dLen)
	lData := slices.Clone(data[:dHalfLen])
	rData := slices.Clone(data[dHalfLen:])

	zeroQ := new(RingQ[int])
	emptyQ := &RingQ[int]{
		s: []int{},
	}

	t.Run("basic enqueue and dequeue - without max", func(t *testing.T) {
		t.Parallel()
		q := new(RingQ[int])

		enq(t, q, data...)
		equalQ(t, &RingQ[int]{
			len: dLen,
			s:   data,
		}, q)

		deq(t, q, lData...)
		equalQ(t, &RingQ[int]{
			back: dHalfLen,
			len:  dHalfLen,
			s:    append(make([]int, dHalfLen), rData...),
		}, q)

		enq(t, q, data...)
		equalQ(t, &RingQ[int]{
			len: dLen + dHalfLen,
			s:   append(rData, data...),
		}, q)

		deqAll(t, q, append(rData, data...)...)
		equalQ(t, emptyQ, q)

		enq(t, q, data...)
		equalQ(t, &RingQ[int]{
			len: dLen,
			s:   data,
		}, q)

		clearq(t, q)
		equalQ(t, emptyQ, q)
	})

	t.Run("enqueue, dequeue, grow and shrink - with max", func(t *testing.T) {
		t.Parallel()
		q := new(RingQ[int])
		q.Max = dLen

		// basic wrap and overwrite
		enq(t, q, lData...)
		enq(t, q, data...)
		enq(t, q, data...)
		equalQ(t, &RingQ[int]{
			back: dHalfLen,
			len:  dLen,
			s:    append(rData, lData...),
		}, q)
		require.Equal(t, dLen, q.Cap())

		// can't allocate past max and cannot shrink because we're at capacity
		q.Grow(3 * dLen)
		require.Equal(t, dLen, q.Cap())
		equalQ(t, &RingQ[int]{
			back: dHalfLen,
			len:  dLen,
			s:    append(rData, lData...),
		}, q)

		q.Shrink(2 * dLen)
		require.Equal(t, dLen, q.Cap())
		equalQ(t, &RingQ[int]{
			back: dHalfLen,
			len:  dLen,
			s:    append(rData, lData...),
		}, q)

		// remove some items and play with extra space
		deq(t, q, lData...)
		equalQ(t, &RingQ[int]{
			len: dHalfLen,
			s:   rData,
		}, q)

		q.Shrink(1)
		require.Equal(t, dHalfLen+1, q.Cap())
		q.Grow(2)
		require.Equal(t, dHalfLen+2, q.Cap())
		q.Grow(dLen)
		require.Equal(t, dLen, q.Cap())
	})

	t.Run("growing and shrinking invariants - without max", func(t *testing.T) {
		t.Parallel()
		q := new(RingQ[int])

		// dummy grow and shrink
		q.Grow(0)
		require.Equal(t, 0, q.Cap())
		equalQ(t, zeroQ, q)

		q.Shrink(0)
		require.Equal(t, 0, q.Cap())
		equalQ(t, zeroQ, q)

		// add 3*dLen and leave 2*dLen
		q.Grow(3 * dLen)
		require.Equal(t, 3*dLen, q.Cap())
		equalQ(t, emptyQ, q)

		q.Shrink(2 * dLen)
		require.Equal(t, 2*dLen, q.Cap())
		equalQ(t, emptyQ, q)

		// add dLen items and play with cap
		enq(t, q, data...)
		require.Equal(t, 2*dLen, q.Cap())
		equalQ(t, &RingQ[int]{
			len: dLen,
			s:   data,
		}, q)

		q.Grow(2 * dLen)
		require.GreaterOrEqual(t, q.Cap(), 3*dLen)
		equalQ(t, &RingQ[int]{
			len: dLen,
			s:   data,
		}, q)

		q.Shrink(0)
		require.Equal(t, dLen, q.Cap())
		equalQ(t, &RingQ[int]{
			len: dLen,
			s:   data,
		}, q)

		// remove all items and shrink to zero
		deqAll(t, q, data...)
		require.Equal(t, dLen, q.Cap())
		equalQ(t, emptyQ, q)

		q.Shrink(0)
		require.Equal(t, 0, q.Cap())
		equalQ(t, zeroQ, q)
	})
}

func enq[T any](t *testing.T, q *RingQ[T], s ...T) {
	t.Helper()

	initLen := q.Len()
	initCap := q.Cap()
	for _, v := range s {
		require.NotPanics(t, func() {
			q.Enqueue(v)
		})
	}

	expectedLen := initLen + len(s)
	if q.Max > 0 {
		expectedMax := max(initCap, q.Max)
		expectedLen = min(expectedLen, expectedMax)
	}
	require.Equal(t, expectedLen, q.Len())
}

func deq[T any](t *testing.T, q *RingQ[T], expected ...T) {
	t.Helper()

	oldCap := q.Cap()
	if oldCap == 0 {
		require.Nil(t, q.s)         // internal state
		require.Equal(t, 0, q.back) // internal state
		return
	}

	oldLen := q.Len()
	require.True(t, oldLen >= len(expected))
	got := make([]T, len(expected))
	for i := range got {
		var val T
		require.NotPanics(t, func() {
			prePeekLen := q.Len()
			val = q.Peek()
			require.Equal(t, prePeekLen, q.Len())
			got[i] = q.Dequeue()
		})
		require.Equal(t, val, got[i])
	}

	require.Equal(t, expected, got)
	require.Equal(t, oldLen-len(expected), q.Len())
	require.Equal(t, oldCap, q.Cap(), "should not change capacity")
}

func clearq[T any](t *testing.T, q *RingQ[T]) {
	t.Helper()

	oldCap := q.Cap()
	require.NotPanics(t, func() {
		q.Clear()
	})
	zeroS := make([]T, oldCap)
	require.Equal(t, 0, q.Len())
	require.Equal(t, zeroS, q.s) // internal state
	require.Equal(t, 0, q.back)  // internal state

	// dequeueing should yield zero values
	var zero T
	for i := 0; i < 10; i++ {
		var val1, val2 T
		require.NotPanics(t, func() {
			val1 = q.Peek()
			val1 = q.Dequeue()
		})
		require.Equal(t, zero, val1)
		require.Equal(t, zero, val2)
	}

	require.Equal(t, oldCap, q.Cap(), "should not change capacity")
}

func deqAll[T any](t *testing.T, q *RingQ[T], expected ...T) {
	t.Helper()

	oldCap := q.Cap()
	deq[T](t, q, expected...)

	zeroS := make([]T, oldCap)
	require.Equal(t, zeroS, q.s) // internal state

	require.Equal(t, 0, q.Len())

	// dequeueing further should yield zero values when empty
	var zero T
	for i := 0; i < 10; i++ {
		var val1, val2 T
		require.NotPanics(t, func() {
			val1 = q.Peek()
			val2 = q.Dequeue()
		})
		require.Equal(t, zero, val1)
		require.Equal(t, zero, val2)
	}

	require.Equal(t, oldCap, q.Cap(), "should not change capacity")

	clearq(t, q)
}

func equalQ[T any](t *testing.T, expected, got *RingQ[T]) {
	t.Helper()
	// internal state
	require.Equal(t, expected.back, got.back, "expected.back == got.back")
	require.Equal(t, expected.len, got.len,
		"len(expected.s)-expected.back == got.len")
	require.True(t, len(expected.s) <= len(got.s),
		"len(expected.s) <= len(got.s)")
	require.Equal(t, expected.s, got.s[:min(got.back+got.len, len(got.s))],
		"expected.s == got.s[:min(got.back+got.len, len(got.s))]")
	// not testing Max since it's not changed by the code
}
