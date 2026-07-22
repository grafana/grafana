package resource

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

type fakeSubscription struct {
	mu           sync.Mutex
	unsubscribed bool
}

func (f *fakeSubscription) Unsubscribe() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.unsubscribed = true
	return nil
}

func (f *fakeSubscription) wasUnsubscribed() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.unsubscribed
}

type fakeEventSubscriber struct {
	enabled bool

	// mu guards the fields below: the notifier's retry loop may call Subscribe
	// concurrently with a test inspecting the wiring.
	mu      sync.Mutex
	subErr  error
	subject string
	handler func(subject string, data []byte)
	sub     *fakeSubscription
}

func (f *fakeEventSubscriber) Enabled() bool { return f.enabled }

func (f *fakeEventSubscriber) Subscribe(_ context.Context, subject string, handler func(subject string, data []byte)) (Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.subErr != nil {
		return nil, f.subErr
	}
	f.subject = subject
	f.handler = handler
	f.sub = &fakeSubscription{}
	return f.sub, nil
}

func (f *fakeEventSubscriber) setSubErr(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.subErr = err
}

func (f *fakeEventSubscriber) currentHandler() func(subject string, data []byte) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.handler
}

func mustMarshalNotification(t *testing.T, n *resourcepb.WatchNotification) []byte {
	t.Helper()
	data, err := proto.Marshal(n)
	require.NoError(t, err)
	return data
}

// recvEvent reads one Event from the channel, failing if none arrives promptly.
func recvEvent(t *testing.T, ch <-chan Event) Event {
	t.Helper()
	select {
	case evt, ok := <-ch:
		require.True(t, ok, "channel closed, expected an event")
		return evt
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event")
		return Event{}
	}
}

// expectNoEvent asserts nothing is delivered within a short window.
func expectNoEvent(t *testing.T, ch <-chan Event) {
	t.Helper()
	select {
	case evt := <-ch:
		t.Fatalf("expected no event, got %+v", evt)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestNatsNotifierWatch_ConvertsNotifications(t *testing.T) {
	cases := []struct {
		name   string
		typ    resourcepb.WatchNotification_Type
		action kv.DataAction
	}{
		{"added", resourcepb.WatchNotification_ADDED, DataActionCreated},
		{"modified", resourcepb.WatchNotification_MODIFIED, DataActionUpdated},
		{"deleted", resourcepb.WatchNotification_DELETED, DataActionDeleted},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sub := &fakeEventSubscriber{enabled: true}
			n := newNatsNotifier(sub, nil, log.NewNopLogger())

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			out := n.Watch(ctx, WatchOptions{})
			require.NotNil(t, sub.handler)
			assert.Equal(t, resourcewatch.SubjectAllResources, sub.subject)

			sub.handler("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
				Type:                    tc.typ,
				Group:                   "playlist.grafana.app",
				Resource:                "playlists",
				Namespace:               "default",
				Name:                    "abc",
				ResourceVersion:         42,
				Folder:                  "folder1",
				PreviousResourceVersion: 41,
			}))

			evt := recvEvent(t, out)
			assert.Equal(t, "playlist.grafana.app", evt.Group)
			assert.Equal(t, "playlists", evt.Resource)
			assert.Equal(t, "default", evt.Namespace)
			assert.Equal(t, "abc", evt.Name)
			assert.Equal(t, int64(42), evt.ResourceVersion)
			assert.Equal(t, "folder1", evt.Folder)
			assert.Equal(t, tc.action, evt.Action)
			// PreviousRV is carried on the wire.
			assert.Equal(t, int64(41), evt.PreviousRV)
		})
	}
}

func TestNatsNotifierWatch_EmitsInResourceVersionOrder(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	out := n.Watch(ctx, WatchOptions{})
	require.NotNil(t, sub.handler)

	// Deliver notifications for the same object out of RV order, all within one
	// settle window. The settle buffer must reorder them so the watcher sees
	// ascending resource versions regardless of bus arrival order.
	for _, rv := range []int64{30, 10, 20} {
		sub.handler("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
			Type:                    resourcepb.WatchNotification_MODIFIED,
			Group:                   "playlist.grafana.app",
			Resource:                "playlists",
			Namespace:               "default",
			Name:                    "abc",
			ResourceVersion:         rv,
			PreviousResourceVersion: rv - 1,
		}))
	}

	require.Equal(t, int64(10), recvEvent(t, out).ResourceVersion)
	require.Equal(t, int64(20), recvEvent(t, out).ResourceVersion)
	require.Equal(t, int64(30), recvEvent(t, out).ResourceVersion)
}

func TestNatsNotifierWatch_DropsUnknownType(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "dropped_total"}, []string{"reason"})
	n := newNatsNotifier(sub, dropped, log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	out := n.Watch(ctx, WatchOptions{})

	sub.handler("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
		Type:            resourcepb.WatchNotification_UNKNOWN,
		Group:           "g",
		Resource:        "r",
		ResourceVersion: 1,
	}))

	expectNoEvent(t, out)
	assert.Equal(t, float64(1), testutil.ToFloat64(dropped.WithLabelValues("unknown_type")))
}

func TestNatsNotifierWatch_DropsUnmarshalableData(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	dropped := prometheus.NewCounterVec(prometheus.CounterOpts{Name: "dropped_total"}, []string{"reason"})
	n := newNatsNotifier(sub, dropped, log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	out := n.Watch(ctx, WatchOptions{})

	sub.handler("some.subject", []byte("not a valid protobuf"))

	expectNoEvent(t, out)
	assert.Equal(t, float64(1), testutil.ToFloat64(dropped.WithLabelValues("unmarshal_error")))
}

func TestNatsNotifierWatch_ClosesAndUnsubscribesOnContextCancel(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	out := n.Watch(ctx, WatchOptions{})
	cancel()

	select {
	case _, ok := <-out:
		assert.False(t, ok, "channel should be closed after context cancel")
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for channel to close")
	}

	// AfterFunc runs asynchronously; give it a moment.
	require.Eventually(t, func() bool {
		return sub.sub != nil && sub.sub.wasUnsubscribed()
	}, 2*time.Second, 10*time.Millisecond, "expected Unsubscribe to be called")
}

func TestNatsNotifierWatch_RetriesUntilSubscribeSucceeds(t *testing.T) {
	// Bus unreachable at first, then available: Watch must keep the channel open
	// and re-subscribe rather than closing it and losing the watch.
	sub := &fakeEventSubscriber{enabled: true, subErr: errors.New("boom")}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	// Small backoff bounds keep the subscription retry loop fast for the test.
	out := n.Watch(ctx, WatchOptions{MinBackoff: 10 * time.Millisecond, MaxBackoff: 20 * time.Millisecond})

	// The channel must stay open across the failed subscribe.
	select {
	case _, ok := <-out:
		require.True(t, ok, "channel closed on subscribe error; expected retry to keep it open")
	case <-time.After(50 * time.Millisecond):
	}

	// Bus recovers; the retry loop should subscribe and start delivering.
	sub.setSubErr(nil)
	require.Eventually(t, func() bool {
		return sub.currentHandler() != nil
	}, 2*time.Second, 10*time.Millisecond, "expected retry to subscribe once the bus is reachable")

	sub.currentHandler()("some.subject", mustMarshalNotification(t, &resourcepb.WatchNotification{
		Type:            resourcepb.WatchNotification_ADDED,
		Group:           "playlist.grafana.app",
		Resource:        "playlists",
		Namespace:       "default",
		Name:            "abc",
		ResourceVersion: 1,
	}))
	assert.Equal(t, "abc", recvEvent(t, out).Name)
}

func TestNatsNotifierPublishIsNoOp(t *testing.T) {
	n := newNatsNotifier(&fakeEventSubscriber{enabled: true}, nil, log.NewNopLogger())
	assert.NotPanics(t, func() {
		n.Publish(Event{Group: "g", Resource: "r", ResourceVersion: 1})
	})
}
