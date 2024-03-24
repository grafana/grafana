package ring

// Ring is a ring buffer backed by a slice that rearranges itself to grow and
// shrink as needed. It can also be grown and shrunk manually. It is not safe
// for concurrent use, and the zero value is ready for use. Dequeued and cleared
// items are zeroed in the underlying slice to release references and allow
// garbage collection. Leaving growth and shrinkage of the internal slice apart,
// which can be directly controlled, all operations are allocation free.
type Ring[T any] struct {
	buf   []T
	stats RingStats
	back  int

	// Min sets the minimum capacity that the Ring can have, and takes effect
	// in the next write operation. The Ring will naturally tend to shrink
	// towards Min when free capacity allows it. Setting this value has no
	// immediate effect, but instead affects future writing operations. Min is
	// valid only if:
	//	0 < Min && ( Max <= 0 || Min <= Max )
	// Note that this allows setting Min but not Max, or setting both as well.
	Min int

	// Max sets the maximum capacity that the Ring can grow to store new items.
	// Setting this value has no immediate effect, but instead affects future
	// writing operations. Max is valid only if:
	//	0 < Max && Min <= Max
	// Note that this allows setting Max but not Min, or setting both as well.
	Max int
}

// RingStats provides general stats for a Ring.
type RingStats struct {
	// Len is the used capacity.
	Len int
	// Cap is the current total capacity.
	Cap int
	// Grown is the number of times a larger buffer was allocated.
	Grown uint64
	// Shrunk is the number of times a smaller buffer was allocated.
	Shrunk uint64
	// Allocs is Grown + Shrunk.
	Allocs uint64
	// Enqueued is the total number of items entered into the Ring, including
	// those which caused other items to be dropped.
	Enqueued uint64
	// Dequeued is the total number of items removed from the Ring, including
	// items removed with Dequeue and with Clear.
	Dequeued uint64
	// Dropped is the number of items lost due to the Ring being at capacity.
	Dropped uint64
}

// Len returns the used capacity.
func (rq *Ring[T]) Len() int {
	return rq.stats.Len
}

// Cap returns the current total capacity.
func (rq *Ring[T]) Cap() int {
	return len(rq.buf)
}

// WriteStats writes general stats about this Ring to the given *RingStats, if
// it's non-nil.
func (rq *Ring[T]) WriteStats(s *RingStats) {
	if s == nil {
		return
	}
	rq.stats.Cap = len(rq.buf)
	*s = rq.stats
}

// Clear removes all items from the Ring and returns the number of items
// removed. If Min is valid and Cap() > Min, it will also shrink the capacity to
// Min. Stats are not cleared, but instead Dequeued is increased by the number
// of removed items.
func (rq *Ring[T]) Clear() int {
	cleared := rq.stats.Len
	rq.stats.Dequeued += uint64(cleared)
	shouldMigrate := clearShouldMigrate(len(rq.buf), rq.Min, rq.Max)

	if rq.stats.Len > 0 && !shouldMigrate {
		// if we migrate we don't need to clear items, since moving to the new
		// slice will just have the old slice garbage collected
		chunk := min(rq.back+rq.stats.Len, len(rq.buf))
		clear(rq.buf[rq.back:chunk])
		clear(rq.buf[:rq.stats.Len-chunk])
	}
	rq.back = 0
	rq.stats.Len = 0

	if shouldMigrate {
		rq.migrate(rq.Min)
	}

	return cleared
}

// Shrink makes sure free capacity is not greater than n, shrinking if
// necessary. If a new allocation is needed then it will be capped to Min, given
// than Min is valid.
func (rq *Ring[T]) Shrink(n int) {
	if n < 0 || rq.stats.Len+n >= len(rq.buf) {
		return
	}
	rq.migrate(n)
}

// Grow makes sure free capacity is at least n, growing if necessary. If a new
// allocation is needed then it will be capped to Max, given that Max is valid.
func (rq *Ring[T]) Grow(n int) {
	if n < 1 || rq.stats.Len+n <= len(rq.buf) {
		return
	}
	rq.migrate(n)
}

func (rq *Ring[T]) migrate(newFreeCap int) {
	newCap := rq.stats.Len + newFreeCap
	newCap = fixAllocSize(rq.stats.Len, rq.Min, rq.Max, newCap)
	if newCap == len(rq.buf) {
		return
	}

	var s []T
	if newCap > 0 {
		// if newCap == 0 then just set rq.s to nil
		s = make([]T, newCap)
	}

	if len(s) > len(rq.buf) {
		rq.stats.Grown++
	} else {
		rq.stats.Shrunk++
	}

	if rq.stats.Len > 0 {
		chunk1 := min(rq.back+rq.stats.Len, len(rq.buf))
		copied := copy(s, rq.buf[rq.back:chunk1])

		if copied < rq.stats.Len {
			// wrapped the slice
			chunk2 := rq.stats.Len - copied
			copy(s[copied:], rq.buf[:chunk2])
		}
	}

	rq.back = 0
	rq.buf = s
}

// Enqueue adds the given item to the Ring, growing the capacity if needed. If
// the Ring is at capacity (0 < Max && Min <= Max && rq.Len() == rq.Cap()),
// then the new item will overwrite the oldest enqueued item.
func (rq *Ring[T]) Enqueue(v T) {
	// try to add space if we're at capacity or fix min allocation
	if rq.stats.Len == len(rq.buf) || (minIsValid(rq.Min, rq.Max) && len(rq.buf) < rq.Min) {
		newFreeCap := rq.stats.Len + 1
		newFreeCap = newFreeCap*3/2 + 1 // classic append: https://go.dev/blog/slices
		newFreeCap -= rq.stats.Len      // migrate only takes free capacity
		rq.migrate(newFreeCap)

		// if growing was capped at max, then overwrite the first item to be
		// dequeued
		if rq.stats.Len == len(rq.buf) {
			rq.stats.Dropped++
			rq.stats.Len--
			if rq.back++; rq.back >= len(rq.buf) {
				rq.back = 0 // wrap the slice
			}
		}
	}

	writePos := rq.back + rq.stats.Len
	if writePos >= len(rq.buf) {
		writePos -= len(rq.buf)
	}

	rq.buf[writePos] = v
	rq.stats.Len++
	rq.stats.Enqueued++
}

// Peek is like Dequeue, but it doesn't remove the item.
func (rq *Ring[T]) Peek() (v T) {
	if rq.stats.Len == 0 {
		return
	}

	return rq.buf[rq.back]
}

// Dequeue removes the oldest enqueued item and returns it. If the Ring is
// empty, it returns the zero value.
func (rq *Ring[T]) Dequeue() (v T) {
	if rq.stats.Len == 0 {
		return
	}

	// get the value into v, and also zero out the slice item to release
	// references so they can be gc'd
	v, rq.buf[rq.back] = rq.buf[rq.back], v
	rq.stats.Len--
	if rq.back++; rq.back >= len(rq.buf) {
		rq.back = 0 // wrap the slice
	}

	if minIsValid(rq.Min, rq.Max) && rq.stats.Len < len(rq.buf)/2+1 {
		newFreeCap := len(rq.buf)*2/3 + 1 // opposite of growing arithmetic
		newFreeCap -= rq.stats.Len        // migrate only takes free capacity
		rq.migrate(newFreeCap)
	}
	rq.stats.Dequeued++

	return v
}

// the following functions provide small checks and arithmetics that are far
// easier to test separately than creating big and more complex tests covering a
// huge amount of combinatory options. This reduces the complexity of higher
// level tests and leaves only higher level logic, but also allows us to provide
// high coverage for even the most rare edge and boundary cases by adding a new
// line to the test cases table. They're also inlineable, so no penalty in
// calling them.

func minIsValid(Min, Max int) bool {
	return 0 < Min && (Max <= 0 || Min <= Max)
}

func maxIsValid(Min, Max int) bool {
	return 0 < Max && Min <= Max
}

func clearShouldMigrate(CurCap, Min, Max int) bool {
	return minIsValid(Min, Max) && CurCap > Min
}

// fixAllocSize is a helper to determine what should be the new size to be
// allocated for a new slice, given the intended NewCap and the current relevant
// state of Ring. This is expected to be called inside (*Ring).migrate.
func fixAllocSize(CurLen, Min, Max, NewCap int) int {
	if minIsValid(Min, Max) { // Min is valid
		NewCap = max(NewCap, CurLen, Min)

	} else {
		NewCap = max(CurLen, NewCap)
	}

	if maxIsValid(Min, Max) { // Max is valid
		NewCap = min(NewCap, Max)
	}

	return NewCap
}
