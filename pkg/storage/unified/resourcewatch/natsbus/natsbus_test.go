package natsbus

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resourcebus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var testGVR = schema.GroupVersionResource{Group: "provisioning.grafana.app", Version: "v0alpha1", Resource: "repositories"}

type fakeSubscriber struct {
	enabled bool
	err     error

	subject string
	handler nats.MessageHandler
	opts    []nats.SubscribeOption
	sub     *fakeSubscription
}

func (f *fakeSubscriber) Enabled() bool { return f.enabled }

func (f *fakeSubscriber) Subscribe(_ context.Context, subject string, handler nats.MessageHandler, opts ...nats.SubscribeOption) (nats.Subscription, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.subject = subject
	f.handler = handler
	f.opts = opts
	f.sub = &fakeSubscription{}
	return f.sub, nil
}

type fakeSubscription struct {
	unsubscribed bool
	unsubErr     error
}

func (f *fakeSubscription) WaitReady(context.Context) error { return nil }

func (f *fakeSubscription) Unsubscribe() error {
	f.unsubscribed = true
	return f.unsubErr
}

func TestNew(t *testing.T) {
	t.Run("an enabled subscriber is adapted", func(t *testing.T) {
		assert.NotNil(t, New(&fakeSubscriber{enabled: true}, log.NewNopLogger()))
	})

	t.Run("a disabled subscriber selects the watch", func(t *testing.T) {
		assert.Nil(t, New(&fakeSubscriber{}, log.NewNopLogger()))
	})

	// The SDK's "a nil subscriber selects the watch" check is an interface comparison, which a non-nil interface
	// holding a nil pointer passes.
	t.Run("a typed-nil subscriber selects the watch", func(t *testing.T) {
		sub := New((*nats.SubscriberService)(nil), log.NewNopLogger())
		assert.True(t, sub == nil)
	})
}

func TestSubscribeSubject(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		want      string
	}{
		{
			name:      "one namespace",
			namespace: "default",
			want:      "us.watch.v1.provisioning.grafana.app.default.repositories",
		},
		{
			name:      "every namespace",
			namespace: "",
			want:      "us.watch.v1.provisioning.grafana.app.*.repositories",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeSubscriber{enabled: true}
			_, err := New(fake, log.NewNopLogger()).Subscribe(context.Background(), testGVR, tt.namespace, func(context.Context, resourcebus.Event) {})
			require.NoError(t, err)
			assert.Equal(t, tt.want, fake.subject)
		})
	}
}

func TestSubscribeOptions(t *testing.T) {
	// The resolved NATS config is package-private, so the mapping is asserted by the options passed on; the
	// embedded-server test covers what a queue group and a reconnect actually do.
	tests := []struct {
		name string
		opts []resourcebus.SubscribeOption
		want int
	}{
		{name: "no options", want: 0},
		{name: "group", opts: []resourcebus.SubscribeOption{resourcebus.WithGroup(resourcebus.Group{Name: "repo-controller"})}, want: 1},
		{name: "reconnect", opts: []resourcebus.SubscribeOption{resourcebus.WithOnReconnect(func() {})}, want: 1},
		{
			name: "both",
			opts: []resourcebus.SubscribeOption{resourcebus.WithGroup(resourcebus.Group{Name: "repo-controller"}), resourcebus.WithOnReconnect(func() {})},
			want: 2,
		},
		{name: "an unnamed group subscribes outside any group", opts: []resourcebus.SubscribeOption{resourcebus.WithGroup(resourcebus.Group{})}, want: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeSubscriber{enabled: true}
			_, err := New(fake, log.NewNopLogger()).Subscribe(context.Background(), testGVR, "default", func(context.Context, resourcebus.Event) {}, tt.opts...)
			require.NoError(t, err)
			assert.Len(t, fake.opts, tt.want)
		})
	}
}

func TestSubscribeError(t *testing.T) {
	wantErr := errors.New("no connection")
	_, err := New(&fakeSubscriber{enabled: true, err: wantErr}, log.NewNopLogger()).
		Subscribe(context.Background(), testGVR, "default", func(context.Context, resourcebus.Event) {})
	assert.ErrorIs(t, err, wantErr)
}

func TestSubscriptionClose(t *testing.T) {
	fake := &fakeSubscriber{enabled: true}
	sub, err := New(fake, log.NewNopLogger()).Subscribe(context.Background(), testGVR, "default", func(context.Context, resourcebus.Event) {})
	require.NoError(t, err)

	require.NoError(t, sub.Close())
	assert.True(t, fake.sub.unsubscribed)
}

func TestDelivery(t *testing.T) {
	tests := []struct {
		name         string
		notification *resourcepb.WatchNotification
		data         []byte
		want         []resourcebus.Event
	}{
		{
			name: "added",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_ADDED, Namespace: "default", Name: "repo-1", ResourceVersion: 42,
			},
			want: []resourcebus.Event{{Verb: resourcebus.VerbAdded, Namespace: "default", Name: "repo-1", ResourceVersion: "42"}},
		},
		{
			name: "modified",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_MODIFIED, Namespace: "default", Name: "repo-1", ResourceVersion: 43,
			},
			want: []resourcebus.Event{{Verb: resourcebus.VerbModified, Namespace: "default", Name: "repo-1", ResourceVersion: "43"}},
		},
		{
			name: "deleted",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_DELETED, Namespace: "default", Name: "repo-1", ResourceVersion: 44,
			},
			want: []resourcebus.Event{{Verb: resourcebus.VerbDeleted, Namespace: "default", Name: "repo-1", ResourceVersion: "44"}},
		},
		{
			name: "a cluster-scoped change carries no namespace",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_ADDED, Name: "lease-1", ResourceVersion: 1,
			},
			want: []resourcebus.Event{{Verb: resourcebus.VerbAdded, Name: "lease-1", ResourceVersion: "1"}},
		},
		{
			name: "an unset resource version reads as zero",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_ADDED, Namespace: "default", Name: "repo-1",
			},
			want: []resourcebus.Event{{Verb: resourcebus.VerbAdded, Namespace: "default", Name: "repo-1", ResourceVersion: "0"}},
		},
		{
			name: "announced metadata is carried",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_MODIFIED, Namespace: "default", Name: "repo-1", ResourceVersion: 45,
				Metadata: &resourcepb.NotificationMetadata{
					Labels:                  map[string]string{"grafana.app/managedBy": "repo"},
					Annotations:             map[string]string{"grafana.app/sourcePath": "dashboards/a.json"},
					Finalizers:              []string{"provisioning.grafana.app/cleanup"},
					Generation:              7,
					CreationTimestampMillis: 1700000000000,
				},
			},
			want: []resourcebus.Event{{
				Verb: resourcebus.VerbModified, Namespace: "default", Name: "repo-1", ResourceVersion: "45",
				Metadata: &resourcebus.EventMetadata{
					Labels:            map[string]string{"grafana.app/managedBy": "repo"},
					Annotations:       map[string]string{"grafana.app/sourcePath": "dashboards/a.json"},
					Finalizers:        []string{"provisioning.grafana.app/cleanup"},
					Generation:        7,
					CreationTimestamp: time.UnixMilli(1700000000000),
				},
			}},
		},
		{
			name: "a deleting object carries its deletion timestamp",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_MODIFIED, Namespace: "default", Name: "repo-1", ResourceVersion: 46,
				Metadata: &resourcepb.NotificationMetadata{DeletionTimestampMillis: 1700000001000},
			},
			want: []resourcebus.Event{{
				Verb: resourcebus.VerbModified, Namespace: "default", Name: "repo-1", ResourceVersion: "46",
				Metadata: &resourcebus.EventMetadata{DeletionTimestamp: ptr(time.UnixMilli(1700000001000))},
			}},
		},
		{
			name: "unknown timestamps read as unannounced, not as the epoch",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_ADDED, Namespace: "default", Name: "repo-1", ResourceVersion: 47,
				Metadata: &resourcepb.NotificationMetadata{Generation: 1},
			},
			want: []resourcebus.Event{{
				Verb: resourcebus.VerbAdded, Namespace: "default", Name: "repo-1", ResourceVersion: "47",
				Metadata: &resourcebus.EventMetadata{Generation: 1},
			}},
		},
		{
			name: "an unknown type is dropped",
			notification: &resourcepb.WatchNotification{
				Type: resourcepb.WatchNotification_UNKNOWN, Namespace: "default", Name: "repo-1", ResourceVersion: 1,
			},
			want: nil,
		},
		{
			name: "a malformed envelope is dropped",
			data: []byte("not a protobuf"),
			want: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeSubscriber{enabled: true}
			var got []resourcebus.Event
			_, err := New(fake, log.NewNopLogger()).Subscribe(context.Background(), testGVR, "default",
				func(_ context.Context, evt resourcebus.Event) { got = append(got, evt) })
			require.NoError(t, err)

			data := tt.data
			if tt.notification != nil {
				data, err = proto.Marshal(tt.notification)
				require.NoError(t, err)
			}
			fake.handler(fake.subject, data)

			assert.Equal(t, tt.want, got)
		})
	}
}

// A dropped message must not stop the ones after it.
func TestDeliveryContinuesAfterDrop(t *testing.T) {
	fake := &fakeSubscriber{enabled: true}
	var got []resourcebus.Event
	_, err := New(fake, log.NewNopLogger()).Subscribe(context.Background(), testGVR, "default",
		func(_ context.Context, evt resourcebus.Event) { got = append(got, evt) })
	require.NoError(t, err)

	fake.handler(fake.subject, []byte("not a protobuf"))
	good, err := proto.Marshal(&resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_ADDED, Namespace: "default", Name: "repo-1", ResourceVersion: 42,
	})
	require.NoError(t, err)
	fake.handler(fake.subject, good)

	assert.Equal(t, []resourcebus.Event{
		{Verb: resourcebus.VerbAdded, Namespace: "default", Name: "repo-1", ResourceVersion: "42"},
	}, got)
}

func TestSubscribeGroupDelivery(t *testing.T) {
	tests := []struct {
		name    string
		group   resourcebus.Group
		wantErr bool
	}{
		{name: "no group", group: resourcebus.Group{}},
		{name: "default delivery", group: resourcebus.Group{Name: "repo-controller"}},
		{
			name:  "round robin",
			group: resourcebus.Group{Name: "repo-controller", Delivery: resourcebus.GroupDeliveryRoundRobin},
		},
		{
			// Substituting a delivery the bus cannot provide would either duplicate every event across the members
			// or drop the ones a member was meant to handle.
			name:    "a delivery nats cannot provide",
			group:   resourcebus.Group{Name: "repo-controller", Delivery: "sticky"},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeSubscriber{enabled: true}
			_, err := New(fake, log.NewNopLogger()).Subscribe(context.Background(), testGVR, "default",
				func(context.Context, resourcebus.Event) {}, resourcebus.WithGroup(tt.group))

			if tt.wantErr {
				assert.ErrorContains(t, err, "nats cannot share delivery")
				return
			}
			require.NoError(t, err)
		})
	}
}

func ptr[T any](v T) *T { return &v }
