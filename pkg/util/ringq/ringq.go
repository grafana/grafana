package ringq

// RingQ is a ring buffer backed by a slice that rearranges itself to grow
// dynamically, and can also be shrunk manually. It is not safe for concurrent
// use, and the zero value is ready for use. Dequeued and cleared items are
// zeroed in the underlying slice to release references and allow garbage
// collection.
type RingQ[T any] struct {
	s         []T
	back, len int

	// Max, if greater than zero, sets the maximum capacity that the queue can
	// further grow to if a new allocation is needed. Setting this value only
	// affects new calls to Grow and Enqueue.
	Max int
}

// Len returns the used capacity.
func (rq *RingQ[T]) Len() int {
	return rq.len
}

// Cap returns the total capacity of the.
func (rq *RingQ[T]) Cap() int {
	return len(rq.s)
}

// Clear removes all items from the queue and returns the number of items
// removed.
func (rq *RingQ[T]) Clear() int {
	if rq.len > 0 {
		chunk := min(rq.back+rq.len, len(rq.s))
		clear(rq.s[rq.back:chunk])
		clear(rq.s[:rq.len-chunk])
	}
	cleared := rq.len
	rq.back = 0
	rq.len = 0

	return cleared
}

// Shrink shrinks the capacity, if necessary, to guarantee space for no more
// than another n elements.
func (rq *RingQ[T]) Shrink(n int) {
	if n < 0 || rq.len+n >= len(rq.s) {
		return
	}
	rq.migrate(n)
}

// Grow increases the capacity, if necessary, to guarantee space for at least
// another n elements. If Max is positive and the current capacity is greater
// than Max then this is a nop. Otherwise, if Max is positive and a new
// allocation is needed to accommodate space for n, then n will be capped so
// that the new capacity will not be greater than Max.
func (rq *RingQ[T]) Grow(n int) {
	if n < 1 || rq.len+n <= len(rq.s) {
		return
	}
	rq.migrate(n)
}

func (rq *RingQ[T]) migrate(newFreeCap int) {
	var s []T
	total := rq.len + newFreeCap
	if total >= len(rq.s) {
		if rq.Max > 0 {
			total = min(total, rq.Max)
		}

		// if allocating would break the max or have no effect, just return
		if total <= len(rq.s) {
			return
		}
	}

	if total > 0 {
		// if total == 0 then just set rq.s to nil
		s = make([]T, total)
	}

	if len(rq.s) > 0 {
		chunk1 := min(rq.back+rq.len, len(rq.s))
		copied := copy(s, rq.s[rq.back:chunk1])

		if copied < rq.len {
			// wrapped the slice
			chunk2 := rq.len - copied
			copy(s[copied:], rq.s[:chunk2])
		}
	}

	rq.back = 0
	rq.s = s
}

// Enqueue adds the given item to the queue, growing the capacity if needed. If
// Max>0 and the queue is at capacity, then the new item will overwrite the
// oldest enqueued item.
func (rq *RingQ[T]) Enqueue(v T) {
	// try to add space if we're at capacity
	if rq.len == len(rq.s) {
		newCap := rq.len + 1
		newCap = newCap*3/2 + 1 // classic append: https://go.dev/blog/slices
		newCap -= rq.len        // rq.migrate only takes extra capacity
		rq.migrate(newCap)

		// if growing was capped at max, then overwrite the first item to be
		// dequeued
		if rq.len == len(rq.s) {
			rq.len--
			if rq.back++; rq.back >= len(rq.s) {
				rq.back = 0 // wrap the slice
			}
		}
	}

	writePos := rq.back + rq.len
	if writePos >= len(rq.s) {
		writePos -= len(rq.s)
	}

	rq.s[writePos] = v
	rq.len++
}

// Peek is like Dequeue, but it doesn't remove the item.
func (rq *RingQ[T]) Peek() (v T) {
	if rq.len == 0 {
		return
	}

	return rq.s[rq.back]
}

// Dequeue removes the oldest enqueued item and returns it. If the queue is
// empty, it returns the zero value.
func (rq *RingQ[T]) Dequeue() (v T) {
	if rq.len == 0 {
		return
	}

	// get the value into v, and also zero out the slice element to release
	// references so they can be gc'd
	v, rq.s[rq.back] = rq.s[rq.back], v
	rq.len--
	if rq.back++; rq.back >= len(rq.s) {
		rq.back = 0 // wrap the slice
	}

	return v
}
