package schedule

import (
	"time"

	"github.com/benbjohnson/clock"
	"github.com/cenkalti/backoff/v4"
)

const retryStop = backoff.Stop

type exponentialBackoffRetryer struct {
	backoff.BackOff
}

func newExponentialBackoffRetryer(
	maxRetries int64,
	initialRetryDelay time.Duration,
	maxRetryDelay time.Duration,
	randomizationFactor float64,
	clock clock.Clock,
) *exponentialBackoffRetryer {
	b := backoff.NewExponentialBackOff(
		backoff.WithClockProvider(clock),
		backoff.WithMaxInterval(maxRetryDelay),
		backoff.WithInitialInterval(initialRetryDelay),
		backoff.WithRandomizationFactor(randomizationFactor),
	)

	return &exponentialBackoffRetryer{
		BackOff: backoff.WithMaxRetries(b, uint64(maxRetries)),
	}
}

func (b *exponentialBackoffRetryer) NextAttemptIn() time.Duration {
	return b.NextBackOff()
}
