package resource

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

type acknowledgedEventSubscriber struct {
	fakeSubscription
	established chan struct{}
}

func (s *acknowledgedEventSubscriber) Enabled() bool { return true }
func (s *acknowledgedEventSubscriber) Subscribe(context.Context, string, func(string, []byte)) (Subscription, error) {
	return s, nil
}
func (s *acknowledgedEventSubscriber) WaitReady(ctx context.Context) error {
	select {
	case <-s.established:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func TestNATSCaptureReadinessFailure(t *testing.T) {
	for _, mode := range []string{"timeout", "canceled"} {
		t.Run(mode, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				subscriber := &acknowledgedEventSubscriber{established: make(chan struct{})}
				n := newNatsNotifier(subscriber, nil, log.NewNopLogger())
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				if mode == "canceled" {
					cancel()
				}
				require.False(t, n.trySubscribe(ctx, func(string, []byte) {}))
				require.True(t, subscriber.wasUnsubscribed(), "failed readiness must release the subscription before retrying")
			})
		})
	}
}

func TestNATSCaptureReadinessAcknowledgment(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		subscriber := &acknowledgedEventSubscriber{established: make(chan struct{})}
		n := newNatsNotifier(subscriber, nil, log.NewNopLogger())
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		ready := make(chan error, 1)
		returned := make(chan struct{})
		go func() {
			n.Watch(ctx, WatchOptions{SettleDelay: time.Millisecond, captureReady: ready})
			close(returned)
		}()
		time.Sleep(time.Second)
		require.Empty(t, ready, "local SUB success is not a capture acknowledgment")
		close(subscriber.established)
		<-returned
		require.NoError(t, <-ready)
	})
}
