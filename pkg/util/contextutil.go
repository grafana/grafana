package util

import (
	"context"
	"sync"
)

// this is a decorator for a regular context that contains a custom error and returns the
type contextWithCancellableReason struct {
	context.Context
	err error
}

func (c *contextWithCancellableReason) Err() error {
	if c.err != nil {
		return c.err
	}
	return c.Context.Err()
}

type CancelCauseFunc func(error)

// WithCancelCause creates a cancellable context that can be cancelled with a custom reason
func WithCancelCause(parent context.Context) (context.Context, CancelCauseFunc) {
	ctx, cancel := context.WithCancel(parent)
	errOnce := sync.Once{}
	result := &contextWithCancellableReason{
		Context: ctx,
	}
	cancelFn := func(reason error) {
		errOnce.Do(func() {
			result.err = reason
			cancel()
		})
	}
	return result, cancelFn
}
