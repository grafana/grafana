package schedule

import (
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/cenkalti/backoff/v4"
	"github.com/stretchr/testify/require"
)

func TestExponentialBackoffRetryProvider_New(t *testing.T) {
	testClock := clock.NewMock()

	maxRetries := int64(5)
	initialDelay := 100 * time.Millisecond
	maxDelay := 1 * time.Second

	retry := newExponentialBackoffRetryer(maxRetries, initialDelay, maxDelay, 0, testClock)
	require.NotNil(t, retry, "Retry instance should not be nil")

	for i := int64(0); i < maxRetries; i++ {
		delay := retry.NextAttemptIn()
		require.GreaterOrEqual(t, delay, initialDelay, "Delay should be at least the initial delay")
		require.LessOrEqual(t, delay, maxDelay, "Delay should not exceed the max delay")

		testClock.Add(delay)
	}

	delay := retry.NextAttemptIn()
	require.Equal(t, backoff.Stop, delay, "Delay should be backoff.Stop after max retries")
}

func TestExponentialBackoffRetryProvider_MaxRetries(t *testing.T) {
	testClock := clock.NewMock()

	t.Run("max retries is zero", func(t *testing.T) {
		retry := newExponentialBackoffRetryer(0, 100*time.Millisecond, 1*time.Second, 0, testClock)
		require.NotNil(t, retry, "Retry instance should not be nil")
		delay := retry.NextAttemptIn()
		require.Equal(t, backoff.Stop, delay, "Should immediately stop when maxRetries is 0")
	})

	t.Run("max retries is not zero", func(t *testing.T) {
		maxRetries := int64(10)
		retry := newExponentialBackoffRetryer(maxRetries, 10*time.Millisecond, 1*time.Second, 0, testClock)
		for i := int64(0); i < maxRetries; i++ {
			delay := retry.NextAttemptIn()
			require.NotEqual(t, backoff.Stop, delay, "Should not stop before reaching max retries")
			testClock.Add(delay)
		}

		delay := retry.NextAttemptIn()
		require.Equal(t, backoff.Stop, delay, "Should stop after reaching maxRetries")
	})
}

func TestExponentialBackoffRetryProvider_DelaysWithinBounds(t *testing.T) {
	testClock := clock.NewMock()

	initialDelay := 200 * time.Millisecond
	maxDelay := 2 * time.Second
	maxRetries := int64(10)

	retry := newExponentialBackoffRetryer(maxRetries, initialDelay, maxDelay, 0, testClock)

	for i := int64(0); i < maxRetries; i++ {
		delay := retry.NextAttemptIn()
		require.GreaterOrEqual(t, delay, initialDelay, "Delay should not be less than initial delay")
		require.LessOrEqual(t, delay, maxDelay, "Delay should not exceed max delay")
		testClock.Add(delay)
	}
}
