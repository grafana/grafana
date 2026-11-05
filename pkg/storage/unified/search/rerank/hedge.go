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
// after 500 ms. Each attempt must build its own request and honor its context.
func HedgeScores(ctx context.Context, count int, attempt func(context.Context) ([]float64, error)) ([]float64, error) {
	if err := ctx.Err(); err != nil {
		return nil, context.Cause(ctx)
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	span := trace.SpanFromContext(ctx)
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
	finish := func() { span.SetAttributes(attribute.Int("rerank.attempt_count", started)) }
	defer finish()
	for pending > 0 {
		select {
		case <-ctx.Done():
			return nil, context.Cause(ctx)
		case result := <-results:
			pending--
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
				timer.Stop()
				return nil, failures[0]
			}
		case <-timerC:
			span.AddEvent("rerank.hedge_timer_elapsed")
			// A completed primary always wins over a timer that became ready at the same time.
			select {
			case result := <-results:
				if err := ctx.Err(); err != nil {
					return nil, context.Cause(ctx)
				}
				if result.err == nil {
					span.SetAttributes(attribute.Int("rerank.winning_attempt", result.attempt))
					return result.scores, nil
				}
				span.AddEvent("rerank.attempt_failed", trace.WithAttributes(attribute.Int("attempt", 1)))
				return nil, fmt.Errorf("attempt 1: %w", result.err)
			default:
			}
			if ctx.Err() != nil {
				return nil, context.Cause(ctx)
			}
			if hasDeadline && !time.Now().Before(deadline) {
				return nil, context.DeadlineExceeded
			}
			started, pending = 2, 2
			span.AddEvent("rerank.hedge_launched")
			start(2)
		}
	}
	return nil, errors.Join(failures...)
}
