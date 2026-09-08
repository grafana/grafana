package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
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

func (c *countingSubscriber) Subscribe(_ context.Context, _ string, handler func(subject string, data []byte)) (Subscription, error) {
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
	sub := &countingSubscriber{failFirst: 2}
	// Small backoff bounds keep the notifier's subscription retry loop fast.
	s := newNatsShadow(sub, WatchOptions{MinBackoff: 10 * time.Millisecond, MaxBackoff: 20 * time.Millisecond}, prometheus.NewRegistry(), log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	s.start(ctx)

	// The first two Subscribe calls fail; the loop must keep retrying until one
	// succeeds rather than giving up after the first failure.
	require.Eventually(t, func() bool {
		return sub.callCount() > 2
	}, 2*time.Second, 5*time.Millisecond, "shadow did not re-subscribe after initial failures")
}
