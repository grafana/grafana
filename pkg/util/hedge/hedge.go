// Package hedge runs at most two attempts of an operation under one caller context.
// Callers supply the deadline, validate values before returning success, and limit
// retries in underlying clients. Operations must tolerate concurrent duplicates
// and honor cancellation.
package hedge

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Policy controls when a second attempt may start. A nonpositive delay disables it.
type Policy struct {
	Delay time.Duration
}

type gateKey struct{}

// A single CAS orders SDK error handling against the timed duplicate.
type gate struct{ closed atomic.Bool }

// Suppress permanently prevents an unstarted duplicate for the enclosing Do.
// Calls outside Do and repeated calls are harmless.
func Suppress(ctx context.Context) {
	if g, ok := ctx.Value(gateKey{}).(*gate); ok {
		g.closed.Store(true)
	}
}

type result[T any] struct {
	value   T
	err     error
	attempt int
}

// Do returns the first successful value, or the attempts' errors and context cause.
// The operation must validate its value before returning nil error, tolerate
// concurrent calls, and honor each attempt context. Do cancels outstanding work
// without waiting for an operation that ignores cancellation.
func Do[T any](ctx context.Context, policy Policy, attempt func(context.Context) (T, error)) (T, error) {
	var zero T
	if err := ctx.Err(); err != nil {
		return zero, context.Cause(ctx)
	}
	g := &gate{}
	ctx, cancel := context.WithCancel(context.WithValue(ctx, gateKey{}, g))
	// Returning cancels any losing request without waiting for its response.
	defer cancel()
	span := trace.SpanFromContext(ctx)
	// A late attempt must be able to publish and exit after its peer wins or the caller cancels.
	results := make(chan result[T], 2)
	start := func(n int) {
		attemptCtx, attemptCancel := context.WithCancel(ctx)
		go func() {
			outcome := result[T]{attempt: n}
			returned := false
			defer func() {
				if recovered := recover(); recovered != nil {
					outcome.err = fmt.Errorf("hedge attempt %d panicked: %v\n%s", n, recovered, debug.Stack())
				} else if !returned {
					// Goexit runs defers without a panic; its zero value must not become a success.
					outcome.err = fmt.Errorf("hedge attempt %d exited without returning", n)
				}
				results <- outcome
				attemptCancel()
			}()
			outcome.value, outcome.err = attempt(attemptCtx)
			returned = true
		}()
	}
	start(1)
	// A nil channel disables the timer case when a duplicate cannot launch.
	var timerC <-chan time.Time
	deadline, hasDeadline := ctx.Deadline()
	if policy.Delay > 0 && (!hasDeadline || time.Until(deadline) > policy.Delay) {
		timer := time.NewTimer(policy.Delay)
		defer timer.Stop()
		timerC = timer.C
	}
	started, pending := 1, 1
	var failures []error
	deadlineCause := func() error {
		// A context may advertise a deadline before its cancellation is visible.
		// Wait for its cause, never for an outstanding attempt.
		<-ctx.Done()
		return errors.Join(append(failures, context.Cause(ctx))...)
	}
	expired := func() bool { return hasDeadline && !time.Now().Before(deadline) }
	defer func() { span.SetAttributes(attribute.Int("hedge.attempt_count", started)) }()
	for pending > 0 {
		var completed result[T]
		select {
		case <-ctx.Done():
			return zero, deadlineCause()
		case completed = <-results:
		case <-timerC:
			span.AddEvent("hedge.timer_elapsed")
			// Select does not prioritize ready cases; prefer a queued primary over a duplicate.
			select {
			case completed = <-results:
			default:
				if ctx.Err() != nil || expired() {
					return zero, deadlineCause()
				}
				timerC = nil
				if !g.closed.CompareAndSwap(false, true) {
					continue
				}
				started, pending = 2, 2
				span.AddEvent("hedge.launched")
				start(2)
				continue
			}
		}
		pending--
		// Select may receive a ready result even when cancellation is also ready.
		if ctx.Err() != nil || expired() {
			return zero, deadlineCause()
		}
		if completed.err == nil {
			span.SetAttributes(attribute.Int("hedge.winning_attempt", completed.attempt))
			if pending > 0 {
				span.AddEvent("hedge.losing_attempt_cancelled")
			}
			return completed.value, nil
		}
		failures = append(failures, fmt.Errorf("attempt %d: %w", completed.attempt, completed.err))
		span.AddEvent("hedge.attempt_failed", trace.WithAttributes(attribute.Int("attempt", completed.attempt)))
		if started == 1 {
			return zero, failures[0]
		}
	}
	return zero, errors.Join(failures...)
}
