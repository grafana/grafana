package debouncer

import (
	"context"
	"errors"
	"slices"
	"sync"
)

type CombineFn[T any] func(a, b T) (c T, ok bool)

// Queue is a queue of elements. Elements added to the queue can be combined together by the provided combiner function.
// Once the queue is closed, no more elements can be added, but Next() will still return remaining elements.
type Queue[T any] struct {
	combineFn CombineFn[T]

	mu       sync.Mutex
	elements []T
	closed   bool
	waitChan chan struct{} // if not nil, will be closed when new element is added
}

func NewQueue[T any](combineFn CombineFn[T]) *Queue[T] {
	return &Queue[T]{
		combineFn: combineFn,
	}
}

func (q *Queue[T]) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.elements)
}

// Elements returns copy of the queue.
func (q *Queue[T]) Elements() []T {
	q.mu.Lock()
	defer q.mu.Unlock()
	return slices.Clone(q.elements)
}

func (q *Queue[T]) Add(n T) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.closed {
		panic("queue already closed")
	}

	for i, e := range q.elements {
		if c, ok := q.combineFn(e, n); ok {
			// No need to signal, since we are not adding new element.
			q.elements[i] = c
			return
		}
	}

	q.elements = append(q.elements, n)
	q.notifyWaiters()
}

// Must be called with lock held.
func (q *Queue[T]) notifyWaiters() {
	if q.waitChan != nil {
		// Wakes up all waiting goroutines (but also possibly zero, if they stopped waiting already).
		close(q.waitChan)
		q.waitChan = nil
	}
}

var ErrClosed = errors.New("queue closed")

// Next returns the next element in the queue. If no element is available, Next will block until
// an element is added to the queue, or provided context is done.
// If the queue is closed, ErrClosed is returned.
func (q *Queue[T]) Next(ctx context.Context) (T, error) {
	var zero T

	q.mu.Lock()
	unlockInDefer := true
	defer func() {
		if unlockInDefer {
			q.mu.Unlock()
		}
	}()

	for len(q.elements) == 0 {
		if q.closed {
			return zero, ErrClosed
		}

		// Wait for an element. Make sure there's a wait channel that we can use.
		wch := q.waitChan
		if wch == nil {
			wch = make(chan struct{})
			q.waitChan = wch
		}
		// Unlock before waiting
		q.mu.Unlock()

		select {
		case <-ctx.Done():
			unlockInDefer = false
			return zero, ctx.Err()
		case <-wch:
			q.mu.Lock()
		}
	}

	first := q.elements[0]
	q.elements = q.elements[1:]
	return first, nil
}

func (q *Queue[T]) Close() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.closed = true
	q.notifyWaiters()
}
