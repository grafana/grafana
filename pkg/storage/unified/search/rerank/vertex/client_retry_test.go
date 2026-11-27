package vertex

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/googleapis/gax-go/v2"
	"github.com/stretchr/testify/require"
)

type fixedRetryer struct {
	delay time.Duration
	calls *atomic.Int32
}

func (r fixedRetryer) Retry(error) (time.Duration, bool) {
	r.calls.Add(1)
	return r.delay, true
}

func TestCappedRetryOptionPreservesFactoryBackoffAndStopsAfterSecondAttempt(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		failure := errors.New("unavailable")
		var factories, decisions, attempts atomic.Int32
		start := time.Now()
		err := gax.Invoke(context.Background(), func(context.Context, gax.CallSettings) error {
			attempts.Add(1)
			return failure
		}, gax.WithRetry(func() gax.Retryer {
			factories.Add(1)
			return fixedRetryer{delay: 2 * time.Second, calls: &decisions}
		}), cappedRetryOption{ctx: context.Background()})
		require.ErrorIs(t, err, failure)
		require.EqualValues(t, 2, attempts.Load())
		require.EqualValues(t, 1, factories.Load())
		require.EqualValues(t, 1, decisions.Load())
		require.Equal(t, 2*time.Second, time.Since(start))
	})
}

func TestCappedRetryOptionKeepsNilRetryer(t *testing.T) {
	failure := errors.New("terminal")
	var attempts atomic.Int32
	err := gax.Invoke(context.Background(), func(context.Context, gax.CallSettings) error {
		attempts.Add(1)
		return failure
	}, gax.WithRetry(func() gax.Retryer { return nil }), cappedRetryOption{ctx: context.Background()})
	require.ErrorIs(t, err, failure)
	require.EqualValues(t, 1, attempts.Load())
}

func TestCappedRetryOptionPreservesNilFactory(t *testing.T) {
	failure := errors.New("terminal")
	var attempts atomic.Int32
	err := gax.Invoke(context.Background(), func(context.Context, gax.CallSettings) error {
		attempts.Add(1)
		return failure
	}, cappedRetryOption{ctx: context.Background()})
	require.ErrorIs(t, err, failure)
	require.EqualValues(t, 1, attempts.Load())
}
