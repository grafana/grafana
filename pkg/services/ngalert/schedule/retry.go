package schedule

import (
	"time"

	"github.com/benbjohnson/clock"
	"github.com/cenkalti/backoff/v4"
)

const retryStop = backoff.Stop

type Retry interface {
	NextAttemptIn() time.Duration
}

type ExponentialBackoffRetryer struct {
	backoff.BackOff
}

func newExponentialBackoffRetryer(
	maxRetries int64,
	initialRetryDelay time.Duration,
	maxRetryDelay time.Duration,
	maxElapsedTime time.Duration,
	clock clock.Clock,
) *ExponentialBackoffRetryer {
	b := backoff.NewExponentialBackOff(
		backoff.WithClockProvider(clock),
		backoff.WithMaxInterval(maxRetryDelay),
		backoff.WithInitialInterval(initialRetryDelay),
		backoff.WithMaxElapsedTime(maxElapsedTime),
		backoff.WithRandomizationFactor(0),
	)

	return &ExponentialBackoffRetryer{
		BackOff: backoff.WithMaxRetries(b, uint64(maxRetries)),
	}
}

func (b *ExponentialBackoffRetryer) NextAttemptIn() time.Duration {
	return b.NextBackOff()
}
