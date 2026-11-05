package rerank

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const hedgeDelay = 500 * time.Millisecond

type scoreResult struct {
	scores  []float64
	err     error
	attempt int
}

// HedgeScores starts one duplicate scoring attempt if the first is still pending
// after 500 ms. The first valid success wins; an early primary error returns
// immediately. Both attempts share the caller's deadline. Each attempt must
// build its own request and honor its context.
func HedgeScores(ctx context.Context, count int, attempt func(context.Context) ([]float64, error)) ([]float64, error) {
	if err := ctx.Err(); err != nil {
		return nil, context.Cause(ctx)
	}
	ctx, cancel := context.WithCancel(ctx)
	// Returning cancels any losing request without waiting for its response.
	defer cancel()
	span := trace.SpanFromContext(ctx)
	// A late attempt must be able to publish and exit after its peer wins or the caller cancels.
	results := make(chan scoreResult, 2)
	start := func(n int) {
		attemptCtx, attemptCancel := context.WithCancel(ctx)
		go func() {
			defer attemptCancel()
			scores, err := attempt(attemptCtx)
			if err == nil {
				if len(scores) != count {
					err = fmt.Errorf("rerank attempt %d: got %d scores, want %d", n, len(scores), count)
				}
				for _, score := range scores {
					if math.IsNaN(score) || math.IsInf(score, 0) {
						err = fmt.Errorf("rerank attempt %d: non-finite score", n)
						break
					}
				}
			}
			results <- scoreResult{scores: scores, err: err, attempt: n}
		}()
	}
	start(1)
	timer := time.NewTimer(hedgeDelay)
	defer timer.Stop()
	timerC := timer.C
	deadline, hasDeadline := ctx.Deadline()
	if hasDeadline && time.Until(deadline) <= hedgeDelay {
		timer.Stop()
		timerC = nil
	}
	started, pending := 1, 1
	var failures []error
	defer func() { span.SetAttributes(attribute.Int("rerank.attempt_count", started)) }()
	for pending > 0 {
		var result scoreResult
		select {
		case <-ctx.Done():
			return nil, context.Cause(ctx)
		case result = <-results:
		case <-timerC:
			span.AddEvent("rerank.hedge_timer_elapsed")
			// Select does not prioritize ready cases; prefer a queued primary over a duplicate.
			select {
			case result = <-results:
			default:
				if ctx.Err() != nil {
					return nil, context.Cause(ctx)
				}
				if hasDeadline && !time.Now().Before(deadline) {
					return nil, context.DeadlineExceeded
				}
				started, pending = 2, 2
				span.AddEvent("rerank.hedge_launched")
				start(2)
				continue
			}
		}
		pending--
		// Select may receive a ready result even when cancellation is also ready.
		if err := ctx.Err(); err != nil {
			return nil, context.Cause(ctx)
		}
		if result.err == nil {
			span.SetAttributes(attribute.Int("rerank.winning_attempt", result.attempt))
			if pending > 0 {
				span.AddEvent("rerank.losing_attempt_cancelled")
			}
			return result.scores, nil
		}
		failures = append(failures, fmt.Errorf("attempt %d: %w", result.attempt, result.err))
		span.AddEvent("rerank.attempt_failed", trace.WithAttributes(attribute.Int("attempt", result.attempt)))
		if started == 1 {
			return nil, failures[0]
		}
	}
	return nil, errors.Join(failures...)
}
