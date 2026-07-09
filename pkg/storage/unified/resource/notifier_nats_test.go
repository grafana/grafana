package resource

import (
	"context"
	"errors"
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

type fakeSubscription struct{ unsubscribed bool }

func (f *fakeSubscription) Unsubscribe() error {
	f.unsubscribed = true
	return nil
}

type fakeEventSubscriber struct {
	enabled bool
	subErr  error

	subject string
	handler func(subject string, data []byte)
	sub     *fakeSubscription
}

func (f *fakeEventSubscriber) Enabled() bool { return f.enabled }

func (f *fakeEventSubscriber) Subscribe(_ context.Context, subject string, handler func(subject string, data []byte)) (Subscription, error) {
	if f.subErr != nil {
		return nil, f.subErr
	}
	f.subject = subject
	f.handler = handler
	f.sub = &fakeSubscription{}
	return f.sub, nil
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
			assert.Equal(t, resourcewatch.SubjectAll, sub.subject)

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
		return sub.sub != nil && sub.sub.unsubscribed
	}, 2*time.Second, 10*time.Millisecond, "expected Unsubscribe to be called")
}

func TestNatsNotifierWatch_SubscribeErrorClosesChannel(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true, subErr: errors.New("boom")}
	n := newNatsNotifier(sub, nil, log.NewNopLogger())

	out := n.Watch(context.Background(), WatchOptions{})

	select {
	case _, ok := <-out:
		assert.False(t, ok, "channel should be closed when subscribe fails")
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for channel to close")
	}
}

func TestNatsNotifierPublishIsNoOp(t *testing.T) {
	n := newNatsNotifier(&fakeEventSubscriber{enabled: true}, nil, log.NewNopLogger())
	assert.NotPanics(t, func() {
		n.Publish(Event{Group: "g", Resource: "r", ResourceVersion: 1})
	})
}
