package util

import (
	"context"
	"sync"

	"github.com/hashicorp/go-multierror"
)

// this is a decorator for a regular context that contains a custom error and returns the
type contextWithCancellableReason struct {
	context.Context
	mtx sync.Mutex
	err error
}

func (c *contextWithCancellableReason) Err() error {
	c.mtx.Lock()
	defer c.mtx.Unlock()
	if c.err != nil {
		return multierror.Append(c.Context.Err(), c.err)
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
			result.mtx.Lock()
			result.err = reason
			result.mtx.Unlock()
			cancel()
		})
	}
	return result, cancelFn
}
