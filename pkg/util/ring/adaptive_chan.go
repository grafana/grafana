package ring

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
)

// Package level named errors.
var (
	ErrAdaptiveChanClosed           = errors.New("closed AdaptiveChan")
	ErrAdaptiveChanControllerClosed = errors.New("closed AdaptiveChanController")
)

// AdaptiveChan provides a queueing system based on a send-only, a receive-only,
// and an internal ring buffer queue backed by a *Ring. It also provides an
// AdaptiveChanController to provide stats and some control on the internal
// *Ring. Termination is controlled by closing the returned send-only channel.
// After doing so, the receive-only channel will have the chance to receive all
// the items still in the queue and will be immediately closed afterwards. Once
// both channels are closed, the AdaptiveChanController will no longer be usable
// and will only return ErrAdaptiveChanClosed for all its methods. Leaving the
// growth and shrinkage of the internal *Ring apart, which can be controlled
// with the AdaptiveChanController, the implementation is allocation free.
//
// The implementation explicitly returns two channels and a struct, instead of
// just one struct that has the channels, to make a clear statement about the
// intended usage pattern:
//
//  1. Create an adaptive channel.
//  2. Provide the send-only channel to your producer(s). They are responsible
//     for closing this channel when they're done. If more than one goroutine
//     will have access to this channel, then it's the producer's responsibility
//     to coordinate the channel close operation.
//  3. Provide the receive-only channel to your consumer(s), and let them
//     receive from it with the two return value syntax for channels in order to
//     check for termination from the sending side.
//  4. Use the AdaptiveChanController to control the internal buffer behaviour
//     and to monitor stats. This should typically be held by the creator of the
//     adaptive channel. Refrain from holding a reference to the send-only
//     channel to force termination of the producing side. Instead, provide a
//     side mechanism to communicate the intention of terminating the sending
//     side, e.g. providing your producer(s) with a context as well as the
//     send-only channel. An adaptive channel is meant as a queueing system, not
//     as a coordination mechanism for producer(s), consumer(s) and
//     controller(s).
//
// This pattern is designed to maximize decoupling while providing insights and
// granular control on memory usage. While the controller is not meant to make
// any direct changes to the queued data, the Clear method provides the
// opportunity to discard all queued items as an administrative measure. This
// doesn't terminate the queue, though, i.e. it doesn't close the send-only
// channel.
func AdaptiveChan[T any]() (send chan<- T, recv <-chan T, ctrl *AdaptiveChanController) {
	internalSend := make(chan T)
	internalRecv := make(chan T)
	statsChan := make(chan AdaptiveChanStats)
	cmdChan := make(chan acCmd)
	ctrl = &AdaptiveChanController{
		statsChan: statsChan,
		cmdChan:   cmdChan,
	}

	go func() {
		defer close(internalRecv)
		defer close(statsChan)

		var q Ring[T]
		var stats AdaptiveChanStats

		// the loop condition is that we either have items to dequeue or that we
		// have the possibility to receive new items to be queued
		for stats.Len > 0 || internalSend != nil {
			// NOTE: the overhead of writing stats in each iteration is
			// negligible. I tried a two phase stats writing with a chan
			// struct{} to get notified that the controller wanted stats, then
			// updating the stats and finally writing to statsChan. There was no
			// observable difference for just enqueueing and dequeueing after
			// running the benchmarks several times, and reading stats got worse
			// by ~22%
			q.WriteStats(&stats.RingStats)

			// if we don't have anything in the queue, then make the dequeueing
			// branch of the select block indefinitely by providing a nil
			// channel, leaving only the queueing branch available
			dequeueChan := internalRecv
			if stats.Len == 0 {
				dequeueChan = nil
			}

			select {
			case v, ok := <-internalSend: // blocks until something is queued
				if !ok {
					// in was closed, so if we leave it like that the next
					// iteration will keep receiving zero values with ok=false
					// without any blocking. So we set in to nil, so that
					// the next iteration the select will block indefinitely on
					// this branch of the select and leave only the dequeing
					// branch active until all items have been dequeued
					internalSend = nil
				} else {
					q.Enqueue(v)
				}

			case dequeueChan <- q.Peek(): // blocks if nothing to dequeue
				// we don't want to call Dequeue in the `case` above since that
				// would consume the item and it would be lost if the queueing
				// branch was selected, so instead we Peek in the `case` and we
				// do the actual dequeueing here once we know this branch was
				// selected
				q.Dequeue()

			case statsChan <- stats:
				// stats reading
				stats.StatsRead++

			case cmd, ok := <-cmdChan:
				if !ok {
					// AdaptiveChanController was closed. Set cmdChan to nil so
					// this branch blocks in the next iteration
					cmdChan = nil
					continue
				}

				// execute a command on the internal *Ring
				switch cmd.acCmdType {
				case acCmdMin:
					q.Min = cmd.intValue
					stats.Min = cmd.intValue
				case acCmdMax:
					q.Max = cmd.intValue
					stats.Max = cmd.intValue
				case acCmdGrow:
					q.Grow(cmd.intValue)
				case acCmdShrink:
					q.Shrink(cmd.intValue)
				case acCmdClear:
					q.Clear()
				}
			}
		}
	}()

	return internalSend, internalRecv, ctrl
}

type acCmdType uint8

const (
	acCmdMin = iota
	acCmdMax
	acCmdClear
	acCmdGrow
	acCmdShrink
)

type acCmd struct {
	acCmdType
	intValue int
}

// AdaptiveChanController provides access to an AdaptiveChan's internal *Ring.
type AdaptiveChanController struct {
	statsChan <-chan AdaptiveChanStats
	cmdChan   chan<- acCmd
	cmdChanMu sync.Mutex
	closed    uint32
}

// Close releases resources associated with this controller. After calling this
// method, all other methods will return ErrAdaptiveChanControllerClosed. It is
// idempotent. This doesn't affect the queue itself, but rather prevents further
// administrative tasks to be performed through the AdaptiveChanController.
func (r *AdaptiveChanController) Close() {
	r.cmdChanMu.Lock()
	defer r.cmdChanMu.Unlock()

	if r.cmdChan != nil {
		close(r.cmdChan)
		r.cmdChan = nil
		atomic.StoreUint32(&r.closed, 1)
	}
}

func (r *AdaptiveChanController) isClosed() bool {
	return atomic.LoadUint32(&r.closed) != 0
}

// Min sets the value of Min in the internal *Ring.
func (r *AdaptiveChanController) Min(ctx context.Context, n int) error {
	if r.isClosed() {
		return ErrAdaptiveChanControllerClosed
	}

	r.cmdChanMu.Lock()
	defer r.cmdChanMu.Unlock()

	return sendOrErr(ctx, r.cmdChan, acCmd{
		acCmdType: acCmdMin,
		intValue:  n,
	})
}

// Max sets the value of Max in the internal *Ring.
func (r *AdaptiveChanController) Max(ctx context.Context, n int) error {
	if r.isClosed() {
		return ErrAdaptiveChanControllerClosed
	}

	r.cmdChanMu.Lock()
	defer r.cmdChanMu.Unlock()

	return sendOrErr(ctx, r.cmdChan, acCmd{
		acCmdType: acCmdMax,
		intValue:  n,
	})
}

// Grow calls Grow on the internal *Ring.
func (r *AdaptiveChanController) Grow(ctx context.Context, n int) error {
	if r.isClosed() {
		return ErrAdaptiveChanControllerClosed
	}

	r.cmdChanMu.Lock()
	defer r.cmdChanMu.Unlock()

	return sendOrErr(ctx, r.cmdChan, acCmd{
		acCmdType: acCmdGrow,
		intValue:  n,
	})
}

// Shrink calls Shrink on the internal *Ring.
func (r *AdaptiveChanController) Shrink(ctx context.Context, n int) error {
	if r.isClosed() {
		return ErrAdaptiveChanControllerClosed
	}

	r.cmdChanMu.Lock()
	defer r.cmdChanMu.Unlock()

	return sendOrErr(ctx, r.cmdChan, acCmd{
		acCmdType: acCmdShrink,
		intValue:  n,
	})
}

// Clear calls Clear on the internal *Ring.
func (r *AdaptiveChanController) Clear(ctx context.Context) error {
	if r.isClosed() {
		return ErrAdaptiveChanControllerClosed
	}

	r.cmdChanMu.Lock()
	defer r.cmdChanMu.Unlock()

	return sendOrErr(ctx, r.cmdChan, acCmd{
		acCmdType: acCmdClear,
	})
}

// WriteStats writes a snapshot of general stats about the associated
// AdaptiveChan to the given *AdaptiveChanStats.
func (r *AdaptiveChanController) WriteStats(ctx context.Context, s *AdaptiveChanStats) error {
	if r.isClosed() {
		return ErrAdaptiveChanControllerClosed
	}

	return recvOrErr(ctx, r.statsChan, s)
}

// AdaptiveChanStats is a snapshot of general stats for an AdaptiveChan.
type AdaptiveChanStats struct {
	RingStats
	// Min is the value of Min in the internal *Ring.
	Min int
	// Max value of Max in the internal *Ring.
	Max int
	// StatsRead is the total number of stats read before this snapshot. If it
	// is zero, it means this snapshot is the first reading.
	StatsRead uint64
}

func sendOrErr[T any](ctx context.Context, c chan<- T, v T) error {
	if c == nil {
		return ErrAdaptiveChanControllerClosed
	}

	select {
	case c <- v:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func recvOrErr[T any](ctx context.Context, c <-chan T, tptr *T) error {
	select {
	case t, ok := <-c:
		if !ok {
			return ErrAdaptiveChanClosed
		}
		*tptr = t
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
