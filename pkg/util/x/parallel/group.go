package parallel

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/util/errutil"
)

// FIXME: Test and document Group.

var ErrGroupCollected = errutil.NewBase(errutil.StatusInternal, "parallel.groupCollected")
var ErrNotResolved = errutil.NewBase(errutil.StatusInternal, "parallel.notResolved")

type Group[T any] struct {
	futures    []*Future[T]
	ctx        context.Context
	cancelFunc context.CancelFunc
	opts       GroupOpts[T]
	lock       sync.Mutex
	collected  bool
	wg         *sync.WaitGroup
}

type GroupOpts[T any] struct {
	FutureOptions FutureOpts
	Scheduler     Scheduler[T]
}

func NewGroup[T any](ctx context.Context, opts GroupOpts[T]) *Group[T] {
	ctx, cancel := context.WithCancel(ctx)

	if opts.Scheduler == nil {
		opts.Scheduler = NewBlockingScheduler[T](0)
	}

	return &Group[T]{
		ctx:        ctx,
		cancelFunc: cancel,
		opts:       opts,
	}
}

func (g *Group[T]) Go(fn func(context.Context) (T, error)) error {
	g.lock.Lock()
	defer g.lock.Unlock()
	if g.collected {
		return ErrGroupCollected.Errorf("The future group has already been collected, cannot add more futures to it")
	}

	future := NewFuture(g.ctx, fn, g.opts.FutureOptions)
	g.wg.Add(1)
	future.finishFn = func() {
		g.wg.Done()
	}

	g.futures = append(g.futures, future)
	return g.opts.Scheduler.Schedule(future)
}

func (g *Group[T]) Cancel() {
	g.cancelFunc()
}

func (g *Group[T]) Get() []*Future[T] {
	g.lock.Lock()
	defer g.lock.Unlock()
	g.collected = true

	return g.futures
}

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
