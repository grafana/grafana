package log

import (
	"context"
	"sync/atomic"
)

type contextKey struct{}

var dbCallCounterNameKey = contextKey{}

func InitCounter(ctx context.Context) context.Context {
	var ptr *int64 = new(int64)
	return context.WithValue(ctx, dbCallCounterNameKey, ptr)
}

func IncDBCallCounter(ctx context.Context) context.Context {
	if val := ctx.Value(dbCallCounterNameKey); val == nil {
		var ptr *int64 = new(int64)
		ctx = context.WithValue(ctx, dbCallCounterNameKey, ptr)
	}

	if val := ctx.Value(dbCallCounterNameKey); val != nil {
		v2, ok := val.(*int64)
		if ok {
			atomic.AddInt64(v2, 1)
		}
	}

	return ctx
}

func TotalDBCallCount(ctx context.Context) int64 {
	if val := ctx.Value(dbCallCounterNameKey); val != nil {
		v2, ok := val.(*int64)
		if ok {
			return *v2
		}
	}

	return 0
}
