package resource

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// newTestKVStorageBackend builds just enough of a kvStorageBackend to publish
// watch notifications.
func newTestKVStorageBackend(pub EventPublisher) *kvStorageBackend {
	return &kvStorageBackend{log: &logging.NoOpLogger{}, watchPublisher: NewWatchNotificationPublisher(pub, nil, &logging.NoOpLogger{})}
}

// fakeEventPublisher records what publishWatchNotification hands to the bus.
type fakeEventPublisher struct {
	enabled   bool
	err       error
	subjects  []string
	payloads  [][]byte
	onPublish func(subject string, data []byte)
}

func (f *fakeEventPublisher) Enabled() bool { return f.enabled }

func (f *fakeEventPublisher) Publish(_ context.Context, subject string, data []byte) error {
	f.subjects = append(f.subjects, subject)
	f.payloads = append(f.payloads, data)
	if f.err == nil && f.onPublish != nil {
		f.onPublish(subject, data)
	}
	return f.err
}

// sizedPublisher reports a max payload like the NATS publisher does.
type sizedPublisher struct {
	*fakeEventPublisher
	max int64
}

func (s *sizedPublisher) MaxPayload() int64 { return s.max }

func TestActionToWatchNotificationType(t *testing.T) {
	assert.Equal(t, resourcepb.WatchNotification_ADDED, actionToWatchNotificationType(DataActionCreated))
	assert.Equal(t, resourcepb.WatchNotification_MODIFIED, actionToWatchNotificationType(DataActionUpdated))
	assert.Equal(t, resourcepb.WatchNotification_DELETED, actionToWatchNotificationType(DataActionDeleted))
	// An unknown action must not masquerade as a real change.
	assert.Equal(t, resourcepb.WatchNotification_UNKNOWN, actionToWatchNotificationType("bogus"))
}

func TestPublishWatchNotification(t *testing.T) {
	event := Event{
		Namespace:       "default",
		Group:           "provisioning.grafana.app",
		Resource:        "repositories",
		Name:            "repo-1",
		ResourceVersion: 42,
		Action:          DataActionUpdated,
		Folder:          "folder-1",
		PreviousRV:      41,
		PreviousAction:  DataActionCreated,
		PreviousFolder:  "old-folder",
	}

	t.Run("publishes a metadata-only notification on the resource subject", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := newTestKVStorageBackend(pub)

		backend.publishWatchNotification(context.Background(), event)

		require.Len(t, pub.subjects, 1)
		assert.Equal(t, "us.watch.v1.provisioning.grafana.app.default.repositories", pub.subjects[0])

		var got resourcepb.WatchNotification
		require.NoError(t, proto.Unmarshal(pub.payloads[0], &got))
		assert.Equal(t, resourcepb.WatchNotification_MODIFIED, got.GetType())
		assert.Equal(t, event.Group, got.GetGroup())
		assert.Equal(t, event.Resource, got.GetResource())
		assert.Equal(t, event.Namespace, got.GetNamespace())
		assert.Equal(t, event.Name, got.GetName())
		assert.Equal(t, event.ResourceVersion, got.GetResourceVersion())
		assert.Equal(t, event.Folder, got.GetFolder())
		assert.Equal(t, event.PreviousRV, got.GetPreviousResourceVersion())
		assert.Equal(t, resourcepb.WatchNotification_ADDED, got.GetPreviousType())
		assert.Equal(t, event.PreviousFolder, got.GetPreviousFolder())
	})

	t.Run("carries the metadata it is given", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := newTestKVStorageBackend(pub)
		meta := &resourcepb.NotificationMetadata{
			Labels:                  map[string]string{"a": "1"},
			Annotations:             map[string]string{"b": "2"},
			Finalizers:              []string{"f"},
			Generation:              3,
			CreationTimestampMillis: 1000,
			DeletionTimestampMillis: 2000,
		}

		withMeta := event
		withMeta.Metadata = meta
		backend.publishWatchNotification(context.Background(), withMeta)

		var got resourcepb.WatchNotification
		require.NoError(t, proto.Unmarshal(pub.payloads[0], &got))
		assert.True(t, proto.Equal(meta, got.GetMetadata()))
	})

	t.Run("drops metadata that pushes the message over the publisher's max payload", func(t *testing.T) {
		pub := &sizedPublisher{fakeEventPublisher: &fakeEventPublisher{enabled: true}, max: 1024}
		backend := newTestKVStorageBackend(pub)
		meta := &resourcepb.NotificationMetadata{
			Annotations: map[string]string{"big": strings.Repeat("x", 2048)},
			Generation:  3,
		}

		withMeta := event
		withMeta.Metadata = meta
		backend.publishWatchNotification(context.Background(), withMeta)

		require.Len(t, pub.payloads, 1)
		assert.LessOrEqual(t, len(pub.payloads[0]), 1024)
		var got resourcepb.WatchNotification
		require.NoError(t, proto.Unmarshal(pub.payloads[0], &got))
		assert.Nil(t, got.GetMetadata())
		assert.Equal(t, event.Name, got.GetName())
		assert.Equal(t, 1.0, testutil.ToFloat64(backend.watchPublisher.metrics.MetadataDropped.WithLabelValues(event.Group, event.Resource, string(event.Action))))
		assert.Equal(t, 1.0, testutil.ToFloat64(backend.watchPublisher.metrics.Published.WithLabelValues(event.Group, event.Resource, string(event.Action))))
	})

	t.Run("keeps metadata that fits the publisher's max payload", func(t *testing.T) {
		pub := &sizedPublisher{fakeEventPublisher: &fakeEventPublisher{enabled: true}, max: 1024}
		backend := newTestKVStorageBackend(pub)

		withMeta := event
		withMeta.Metadata = &resourcepb.NotificationMetadata{Generation: 3}
		backend.publishWatchNotification(context.Background(), withMeta)

		var got resourcepb.WatchNotification
		require.NoError(t, proto.Unmarshal(pub.payloads[0], &got))
		assert.Equal(t, int64(3), got.GetMetadata().GetGeneration())
	})

	t.Run("falls back to the default limit when the publisher cannot report one", func(t *testing.T) {
		assert.Equal(t, defaultMaxWatchNotificationBytes, newTestKVStorageBackend(&fakeEventPublisher{enabled: true}).watchPublisher.maxWatchNotificationBytes())
		assert.Equal(t, defaultMaxWatchNotificationBytes, newTestKVStorageBackend(&sizedPublisher{fakeEventPublisher: &fakeEventPublisher{}}).watchPublisher.maxWatchNotificationBytes())
	})

	t.Run("counts a successful publish", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := newTestKVStorageBackend(pub)
		metrics := backend.watchPublisher.metrics

		backend.publishWatchNotification(context.Background(), event)

		assert.Equal(t, 1.0, testutil.ToFloat64(metrics.Published.WithLabelValues(event.Group, event.Resource, string(event.Action))))
		assert.Equal(t, 0.0, testutil.ToFloat64(metrics.PublishFailures.WithLabelValues(event.Group, event.Resource, string(event.Action))))
	})

	t.Run("counts a failed publish as a failure, not as published", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true, err: errors.New("bus unavailable")}
		backend := newTestKVStorageBackend(pub)
		metrics := backend.watchPublisher.metrics

		backend.publishWatchNotification(context.Background(), event)

		assert.Equal(t, 0.0, testutil.ToFloat64(metrics.Published.WithLabelValues(event.Group, event.Resource, string(event.Action))))
		assert.Equal(t, 1.0, testutil.ToFloat64(metrics.PublishFailures.WithLabelValues(event.Group, event.Resource, string(event.Action))))
	})

	t.Run("does nothing when the publisher is disabled", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: false}
		backend := newTestKVStorageBackend(pub)

		backend.publishWatchNotification(context.Background(), event)

		assert.Empty(t, pub.subjects)
	})

	t.Run("does nothing when no publisher is configured", func(t *testing.T) {
		backend := newTestKVStorageBackend(nil)
		// Must not panic on a nil publisher.
		backend.publishWatchNotification(context.Background(), event)
	})
}

var testSpec = WatchMetadataSpec{
	Labels:      []string{"a", "b"},
	Annotations: []string{"x"},
	Finalizers:  []string{"f"},
}

func TestBuildWatchMetadata(t *testing.T) {
	created := time.UnixMilli(1000)
	deleted := metav1.NewTime(time.UnixMilli(2000))
	mk := func(deletion *metav1.Time) utils.GrafanaMetaAccessor {
		u := &unstructured.Unstructured{Object: map[string]any{}}
		u.SetName("n")
		u.SetLabels(map[string]string{"a": "1", "other": "x"})
		u.SetAnnotations(map[string]string{"x": "y", "other": "z"})
		u.SetFinalizers([]string{"f", "other"})
		u.SetGeneration(3)
		u.SetCreationTimestamp(metav1.NewTime(created))
		u.SetDeletionTimestamp(deletion)
		m, err := utils.MetaAccessor(u)
		require.NoError(t, err)
		return m
	}

	t.Run("keeps only allowlisted values", func(t *testing.T) {
		got := buildWatchMetadata(testSpec, mk(&deleted))
		assert.True(t, proto.Equal(&resourcepb.NotificationMetadata{
			Labels:                  map[string]string{"a": "1"},
			Annotations:             map[string]string{"x": "y"},
			Finalizers:              []string{"f"},
			Generation:              3,
			CreationTimestampMillis: 1000,
			DeletionTimestampMillis: 2000,
		}, got))
	})

	t.Run("leaves the deletion timestamp empty when unset", func(t *testing.T) {
		assert.Zero(t, buildWatchMetadata(testSpec, mk(nil)).GetDeletionTimestampMillis())
	})

	t.Run("nil object yields nil", func(t *testing.T) {
		assert.Nil(t, buildWatchMetadata(testSpec, nil))
	})
}

// registerTestWatchMetadata registers spec for gr until the test ends.
func registerTestWatchMetadata(t *testing.T, gr schema.GroupResource, spec WatchMetadataSpec) {
	t.Helper()
	RegisterWatchMetadata(gr, spec)
	t.Cleanup(func() {
		watchMetadataSpecsMu.Lock()
		defer watchMetadataSpecsMu.Unlock()
		delete(watchMetadataSpecs, gr)
	})
}

func TestNewWatchMetadata(t *testing.T) {
	u := &unstructured.Unstructured{Object: map[string]any{}}
	u.SetName("n")
	u.SetLabels(map[string]string{"a": "1", "other": "x"})
	obj, err := utils.MetaAccessor(u)
	require.NoError(t, err)

	registered := schema.GroupResource{Group: "example.grafana.app", Resource: "examples"}
	registerTestWatchMetadata(t, registered, testSpec)

	t.Run("a registered resource gets metadata", func(t *testing.T) {
		assert.Equal(t, map[string]string{"a": "1"}, NewWatchMetadata(registered, obj).GetLabels())
	})

	t.Run("an unregistered resource yields nil", func(t *testing.T) {
		gr := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
		assert.Nil(t, NewWatchMetadata(gr, obj))
	})
}

func TestRegisterWatchMetadata(t *testing.T) {
	gr := schema.GroupResource{Group: "example.grafana.app", Resource: "registered"}
	registerTestWatchMetadata(t, gr, testSpec)

	got, ok := WatchMetadataFor(gr)
	require.True(t, ok)
	assert.Equal(t, testSpec, got)

	assert.Panics(t, func() { RegisterWatchMetadata(gr, WatchMetadataSpec{}) }, "a second registration of one resource panics")
}

func TestWatchNotificationAllowlists(t *testing.T) {
	t.Run("labels and annotations keep only allowlisted keys", func(t *testing.T) {
		in := map[string]string{"other": "x"}
		assert.Nil(t, filterKeys(in, testSpec.Labels), "nothing allowlisted is nil, not an empty map")
		assert.Nil(t, filterKeys(nil, testSpec.Labels))

		in["a"] = "v"
		assert.Equal(t, map[string]string{"a": "v"}, filterKeys(in, testSpec.Labels))
	})

	t.Run("finalizers keep only allowlisted entries", func(t *testing.T) {
		assert.Nil(t, filterFinalizers([]string{"other"}, testSpec.Finalizers))
		assert.Nil(t, filterFinalizers(nil, testSpec.Finalizers))
		assert.Equal(t, []string{"f"}, filterFinalizers([]string{"other", "f"}, testSpec.Finalizers))
	})
}
