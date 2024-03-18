package ringq

import (
	"context"
	"errors"
)

// Package level named errors.
var (
	ErrDynChanClosed = errors.New("closed DynChan")
)

// DynChan is the same as DynChanMax(minBufLen, -1).
func DynChan[T any](minBufLen int) (chan<- T, <-chan T, ChanStatsReader) {
	return DynChanMax[T](minBufLen, -1)
}

// DynChanMax provides a simple queueing system based on a send-only, a
// receive-only, and an internal ring buffer queue, which has dynamic capcity.
// It also provides a ChanStatsReader to allow querying basic stats. The
// internal ring buffer is initially empty, and its capacity grows as more items
// need to be stored if the receiving side is lagging behind. When the receiving
// side catches up, the buffer will shrink to reclaim unused memory. The
// argument minBufLen must be positive, and allows customizing the minimum
// allocation for the internal buffer. This is useful to reduce the overhead of
// resizing the buffer within an acceptable, permanent allocation of minBufLen
// items ready to be used. If maxBufLen is positive, then it must be greater
// than minBufLen, and will be used to prevent buffering more than that number
// of items. If more items are received and the buffer already has maxBufLen,
// then the oldest item (the one that receiving would first get) will be
// overwritten with the new value.
func DynChanMax[T any](minBufLen, maxBufLen int) (chan<- T, <-chan T, ChanStatsReader) {
	if minBufLen < 1 || (maxBufLen > 0 && maxBufLen < minBufLen) {
		panic("maxBufLen > 0 && maxBufLen < minBufLen")
	}

	var stats ChanStats
	in := make(chan T)
	out := make(chan T)
	statsChan := make(chan ChanStats)
	sr := ChanStatsReader{
		c: statsChan,
	}
	if maxBufLen > 0 {
		stats.MaxCap = maxBufLen
	}

	go func() {
		defer close(out)
		defer close(statsChan)

		var q RingQ[T]
		q.Max = maxBufLen

		// the loop condition is that we either have items to dequeue
		// (q.Len()>0) or that we have the possibility to receive new items to
		// be queued (in != nil)
		for stats.Len > 0 || in != nil {
			// if we don't have anything in the queue, then make the dequeueing
			// branch of the select block indefinitely by providing a nil
			// channel, leaving only the queueing branch available
			dequeueChan := out
			if stats.Len == 0 {
				dequeueChan = nil
			}

			select {
			case v, ok := <-in: // blocks until something is queued
				if !ok {
					// in was closed, so if we leave it like that the next
					// iteration will keep receiving zero values with ok=false
					// without any blocking. So we set in to nil, so that
					// the next iteration the select will block indefinitely on
					// this branch of the select and leave only the dequeing
					// branch active until all items have been dequeued
					in = nil
				} else {
					if stats.Cap == 0 {
						// initialize to the target buffer length
						q.Grow(minBufLen)
						stats.Cap = q.Cap()
						stats.Allocs++
					}

					q.Enqueue(v)
					stats.Enqueued++

					l := q.Len()
					if l == stats.Len {
						// if after enqueueing the length remains the same, it
						// means we overwrote an item because we overflowed the
						// the queue
						stats.Dropped++
					}
					stats.Len = l

					if c := q.Cap(); stats.Cap != c {
						stats.Cap = c
						stats.Allocs++
					}
				}

			case dequeueChan <- q.Peek(): // blocks if nothing to dequeue
				// we don't want to call Dequeue in the `case` above since that
				// would consume the item and it would be lost if the queueing
				// branch was selected, so instead we Peek in the `case` and we
				// do the actual dequeueing here once we know this branch was
				// selected
				q.Dequeue()
				stats.Dequeued++
				stats.Len = q.Len()

				// recover from spiky behaviour by shrinking the ring queue back
				// to its intended length, only if we know that we have
				// allocated beyond the minBufLen threshold and we are
				// currently using less than half minBufLen, so it's safe to
				// shrink
				if stats.Cap > minBufLen && stats.Len < minBufLen/2 {
					q.Shrink(minBufLen - stats.Len)
					if c := q.Cap(); stats.Cap != c {
						stats.Cap = c
						stats.Allocs++
					}
				}

			case statsChan <- stats:
				// just someone reading stats
				stats.StatsRead++
			}
		}
	}()

	return in, out, sr
}

// ChanStats is a snapshot of general stats for a DynChan.
type ChanStats struct {
	// Len is the number of queued items.
	Len int
	// Cap is the current total capacity to queue items without a new
	// allocation.
	Cap int
	// Allocs returns the number of times a new buffer was allocated to
	// accommodate for either growing or shrinking.
	Allocs uint64
	// MaxCap is the maximum queue capacity, if maxBufLen was positive. It is
	// zero otherwise, and can be disregarded.
	MaxCap int
	// Enqueued is the total number of items entered into the queue.
	Enqueued uint64
	// Dequeued is the total number of items removed from the queue.
	Dequeued uint64
	// Dropped is the number of items lost due to a filled queue.
	Dropped uint64
	// StatsRead is the total number of stats read before this snapshot. If it
	// is zero, it means this snapshot is the first reading.
	StatsRead uint64
}

// ChanStatsReader provides stats about a DynChan.
type ChanStatsReader struct {
	c <-chan ChanStats
}

// ReadStats returns a snapshot of ChanStats of the origin DynChan.
func (r ChanStatsReader) ReadStats(ctx context.Context) (ChanStats, error) {
	select {
	case s, ok := <-r.c:
		if !ok {
			return ChanStats{}, ErrDynChanClosed
		}
		return s, nil

	case <-ctx.Done():
		return ChanStats{}, ctx.Err()
	}
}
