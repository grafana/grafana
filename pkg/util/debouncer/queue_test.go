package debouncer

import (
	"context"
	"errors"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/atomic"
	"go.uber.org/goleak"
)

// This verifies that all goroutines spawned from tests are finished at the end of tests.
// Applies to all tests in the package.
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}

func TestQueueBasic(t *testing.T) {
	q := NewQueue(func(a, b int) (c int, ok bool) {
		return a + b, true
	})

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()
	// Empty queue will time out.
	require.Equal(t, context.DeadlineExceeded, nextErr(t, q, ctx))

	q.Add(10)
	require.Equal(t, 10, next(t, q))
	require.Equal(t, 0, q.Len())

	q.Add(20)
	require.Equal(t, 20, next(t, q))
	require.Equal(t, 0, q.Len())

	q.Add(10)
	require.Equal(t, 1, q.Len())
	q.Add(20)
	require.Equal(t, 1, q.Len())
	require.Equal(t, 30, next(t, q))
	require.Equal(t, 0, q.Len())

	q.Add(100)
	require.Equal(t, 1, q.Len())
	q.Close()
	require.Equal(t, 1, q.Len())
	require.Equal(t, 100, next(t, q))
	require.Equal(t, ErrClosed, nextErr(t, q, context.Background()))
	require.Equal(t, 0, q.Len())

	// We can call Next repeatedly, but will always get error.
	require.Equal(t, ErrClosed, nextErr(t, q, context.Background()))
}

func TestQueueConcurrency(t *testing.T) {
	q := NewQueue(func(a, b int64) (c int64, ok bool) {
		// Combine the same numbers together.
		if a == b {
			return a + b, true
		}
		return 0, false
	})

	const numbers = 10000
	const writeConcurrency = 50
	const readConcurrency = 25

	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	totalWrittenSum := atomic.NewInt64(0)
	totalReadSum := atomic.NewInt64(0)
	addCalls := atomic.NewInt64(0)
	nextCalls := atomic.NewInt64(0)

	// We will add some numbers to the queue.
	writesWG := sync.WaitGroup{}
	for i := 0; i < writeConcurrency; i++ {
		writesWG.Add(1)
		go func() {
			defer writesWG.Done()
			for j := 0; j < numbers; j++ {
				v := r.Int63n(100) // Generate small number, so that we have a chance for combining some numbers.
				q.Add(v)
				addCalls.Inc()
				totalWrittenSum.Add(v)
			}
		}()
	}

	readsWG := sync.WaitGroup{}
	for i := 0; i < readConcurrency; i++ {
		readsWG.Add(1)
		go func() {
			defer readsWG.Done()

			for {
				v, err := q.Next(context.Background())
				if errors.Is(err, ErrClosed) {
					return
				}
				require.NoError(t, err)

				nextCalls.Inc()
				totalReadSum.Add(v)
			}
		}()
	}

	writesWG.Wait()
	// Close queue after sending all numbers. This signals readers that they can stop.
	q.Close()

	// Wait until all readers finish too.
	readsWG.Wait()

	// Verify that all numbers were sent, combined and received.
	require.Equal(t, int64(writeConcurrency*numbers), addCalls.Load())
	require.Equal(t, totalWrittenSum.Load(), totalReadSum.Load())
	require.LessOrEqual(t, nextCalls.Load(), addCalls.Load())
	t.Log("add calls:", addCalls.Load(), "next calls:", nextCalls.Load(), "total written sum:", totalWrittenSum.Load(), "total read sum:", totalReadSum.Load())
}

func TestQueueCloseUnblocksReaders(t *testing.T) {
	q := NewQueue(func(a, b int) (c int, ok bool) {
		return a + b, true
	})

	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		time.Sleep(50 * time.Millisecond)
		q.Close()
	}()

	_, err := q.Next(context.Background())
	require.ErrorIs(t, err, ErrClosed)

	wg.Wait()
}

func next[T any](t *testing.T, q *Queue[T]) T {
	v, err := q.Next(context.Background())
	require.NoError(t, err)
	return v
}
func nextErr[T any](t *testing.T, q *Queue[T], ctx context.Context) error {
	_, err := q.Next(ctx)
	require.Error(t, err)
	return err
}
