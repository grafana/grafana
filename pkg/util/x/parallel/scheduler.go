package parallel

import (
	"context"

	"github.com/grafana/grafana/pkg/util/errutil"
)

// Scheduler provides an advanced runtime for [Future].
//
// A Scheduler will one call to [Scheduler.Schedule] per Future and will
// eventually run the provided future.
type Scheduler[T any] interface {
	// Schedule accepts a [Future] and return nil if it has been
	// scheduled to run or an error if it is unable to schedule the
	// Future.
	Schedule(*Future[T]) error
}

// BlockingScheduler implements [Scheduler].
type BlockingScheduler[T any] struct {
	sem chan struct{}
}

// NewBlockingScheduler creates a [BlockingScheduler] with a provided
// concurrencyLimit. If the concurrency limit is 0, any number of
// [Future]:s can be run simultaneously, otherwise the scheduler will
// allow up to concurrencyLimit simultaneous Futures.
func NewBlockingScheduler[T any](concurrencyLimit int64) *BlockingScheduler[T] {
	var sem chan struct{}
	if concurrencyLimit != 0 {
		sem = make(chan struct{}, concurrencyLimit)
	}

	return &BlockingScheduler[T]{
		sem: sem,
	}
}

// Schedule starts the provided [Future]. If the [BlockingScheduler] has
// a concurrency limit, this will block when that number of
// Futures are simultaneously running until one or more Future has
// completed.
//
// [*BlockingScheduler.Schedule] always return nil.
func (r *BlockingScheduler[T]) Schedule(f *Future[T]) error {
	if r.sem != nil {
		r.sem <- struct{}{}
		oldFinishFn := f.finishFn
		f.finishFn = func() {
			if oldFinishFn != nil {
				oldFinishFn()
			}

			<-r.sem
		}
	}

	f.Start()
	return nil
}

var ErrSchedulerStopped = errutil.NewBase(errutil.StatusInternal, "parallel.schedulerStopped")

// QueueScheduler provides a queued [Scheduler].
//
// This allows a number of [Future] jobs to be scheduled to run "in the
// future" without blocking on [*QueueScheduler.Schedule].
type QueueScheduler[T any] struct {
	queue             chan *Future[T]
	stopped           bool
	blockingScheduler *BlockingScheduler[T]
}

// NewQueueScheduler creates and starts a [QueueScheduler].
//
// The QueueScheduler will run in the background moving [Future] jobs
// from a queue with at most queueSize jobs onto a [BlockingScheduler]
// with its concurrencyLimit set to the provided concurrencyLimit.
//
// The QueueScheduler will terminate when the [context.Context.Done]
// channel is closed and will not accept the scheduling of any new
// [Future] jobs.
// Jobs already scheduled will be finished before the scheduler
// terminates.
func NewQueueScheduler[T any](ctx context.Context, concurrencyLimit int64, queueSize int64) *QueueScheduler[T] {
	qs := &QueueScheduler[T]{
		queue:             make(chan *Future[T], queueSize),
		blockingScheduler: NewBlockingScheduler[T](concurrencyLimit),
	}

	qs.run(ctx)

	return qs
}

// Schedule adds a [Future] to the queue. Returns an error based on
// [ErrSchedulerStopped] if the [QueueScheduler] has been stopped.
func (q *QueueScheduler[T]) Schedule(f *Future[T]) error {
	if q.stopped {
		return ErrSchedulerStopped.Errorf("%T has been stopped", q)
	}

	q.queue <- f
	return nil
}

func (q *QueueScheduler[T]) run(ctx context.Context) {
	go func() {
		for {
			select {
			case f := <-q.queue:
				// the blocking scheduler cannot fail.
				_ = q.blockingScheduler.Schedule(f)
			case <-ctx.Done():
				q.stopped = true
				if len(q.queue) == 0 {
					return
				}
			}
		}
	}()
}
