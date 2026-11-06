package rerank

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/grafana/grafana/pkg/util/hedge"
)

const DefaultHedgeDelay = 500 * time.Millisecond

type retryableError struct{ error }

func (e retryableError) Unwrap() error { return e.error }

// MarkRetryable identifies a provider failure eligible for one immediate retry.
// The original error remains available through errors.Is and errors.As.
func MarkRetryable(err error) error {
	if err == nil {
		return nil
	}
	return retryableError{err}
}

// HedgeScores accepts the first complete, finite score result under the caller's deadline.
// Each attempt must build its own request and honor its context.
func HedgeScores(ctx context.Context, count int, delay time.Duration, attempt func(context.Context) ([]float64, error)) ([]float64, error) {
	return hedge.Do(ctx, hedge.Policy{Delay: delay, IsRetryable: func(err error) bool {
		var retryable retryableError
		return errors.As(err, &retryable)
	}}, func(attemptCtx context.Context) ([]float64, error) {
		scores, err := attempt(attemptCtx)
		if err != nil {
			return nil, err
		}
		if len(scores) != count {
			return nil, fmt.Errorf("got %d scores, want %d", len(scores), count)
		}
		for _, score := range scores {
			if math.IsNaN(score) || math.IsInf(score, 0) {
				return nil, errors.New("non-finite score")
			}
		}
		return scores, nil
	})
}
