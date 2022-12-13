package parallel

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"
)

// TestBlockingScheduler_concurrencyOne creates a very race-condition
// prone test that is _almost_ guaranteed to fail if more than one
// future runs simultaneously.
func TestBlockingScheduler_concurrencyOne(t *testing.T) {
	bs := NewBlockingScheduler[int](1)
	var n int
	var futures []*Future[int]
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	t.Cleanup(cancel)

	const target = 32
	for i := 0; i < target; i++ {
		future := NewFuture(ctx, func(ctx context.Context) (int, error) {
			old := n
			time.Sleep(time.Millisecond)
			n = old + 1
			return n, nil
		}, FutureOpts{})
		futures = append(futures, future)
		err := bs.Schedule(future)
		require.NoError(t, err)
	}

	for _, future := range futures {
		res := future.Wait(ctx)
		require.NoError(t, res.Error)
	}
	assert.Equal(t, target, n)
}

// TestBlockingScheduler_waiting asserts that the blocking scheduler can
// run several futures in parallel. This is done by a rendezvous
// WaitGroup where every [Future] both reduces the semaphore by one and
// waits until it reaches zero. This can only happen if there are enough
// concurrent futures.
func TestBlockingScheduler_waiting(t *testing.T) {
	const target = 16

	bs := NewBlockingScheduler[int](target)
	wg := &sync.WaitGroup{}
	wg.Add(target)
	for i := 0; i < target; i++ {
		future := NewFuture(context.Background(), func(ctx context.Context) (int, error) {
			wg.Done()
			return 0, nil
		}, FutureOpts{})
		err := bs.Schedule(future)
		require.NoError(t, err)
	}

	wg.Wait()
}

// TestQueueScheduler fills up the queue and then finishes.
func TestQueueScheduler(t *testing.T) {
	const target = 16
	var futures []*Future[int]
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	t.Cleanup(cancel)

	var eoq bool
	sched := NewQueueScheduler[int](ctx, 4, target)
	for !eoq {
		future := NewFuture(context.Background(), func(ctx context.Context) (int, error) {
			for !eoq {
				if len(sched.queue) == cap(sched.queue) {
					eoq = true
				}
				time.Sleep(time.Microsecond)
			}
			return 0, nil
		}, FutureOpts{})
		futures = append(futures, future)
		err := sched.Schedule(future)
		require.NoError(t, err)
	}

	for _, future := range futures {
		res := future.Wait(ctx)
		require.NoError(t, res.Error)
	}
}
