package resource

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type resourceVersionOrderingError struct {
	rv        int64
	minimumRV int64
}

func (e *resourceVersionOrderingError) Error() string {
	return fmt.Sprintf("generated resource version %d is not greater than current resource version %d; please retry", e.rv, e.minimumRV)
}

func (k *kvStorageBackend) generateResourceVersionWithRetry(ctx context.Context, minimumRV int64) (int64, error) {
	deadline := time.Now().Add(k.resourceVersionMaxWait)
	var waitStarted time.Time
	var waitReason string
	outcome := "exhausted"
	defer func() {
		if !waitStarted.IsZero() {
			k.metrics.ResourceVersionWaitDuration.WithLabelValues(waitReason, outcome).Observe(time.Since(waitStarted).Seconds())
		}
	}()

	for {
		if err := ctx.Err(); err != nil {
			outcome = "canceled"
			return 0, err
		}
		rv, err := k.generateResourceVersion()
		var reason string
		var wait time.Duration
		if err != nil {
			var failure *resourceVersionGenerationError
			if !errors.As(err, &failure) || failure.reason != resourceVersionClockRegression {
				return 0, err
			}
			reason = resourceVersionClockRegression
			wait = time.Duration(failure.lastMillis-failure.currentMillis) * time.Millisecond
		} else if rv <= minimumRV {
			err = &resourceVersionOrderingError{rv: rv, minimumRV: minimumRV}
			reason = "same_timestamp"
			gap := snowflakeTimestampMillis(minimumRV) - snowflakeTimestampMillis(rv)
			if gap > 0 {
				reason = "clock_behind"
			}
			// The next millisecond is greater regardless of the node and sequence bits.
			wait = time.Duration(gap+1) * time.Millisecond
		} else {
			outcome = "recovered"
			return rv, nil
		}

		if k.resourceVersionMaxWait < 0 {
			return 0, err
		}

		if waitStarted.IsZero() {
			waitStarted = time.Now()
			waitReason = reason
		}
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return 0, err
		}
		wait = min(wait, remaining)
		// Generate has already released the process-wide mutex, so unrelated
		// resources can keep writing while this resource's lease is held.
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			outcome = "canceled"
			return 0, ctx.Err()
		case <-timer.C:
		}
	}
}
