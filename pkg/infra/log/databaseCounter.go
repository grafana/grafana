package log

import (
	"context"
	"sync/atomic"
)

type contextKey struct{}

var dbCallCounterNameKey = contextKey{}

// InitCounter creates a pointer on the context that can be incremented later
func InitCounter(ctx context.Context) context.Context {
	var ptr = new(int64)
	return context.WithValue(ctx, dbCallCounterNameKey, ptr)
}

// IncDBCallCounter increments the database counter on the context.
func IncDBCallCounter(ctx context.Context) context.Context {
	if val := ctx.Value(dbCallCounterNameKey); val == nil {
		ctx = InitCounter(ctx)
	}

	if val := ctx.Value(dbCallCounterNameKey); val != nil {
		v2, ok := val.(*int64)
		if ok {
			atomic.AddInt64(v2, 1)
		}
	}

	return ctx
}

// TotalDBCallCount returns the total number of requests for the context
func TotalDBCallCount(ctx context.Context) int64 {
	if val := ctx.Value(dbCallCounterNameKey); val != nil {
		v2, ok := val.(*int64)
		if ok {
			return *v2
		}
	}

	return 0
}
