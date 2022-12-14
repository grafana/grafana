package parallel

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrGroupCollected = errutil.NewBase(errutil.StatusInternal, "parallel.groupCollected")
var ErrNotResolved = errutil.NewBase(errutil.StatusInternal, "parallel.notResolved")

// A Group is a batch of [Future].
//
// While a slice is useful, the Group struct is able to provide
// functionality that makes it easier to work with several workers
// creating the same kind of resource or an error.
//
// All [Future] jobs in a Group are initialized with the same
// [FutureOpts] and [context.Context].
//
// [GroupOpts] contain optional settings to modify the Group runtime.
type Group[T any] struct {
	futures    []*Future[T]
	ctx        context.Context
	cancelFunc context.CancelFunc
	opts       GroupOpts[T]
	lock       sync.Mutex
	collected  bool
	wg         *sync.WaitGroup
}

// GroupOpts contain optional settings to modify the [Group] runtime.
type GroupOpts[T any] struct {
	// FutureOptions contains the [FutureOpts] that will be passed to
	// every [Future] created by [Group.Go].
	FutureOptions FutureOpts
	// Scheduler overrides the [Scheduler] used to start Go routines.
	// The default is a [BlockingScheduler] with no cap for the amount
	// of simultaneous jobs.
	Scheduler Scheduler[T]
}

// NewGroup initializes a new [Group].
func NewGroup[T any](ctx context.Context, opts GroupOpts[T]) *Group[T] {
	ctx, cancel := context.WithCancel(ctx)

	if opts.Scheduler == nil {
		opts.Scheduler = NewBlockingScheduler[T](0)
	}

	return &Group[T]{
		ctx:        ctx,
		cancelFunc: cancel,
		opts:       opts,
		wg:         &sync.WaitGroup{},
	}
}

// Go sends the provided function to the scheduler and wraps it in a
// future that will eventually be resolved.
//
// Go will return an error if [Group.Get] or [Group.Wait] has already
// been called.
func (g *Group[T]) Go(name string, fn func(context.Context) (T, error)) error {
	g.lock.Lock()
	defer g.lock.Unlock()
	if g.collected {
		return ErrGroupCollected.Errorf("The future group has already been collected, cannot add more futures to it")
	}

	future := NewFuture(g.ctx, name, fn, g.opts.FutureOptions)
	g.wg.Add(1)
	future.finishFn = func() {
		g.wg.Done()
	}

	g.futures = append(g.futures, future)
	return g.opts.Scheduler.Schedule(future)
}

// Cancel sends a cancel signal to all Go routines created by the
// [Group].
func (g *Group[T]) Cancel() {
	g.cancelFunc()
}

// Get returns the underlying slice of [Future] spawned by the [Group].
//
// New jobs cannot be scheduled after a call to Get. Ordered after when
// [Group.Go] was called.
func (g *Group[T]) Get() []*Future[T] {
	g.lock.Lock()
	defer g.lock.Unlock()
	g.collected = true

	return g.futures
}

// Wait waits until all [Future] jobs have been resolved before
// returning.
//
// New jobs cannot be scheduled after a call to Wait.
// Errors are not expected in normal operations and indicative of a
// critical error. Ordered after when [Group.Go] was called.
func (g *Group[T]) Wait() ([]Result[T], error) {
	g.lock.Lock()
	g.collected = true
	g.lock.Unlock()

	g.wg.Wait()
	g.lock.Lock()
	defer g.lock.Unlock()

	results := make([]Result[T], 0, len(g.futures))
	for _, future := range g.futures {
		result, ok := future.Get()
		if !ok {
			return nil, ErrNotResolved.Errorf("")
		}
		results = append(results, result)
	}
	return results, nil
}
