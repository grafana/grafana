package ring

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

func TestRing(t *testing.T) {
	t.Parallel()
	const (
		dLen     = 10
		dHalfLen = dLen / 2
	)
	data := ints(dLen)
	lData := slices.Clone(data[:dHalfLen])
	rData := slices.Clone(data[dHalfLen:])

	require.NotPanics(t, func() {
		new(Ring[int]).WriteStats(nil)
	}, "WriteStats should be panic free")

	t.Run("basic enqueue and dequeue - no min, no max", func(t *testing.T) {
		t.Parallel()
		q, expected := new(Ring[int]), new(Ring[int])

		enq(t, q, data...)
		expected.len = dLen
		expected.stats.Enqueued = dLen
		expected.buf = data
		ringEq(t, expected, q)

		deq(t, q, lData...)
		expected.back = dHalfLen
		expected.len = dHalfLen
		expected.stats.Dequeued = dHalfLen
		expected.buf = append(make([]int, dHalfLen), rData...)
		ringEq(t, expected, q)

		enq(t, q, data...)
		expected.back = 0
		expected.len = dLen + dHalfLen
		expected.stats.Enqueued += dLen
		expected.buf = append(rData, data...)
		ringEq(t, expected, q)

		deqAll(t, q, append(rData, data...)...)
		expected.len = 0
		expected.stats.Dequeued += dLen + dHalfLen
		expected.buf = []int{}
		ringEq(t, expected, q)

		enq(t, q, data...)
		expected.len = dLen
		expected.stats.Enqueued += dLen
		expected.buf = data
		ringEq(t, expected, q)

		clearRing(t, q)
		expected.len = 0
		expected.stats.Dequeued += dLen
		expected.buf = []int{}
		ringEq(t, expected, q)
	})

	t.Run("enqueue, dequeue, grow and shrink - no min, yes max", func(t *testing.T) {
		t.Parallel()
		q, expected := new(Ring[int]), new(Ring[int])
		q.Max = dLen

		// basic wrap and overwrite
		enq(t, q, lData...)
		enq(t, q, data...)
		enq(t, q, data...)
		expected.back = dHalfLen
		expected.buf = append(rData, lData...)
		expected.len = dLen
		expected.stats.Enqueued = 2*dLen + dHalfLen
		expected.stats.Dropped = dLen + dHalfLen
		ringEq(t, expected, q)
		require.Equal(t, dLen, q.Cap())

		// can't allocate past max and cannot shrink because we're at capacity
		q.Grow(3 * dLen)
		ringEq(t, expected, q)
		require.Equal(t, dLen, q.Cap())

		q.Shrink(2 * dLen)
		ringEq(t, expected, q)
		require.Equal(t, dLen, q.Cap())

		// remove some items and play with extra space
		deq(t, q, lData...)
		expected.back = 0
		expected.buf = rData
		expected.len -= dHalfLen
		expected.stats.Dequeued = dHalfLen
		require.Equal(t, dLen, q.Cap())
		ringEq(t, expected, q)

		q.Shrink(1)
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen+1, q.Cap())

		q.Grow(2)
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen+2, q.Cap())

		q.Grow(dLen)
		ringEq(t, expected, q)
		require.Equal(t, dLen, q.Cap())
	})

	t.Run("enqueue, dequeue, grow and shrink - yes min, no max", func(t *testing.T) {
		t.Parallel()
		q, expected := new(Ring[int]), new(Ring[int])
		q.Min = dHalfLen

		// enqueueing one item should allocate Min
		enq(t, q, 1)
		expected.buf = []int{1}
		expected.len = 1
		expected.stats.Enqueued = 1
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// clearing should not migrate now
		clearRing(t, q)
		expected.buf = []int{}
		expected.len = 0
		expected.stats.Dequeued = 1
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// enqueue some data
		enq(t, q, data...)
		expected.buf = data
		expected.len = dLen
		expected.stats.Enqueued += dLen
		ringEq(t, expected, q)
		require.GreaterOrEqual(t, q.Cap(), dLen)

		// now clearing should migrate and move to a slice of Min length
		clearRing(t, q)
		expected.buf = []int{}
		expected.len = 0
		expected.stats.Dequeued += dLen
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// we shouldn't be able to shrink past Min, but it shouldn't allocate a
		// greater slice either because it's purpose is to reduce allocated
		// memory if possible
		q.Min = dLen
		q.Shrink(dHalfLen)
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// dequeueing shouldn't allocate either, just in case
		require.Zero(t, q.Dequeue())
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// enqueueing one item allocates again to Min, which is now greater than
		// before
		enq(t, q, 1)
		expected.buf = []int{1}
		expected.len = 1
		expected.stats.Enqueued += 1
		ringEq(t, expected, q)
		require.Equal(t, dLen, q.Cap())

		// we reduce Min again, then we should be able to shrink as well
		q.Min = dHalfLen
		q.Shrink(dHalfLen)
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen+1, q.Cap())
		q.Shrink(1)
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())
		q.Shrink(0)
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// enqueue a lot and then dequeue all, we should still see Min cap
		enq(t, q, data...)
		expected.buf = append(expected.buf, data...)
		expected.len += dLen
		expected.stats.Enqueued += dLen
		ringEq(t, expected, q)
		require.GreaterOrEqual(t, q.Cap(), dLen+1)

		deqAll(t, q, expected.buf...)
		expected.buf = []int{}
		expected.len = 0
		expected.stats.Dequeued += dLen + 1
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())
	})

	t.Run("enqueue, dequeue, grow and shrink - yes min, yes max", func(t *testing.T) {
		t.Parallel()
		q, expected := new(Ring[int]), new(Ring[int])
		q.Min, q.Max = dHalfLen, dLen

		// single enqueueing should allocate for Min
		enq(t, q, 1)
		expected.buf = []int{1}
		expected.len = 1
		expected.stats.Enqueued = 1
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())

		// enqueue a lot until we overwrite the first item
		enq(t, q, data...)
		expected.back = 1
		expected.buf = append(data[dLen-1:], data[:dLen-1]...)
		expected.len = dLen
		expected.stats.Enqueued += dLen
		expected.stats.Dropped = 1
		ringEq(t, expected, q)
		require.Equal(t, dLen, q.Cap())

		// clearing should bring us back to Min alloc
		clearRing(t, q)
		expected.back = 0
		expected.buf = expected.buf[:0]
		expected.len = 0
		expected.stats.Dequeued += dLen
		ringEq(t, expected, q)
		require.Equal(t, dHalfLen, q.Cap())
	})

	t.Run("growing and shrinking invariants - no min, no max", func(t *testing.T) {
		t.Parallel()
		q, expected := new(Ring[int]), new(Ring[int])

		// dummy grow and shrink
		q.Grow(0)
		require.Equal(t, 0, q.Cap())
		ringEq(t, expected, q)

		q.Shrink(0)
		require.Equal(t, 0, q.Cap())
		ringEq(t, expected, q)

		// add 3*dLen and leave 2*dLen
		q.Grow(3 * dLen)
		expected.buf = []int{}
		require.Equal(t, 3*dLen, q.Cap())
		ringEq(t, expected, q)

		q.Shrink(2 * dLen)
		require.Equal(t, 2*dLen, q.Cap())
		ringEq(t, expected, q)

		// add dLen items and play with cap
		enq(t, q, data...)
		expected.buf = data
		expected.len = dLen
		expected.stats.Enqueued = dLen
		require.Equal(t, 2*dLen, q.Cap())
		ringEq(t, expected, q)

		q.Grow(2 * dLen)
		require.GreaterOrEqual(t, q.Cap(), 3*dLen)
		ringEq(t, expected, q)

		q.Shrink(0)
		require.Equal(t, dLen, q.Cap())
		ringEq(t, expected, q)

		// remove all items and shrink to zero
		deqAll(t, q, data...)
		expected.buf = []int{}
		expected.len = 0
		expected.stats.Dequeued = dLen
		require.Equal(t, dLen, q.Cap())
		ringEq(t, expected, q)

		q.Shrink(0)
		expected.buf = nil
		require.Equal(t, 0, q.Cap())
		ringEq(t, expected, q)
	})
}

// enq enqueues the given items into the given Ring.
func enq[T any](t *testing.T, q *Ring[T], s ...T) {
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

// deq dequeues len(expected) items from the given Ring and compares them to
// expected. Ring should have at least len(expected) items.
func deq[T any](t *testing.T, q *Ring[T], expected ...T) {
	t.Helper()

	if q.Cap() == 0 {
		require.Nil(t, q.buf)       // internal state
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
}

// clearRing calls Clear on the given Ring and performs a set of assertions that
// should be satisfied afterwards.
func clearRing[T any](t *testing.T, q *Ring[T]) {
	t.Helper()

	var expectedBuf []T
	if clearShouldMigrate(q.Cap(), q.Min, q.Max) {
		expectedBuf = make([]T, q.Min)
	} else {
		expectedBuf = make([]T, q.Cap())
	}

	require.NotPanics(t, func() {
		q.Clear()
	})
	require.Equal(t, expectedBuf, q.buf) // internal state
	require.Equal(t, 0, q.Len())
	require.Equal(t, 0, q.back) // internal state

	// dequeueing should yield zero values
	var zero T
	for range 10 {
		var val1, val2 T
		require.NotPanics(t, func() {
			val1 = q.Peek()
			val1 = q.Dequeue()
		})
		require.Equal(t, zero, val1)
		require.Equal(t, zero, val2)
	}
}

// deqAll depletes the given Ring and compares the dequeued items to those
// provided.
func deqAll[T any](t *testing.T, q *Ring[T], expected ...T) {
	t.Helper()

	deq[T](t, q, expected...)

	zeroS := make([]T, q.Cap())
	require.Equal(t, zeroS, q.buf) // internal state

	require.Equal(t, 0, q.Len())

	// dequeueing further should yield zero values when empty
	var zero T
	for range 10 {
		var val1, val2 T
		require.NotPanics(t, func() {
			val1 = q.Peek()
			val2 = q.Dequeue()
		})
		require.Equal(t, zero, val1)
		require.Equal(t, zero, val2)
	}

	clearRing(t, q)
}

// ringEq tests that the given Rings are the same in many aspects. The following
// are the things that are not checked:
//   - The values of Min and Max, since the code does not programmatically
//     channge them
//   - Allocation numbers (Cap, Grown, Shrunk, Allocs)
//   - The free capacity to the right of `got`
func ringEq[T any](t *testing.T, expected, got *Ring[T]) {
	t.Helper()

	var expStats, gotStats RingStats
	require.NotPanics(t, func() {
		expected.WriteStats(&expStats)
		got.WriteStats(&gotStats)
	})

	// capacity and allocations are to be tested separately
	removeAllocStats(&expStats)
	removeAllocStats(&gotStats)

	require.Equal(t, expStats, gotStats, "expStats == gotStats")

	// internal state
	require.Equal(t, expected.back, got.back, "expected.back == got.back")
	// only check for used capacity
	require.Equal(t, expected.buf, got.buf[:min(got.back+got.len, len(got.buf))],
		"expected.buf == got.buf[:min(got.back+got.len, len(got.s))]")
}

func removeAllocStats(s *RingStats) {
	s.Cap = 0
	s.Grown = 0
	s.Shrunk = 0
	s.Allocs = 0
}

func TestMinMaxValidity(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		Min, Max               int
		minIsValid, maxIsValid bool
	}{
		{Min: 0, Max: 0, minIsValid: false, maxIsValid: false},
		{Min: 0, Max: 1, minIsValid: false, maxIsValid: true},
		{Min: 0, Max: 2, minIsValid: false, maxIsValid: true},
		{Min: 1, Max: 0, minIsValid: true, maxIsValid: false},
		{Min: 1, Max: 1, minIsValid: true, maxIsValid: true},
		{Min: 1, Max: 2, minIsValid: true, maxIsValid: true},
		{Min: 2, Max: 0, minIsValid: true, maxIsValid: false},
		{Min: 2, Max: 1, minIsValid: false, maxIsValid: false},
		{Min: 2, Max: 2, minIsValid: true, maxIsValid: true},
	}

	for i, tc := range testCases {
		gotMinIsValid := minIsValid(tc.Min, tc.Max)
		require.Equal(t, tc.minIsValid, gotMinIsValid,
			"test index %d; test data: %#v", i, tc)

		gotMaxIsValid := maxIsValid(tc.Min, tc.Max)
		require.Equal(t, tc.maxIsValid, gotMaxIsValid,
			"test index %d; test data: %#v", i, tc)
	}
}

func TestClearShouldMigrate(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		// we don't need to include Max in the test, we just disable it by
		// passing zero because Max is only needed to establish the validity of
		// Min. The validity of Min wrt Max is already covered in the test for
		// minIsValid, and once Min is valid Max has no impact on the outcome of
		// clearShouldMigrate.
		CurCap, Min int
		expected    bool
	}{
		{CurCap: 0, Min: 0, expected: false},
		{CurCap: 0, Min: 9, expected: false},
		{CurCap: 0, Min: 10, expected: false},
		{CurCap: 0, Min: 11, expected: false},
		{CurCap: 10, Min: 0, expected: false},
		{CurCap: 10, Min: 9, expected: true},
		{CurCap: 10, Min: 10, expected: false},
		{CurCap: 10, Min: 11, expected: false},
	}

	for i, tc := range testCases {
		got := clearShouldMigrate(tc.CurCap, tc.Min, 0)
		require.Equal(t, tc.expected, got,
			"test index %d; test data: %#v", i, tc)
	}
}

func TestFixAllocSize(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		CurLen, Min, Max, NewCap, expected int
	}{
		// we don't need to add test cases for odd configurations of Min and Max
		// not being valid for different reasons because that is already covered
		// in the unit tests for minIsValid and maxIsValid. It suffices to
		// provide a zero for Min or Max to disable their respective behaviour

		{CurLen: 0, Min: 0, Max: 0, NewCap: 0, expected: 0},
		{CurLen: 0, Min: 0, Max: 0, NewCap: 5, expected: 5},

		{CurLen: 0, Min: 0, Max: 10, NewCap: 0, expected: 0},
		{CurLen: 0, Min: 0, Max: 10, NewCap: 9, expected: 9},
		{CurLen: 0, Min: 0, Max: 10, NewCap: 10, expected: 10},
		{CurLen: 0, Min: 0, Max: 10, NewCap: 11, expected: 10},

		{CurLen: 0, Min: 10, Max: 0, NewCap: 0, expected: 10},
		{CurLen: 0, Min: 10, Max: 0, NewCap: 5, expected: 10},
		{CurLen: 0, Min: 10, Max: 0, NewCap: 9, expected: 10},
		{CurLen: 0, Min: 10, Max: 0, NewCap: 10, expected: 10},
		{CurLen: 0, Min: 10, Max: 0, NewCap: 11, expected: 11},

		{CurLen: 0, Min: 10, Max: 10, NewCap: 0, expected: 10},
		{CurLen: 0, Min: 10, Max: 10, NewCap: 5, expected: 10},
		{CurLen: 0, Min: 10, Max: 10, NewCap: 9, expected: 10},
		{CurLen: 0, Min: 10, Max: 10, NewCap: 10, expected: 10},
		{CurLen: 0, Min: 10, Max: 10, NewCap: 11, expected: 10},

		{CurLen: 0, Min: 10, Max: 20, NewCap: 0, expected: 10},
		{CurLen: 0, Min: 10, Max: 20, NewCap: 5, expected: 10},
		{CurLen: 0, Min: 10, Max: 20, NewCap: 9, expected: 10},
		{CurLen: 0, Min: 10, Max: 20, NewCap: 10, expected: 10},
		{CurLen: 0, Min: 10, Max: 20, NewCap: 19, expected: 19},
		{CurLen: 0, Min: 10, Max: 20, NewCap: 20, expected: 20},
		{CurLen: 0, Min: 10, Max: 20, NewCap: 21, expected: 20},

		{CurLen: 5, Min: 0, Max: 0, NewCap: 0, expected: 5},
		{CurLen: 5, Min: 0, Max: 0, NewCap: 5, expected: 5},
		{CurLen: 5, Min: 0, Max: 0, NewCap: 10, expected: 10},

		{CurLen: 5, Min: 0, Max: 10, NewCap: 0, expected: 5},
		{CurLen: 5, Min: 0, Max: 10, NewCap: 5, expected: 5},
		{CurLen: 5, Min: 0, Max: 10, NewCap: 9, expected: 9},
		{CurLen: 5, Min: 0, Max: 10, NewCap: 10, expected: 10},
		{CurLen: 5, Min: 0, Max: 10, NewCap: 11, expected: 10},

		{CurLen: 5, Min: 10, Max: 0, NewCap: 0, expected: 10},
		{CurLen: 5, Min: 10, Max: 0, NewCap: 5, expected: 10},
		{CurLen: 5, Min: 10, Max: 0, NewCap: 9, expected: 10},
		{CurLen: 5, Min: 10, Max: 0, NewCap: 10, expected: 10},
		{CurLen: 5, Min: 10, Max: 0, NewCap: 11, expected: 11},

		{CurLen: 5, Min: 10, Max: 10, NewCap: 0, expected: 10},
		{CurLen: 5, Min: 10, Max: 10, NewCap: 5, expected: 10},
		{CurLen: 5, Min: 10, Max: 10, NewCap: 9, expected: 10},
		{CurLen: 5, Min: 10, Max: 10, NewCap: 10, expected: 10},
		{CurLen: 5, Min: 10, Max: 10, NewCap: 11, expected: 10},

		{CurLen: 5, Min: 10, Max: 20, NewCap: 0, expected: 10},
		{CurLen: 5, Min: 10, Max: 20, NewCap: 5, expected: 10},
		{CurLen: 5, Min: 10, Max: 20, NewCap: 9, expected: 10},
		{CurLen: 5, Min: 10, Max: 20, NewCap: 10, expected: 10},
		{CurLen: 5, Min: 10, Max: 20, NewCap: 19, expected: 19},
		{CurLen: 5, Min: 10, Max: 20, NewCap: 20, expected: 20},
		{CurLen: 5, Min: 10, Max: 20, NewCap: 21, expected: 20},
	}

	for i, tc := range testCases {
		got := fixAllocSize(tc.CurLen, tc.Min, tc.Max, tc.NewCap)
		require.Equal(t, tc.expected, got,
			"test index %d; test data %#v", i, tc)
	}
}
