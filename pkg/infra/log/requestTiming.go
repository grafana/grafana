package log

import (
	"context"
	"time"
)

type requestStartTimeContextKey struct{}

var requestStartTime = requestStartTimeContextKey{}

// InitCounter creates a pointer on the context that can be incremented later
func InitstartTime(ctx context.Context, now time.Time) context.Context {
	return context.WithValue(ctx, requestStartTime, now)
}

// TimeSinceStart returns time spend since the request started in grafana
func TimeSinceStart(ctx context.Context, now time.Time) time.Duration {
	val := ctx.Value(requestStartTime)
	if val != nil {
		startTime, ok := val.(time.Time)
		if ok {
			return now.Sub(startTime)
		}
	}

	return 0
}
