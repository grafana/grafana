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
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Policy controls when a second attempt may start. A nonpositive delay disables it.
// IsRetryable enables an immediate second attempt after a classified first failure.
// A nil IsRetryable disables immediate retry but still permits a timed hedge.
type Policy struct {
	Delay       time.Duration
	IsRetryable func(error) bool
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
	ctx, cancel := context.WithCancel(ctx)
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
				if ctx.Err() != nil {
					return zero, deadlineCause()
				}
				if expired() {
					return zero, deadlineCause()
				}
				started, pending = 2, 2
				span.AddEvent("hedge.launched")
				start(2)
				continue
			}
		}
		pending--
		// Select may receive a ready result even when cancellation is also ready.
		if err := ctx.Err(); err != nil {
			return zero, deadlineCause()
		}
		if expired() {
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
			if policy.Delay > 0 && policy.IsRetryable != nil && policy.IsRetryable(completed.err) && ctx.Err() == nil && !expired() {
				// A fast transient error consumes the final attempt immediately.
				timerC = nil
				started, pending = 2, 1
				span.AddEvent("hedge.retry_launched")
				start(2)
				continue
			}
			return zero, failures[0]
		}
	}
	return zero, errors.Join(failures...)
}
