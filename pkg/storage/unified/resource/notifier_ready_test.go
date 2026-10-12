package resource

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/logging"
)

type acknowledgedEventSubscriber struct {
	fakeSubscription
	established chan struct{}
}

func (s *acknowledgedEventSubscriber) Enabled() bool { return true }
func (s *acknowledgedEventSubscriber) Subscribe(context.Context, string, func(string, []byte), func()) (Subscription, error) {
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
				expiry := NewWatchExpiry()
				n := newNatsNotifier(subscriber, expiry, nil, &logging.NoOpLogger{})
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
		expiry := NewWatchExpiry()
		n := newNatsNotifier(subscriber, expiry, nil, &logging.NoOpLogger{})
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		ready := make(chan error, 1)
		generation := expiry.WatchInvalidation()
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
		require.Equal(t, generation, expiry.WatchInvalidation(), "healthy initial capture must not invalidate watches")
	})
}

func TestNATSInitialCaptureRecoveryInvalidatesWatches(t *testing.T) {
	for _, tc := range []struct {
		name     string
		timeout  bool
		canceled bool
	}{
		{name: "subscribe error"},
		{name: "readiness timeout", timeout: true},
		{name: "subscribe error/canceled", canceled: true},
		{name: "readiness timeout/canceled", timeout: true, canceled: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				sub := &fakeEventSubscriber{enabled: true, subErr: errors.New("unavailable")}
				var subscriber EventSubscriber = sub
				restore := func() { sub.setSubErr(nil) }
				if tc.timeout {
					sub := &acknowledgedEventSubscriber{established: make(chan struct{})}
					subscriber = sub
					restore = func() { close(sub.established) }
				}
				expiry := NewWatchExpiry()
				n := newNatsNotifier(subscriber, expiry, nil, &logging.NoOpLogger{})
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				ready := make(chan error, 1)
				generation := expiry.WatchInvalidation()
				events := n.Watch(ctx, WatchOptions{captureReady: ready})
				defer func() {
					cancel()
					_, ok := <-events
					require.False(t, ok)
				}()
				require.Equal(t, generation, expiry.WatchInvalidation())
				require.Empty(t, ready)

				if tc.canceled {
					cancel()
				}
				// Initial connection recovery does not invoke a reconnect callback.
				restore()
				if tc.canceled {
					synctest.Wait()
					require.Empty(t, ready)
					require.Equal(t, generation, expiry.WatchInvalidation())
				} else {
					require.NoError(t, <-ready)
					_, open := <-generation
					require.False(t, open, "recovery must close the old generation")
					require.NotEqual(t, generation, expiry.WatchInvalidation())
				}
				select {
				case <-expiry.WatchInvalidation():
					t.Fatal("current generation must remain open")
				default:
				}
			})
		})
	}
}

func TestNATSReconnectWaitsForRestoredCapture(t *testing.T) {
	for _, mode := range []string{"restored", "acknowledgment failed", "acknowledgment timed out", "canceled during retry"} {
		t.Run(mode, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				sub := &reconnectReadySubscriber{waiting: make(chan struct{}, 1), responses: make(chan error)}
				expiry := NewWatchExpiry()
				n := newNatsNotifier(sub, expiry, nil, &logging.NoOpLogger{})
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				events := n.Watch(ctx, WatchOptions{})
				established := expiry.WatchInvalidation()
				sub.reconnect()
				<-sub.waiting
				duringRestoration := expiry.WatchInvalidation()
				require.Equal(t, established, duringRestoration)

				if mode != "restored" {
					for i := 0; i < 2; i++ {
						if mode != "acknowledgment timed out" {
							sub.responses <- errors.New("capture not acknowledged")
						}
						// With no response, the readiness deadline elapses in virtual time.
						// A retry must happen without any further reconnect callback.
						<-sub.waiting
						require.Equal(t, established, expiry.WatchInvalidation(), "failed readiness must not open a fresh generation")
					}
				}
				duringRetry := expiry.WatchInvalidation()
				select {
				case <-established:
					t.Fatal("expired before restored capture was acknowledged")
				default:
				}

				if mode == "canceled during retry" {
					cancel()
					synctest.Wait()
					require.Equal(t, established, expiry.WatchInvalidation())
					select {
					case <-established:
						t.Fatal("shutdown must not expire watches")
					default:
					}
				} else {
					sub.responses <- nil
					synctest.Wait()
					for _, generation := range []<-chan struct{}{established, duringRestoration, duringRetry} {
						select {
						case <-generation:
						default:
							t.Fatal("watch missed reconnect invalidation")
						}
					}
					after := expiry.WatchInvalidation()
					require.NotEqual(t, established, after)
					select {
					case <-after:
						t.Fatal("new generation is already expired")
					default:
					}
					cancel()
				}
				_, ok := <-events
				require.False(t, ok)
			})
		})
	}
}

type reconnectReadySubscriber struct {
	fakeSubscription
	reconnect func()
	calls     atomic.Int32
	waiting   chan struct{}
	responses chan error
}

func (s *reconnectReadySubscriber) Enabled() bool { return true }
func (s *reconnectReadySubscriber) Subscribe(_ context.Context, _ string, _ func(string, []byte), reconnect func()) (Subscription, error) {
	s.reconnect = reconnect
	return s, nil
}
func (s *reconnectReadySubscriber) WaitReady(ctx context.Context) error {
	if s.calls.Add(1) == 1 {
		return nil
	}
	s.waiting <- struct{}{}
	select {
	case err := <-s.responses:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
