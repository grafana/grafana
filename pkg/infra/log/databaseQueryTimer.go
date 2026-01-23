package log

import (
	"context"
	"sync/atomic"
)

type dbCallQueryTimerContextKey struct{}

var dbCallQueryTimerKey = dbCallQueryTimerContextKey{}

// InitDBQueryTimer creates a pointer on the context that can be incremented later
func InitDBQueryTimer(ctx context.Context) context.Context {
	var ptr = new(int64)
	return context.WithValue(ctx, dbCallQueryTimerKey, ptr)
}

// IncDBQueryTimer increments the database query timer on the context.
func IncDBQueryTimer(ctx context.Context, queryTimeInMs int64) context.Context {
	if val := ctx.Value(dbCallQueryTimerKey); val == nil {
		ctx = InitCounter(ctx)
	}

	if val := ctx.Value(dbCallQueryTimerKey); val != nil {
		v2, ok := val.(*int64)
		if ok {
			atomic.AddInt64(v2, queryTimeInMs)
		}
	}

	return ctx
}

// TotalDBQueryTime returns the total number of query time for this context
func TotalDBQueryTime(ctx context.Context) int64 {
	if val := ctx.Value(dbCallQueryTimerKey); val != nil {
		v2, ok := val.(*int64)
		if ok {
			return *v2
		}
	}

	return 0
}
