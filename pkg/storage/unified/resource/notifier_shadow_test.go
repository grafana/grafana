package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/logging"
)

// countingSubscriber records how many times Subscribe is called and fails the
// first failFirst attempts, so a test can drive the shadow's re-subscribe loop.
type countingSubscriber struct {
	mu        sync.Mutex
	calls     int
	failFirst int
	handler   func(subject string, data []byte)
}

func (c *countingSubscriber) Enabled() bool { return true }

func (c *countingSubscriber) Subscribe(_ context.Context, _ string, handler func(subject string, data []byte), _ func()) (Subscription, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.calls++
	if c.calls <= c.failFirst {
		return nil, errors.New("nats unavailable")
	}
	c.handler = handler
	return &fakeSubscription{}, nil
}

func (c *countingSubscriber) callCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.calls
}

func TestNatsShadow_ReSubscribesAfterInitialFailure(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		sub := &countingSubscriber{failFirst: 2}
		// Bound both retry delays so the test can advance through them explicitly.
		s := newNatsShadow(sub, WatchOptions{MinBackoff: 10 * time.Millisecond, MaxBackoff: 20 * time.Millisecond}, prometheus.NewRegistry(), &logging.NoOpLogger{})

		ctx := t.Context()
		s.start(ctx)

		// Finish the first failed subscribe before advancing through the retry backoff.
		synctest.Wait()

		require.Equal(t, 1, sub.callCount())

		// Cover both bounded retries and let the third subscription succeed.
		synctest.Sleep(40 * time.Millisecond)

		require.Equal(t, 3, sub.callCount())
	})
}
