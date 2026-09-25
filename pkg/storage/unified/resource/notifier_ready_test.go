package resource

import (
	"context"
	"errors"
	"sync/atomic"
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
		generation := n.WatchInvalidation()
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
		require.Equal(t, generation, n.WatchInvalidation(), "healthy initial capture must not invalidate watches")
	})
}

func TestNATSInitialCaptureRecoveryInvalidatesWatches(t *testing.T) {
	for _, failure := range []string{"subscribe error", "readiness timeout"} {
		for _, canceled := range []bool{false, true} {
			name := failure
			if canceled {
				name += "/canceled"
			}
			t.Run(name, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					var subscriber EventSubscriber
					var restore func()
					if failure == "subscribe error" {
						sub := &fakeEventSubscriber{enabled: true, subErr: errors.New("unavailable")}
						subscriber = sub
						restore = func() { sub.setSubErr(nil) }
					} else {
						sub := &acknowledgedEventSubscriber{established: make(chan struct{})}
						subscriber = sub
						restore = func() { close(sub.established) }
					}
					n := newNatsNotifier(subscriber, nil, log.NewNopLogger())
					ctx, cancel := context.WithCancel(t.Context())
					defer cancel()
					ready := make(chan error, 1)
					beforeStartup := n.WatchInvalidation()
					events := n.Watch(ctx, WatchOptions{captureReady: ready})
					duringOutage := n.WatchInvalidation()
					require.Equal(t, beforeStartup, duringOutage)
					require.Empty(t, ready)
					if canceled {
						cancel()
					}
					restore()
					if canceled {
						synctest.Wait()
						require.Empty(t, ready)
						require.Equal(t, duringOutage, n.WatchInvalidation())
						select {
						case <-duringOutage:
							t.Fatal("canceled startup expired watches")
						default:
						}
					} else {
						require.NoError(t, <-ready)
						// Recovery is an initial connection: no reconnect callback is invoked.
						for _, generation := range []<-chan struct{}{beforeStartup, duringOutage} {
							select {
							case <-generation:
							default:
								t.Fatal("watch survived a startup capture gap")
							}
						}
						afterRecovery := n.WatchInvalidation()
						require.NotEqual(t, duringOutage, afterRecovery)
						select {
						case <-afterRecovery:
							t.Fatal("watch opened after recovery is expired")
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
}

func TestNATSReconnectWaitsForRestoredCapture(t *testing.T) {
	for _, mode := range []string{"restored", "acknowledgment failed", "acknowledgment timed out", "canceled during retry"} {
		t.Run(mode, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				sub := &reconnectReadySubscriber{waiting: make(chan struct{}, 1), responses: make(chan error)}
				n := newNatsNotifier(sub, nil, log.NewNopLogger())
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				events := n.Watch(ctx, WatchOptions{})
				established := n.WatchInvalidation()
				sub.reconnect()
				<-sub.waiting
				duringRestoration := n.WatchInvalidation()
				require.Equal(t, established, duringRestoration)

				if mode != "restored" {
					for i := 0; i < 2; i++ {
						if mode != "acknowledgment timed out" {
							sub.responses <- errors.New("capture not acknowledged")
						}
						// With no response, the readiness deadline elapses in virtual time.
						// A retry must happen without any further reconnect callback.
						<-sub.waiting
						require.Equal(t, established, n.WatchInvalidation(), "failed readiness must not open a fresh generation")
					}
				}
				duringRetry := n.WatchInvalidation()
				select {
				case <-established:
					t.Fatal("expired before restored capture was acknowledged")
				default:
				}

				if mode == "canceled during retry" {
					cancel()
					synctest.Wait()
					require.Equal(t, established, n.WatchInvalidation())
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
					after := n.WatchInvalidation()
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
