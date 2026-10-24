package resource

import (
	"context"
	"errors"
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
	return &kvStorageBackend{log: &logging.NoOpLogger{}, eventPublisher: pub, metrics: newKVBackendMetrics(nil)}
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

		backend.publishWatchNotification(context.Background(), event, nil)

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

	t.Run("carries labels and ObjectMeta fields when given metadata", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := newTestKVStorageBackend(pub)

		backend.publishWatchNotification(context.Background(), event, &watchMetadata{
			Labels:            map[string]string{"encrypted": "true"},
			PreviousLabels:    map[string]string{"encrypted": "false"},
			Generation:        3,
			CreationTimestamp: 1000,
			DeletionTimestamp: 2000,
			Finalizers:        []string{"f"},
			Annotations:       map[string]string{"k": "v"},
		})

		var got resourcepb.WatchNotification
		require.NoError(t, proto.Unmarshal(pub.payloads[0], &got))
		assert.Equal(t, map[string]string{"encrypted": "true"}, got.GetLabels())
		assert.Equal(t, map[string]string{"encrypted": "false"}, got.GetPreviousLabels())
		assert.Equal(t, int64(3), got.GetGeneration())
		assert.Equal(t, int64(1000), got.GetCreationTimestampMillis())
		assert.Equal(t, int64(2000), got.GetDeletionTimestampMillis())
		assert.Equal(t, []string{"f"}, got.GetFinalizers())
		assert.Equal(t, map[string]string{"k": "v"}, got.GetAnnotations())
	})

	t.Run("counts a successful publish", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := newTestKVStorageBackend(pub)
		metrics := backend.metrics

		backend.publishWatchNotification(context.Background(), event, nil)

		assert.Equal(t, 1.0, testutil.ToFloat64(metrics.WatchNotificationsPublished.WithLabelValues(event.Group, event.Resource, string(event.Action))))
		assert.Equal(t, 0.0, testutil.ToFloat64(metrics.WatchNotificationPublishFailures.WithLabelValues(event.Group, event.Resource, string(event.Action))))
	})

	t.Run("counts a failed publish as a failure, not as published", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true, err: errors.New("bus unavailable")}
		backend := newTestKVStorageBackend(pub)
		metrics := backend.metrics

		backend.publishWatchNotification(context.Background(), event, nil)

		assert.Equal(t, 0.0, testutil.ToFloat64(metrics.WatchNotificationsPublished.WithLabelValues(event.Group, event.Resource, string(event.Action))))
		assert.Equal(t, 1.0, testutil.ToFloat64(metrics.WatchNotificationPublishFailures.WithLabelValues(event.Group, event.Resource, string(event.Action))))
	})

	t.Run("does nothing when the publisher is disabled", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: false}
		backend := newTestKVStorageBackend(pub)

		backend.publishWatchNotification(context.Background(), event, nil)

		assert.Empty(t, pub.subjects)
	})

	t.Run("does nothing when no publisher is configured", func(t *testing.T) {
		backend := newTestKVStorageBackend(nil)
		// Must not panic on a nil publisher.
		backend.publishWatchNotification(context.Background(), event, nil)
	})
}

var (
	settingsGR   = schema.GroupResource{Group: "setting.grafana.app", Resource: "settings"}
	settingsSpec = watchNotificationSpecs[settingsGR]
)

func TestNewWatchMetadata(t *testing.T) {
	created := time.UnixMilli(1000)
	deleted := metav1.NewTime(time.UnixMilli(2000))
	mk := func(labels map[string]string, deletion *metav1.Time) utils.GrafanaMetaAccessor {
		u := &unstructured.Unstructured{Object: map[string]any{}}
		u.SetName("n")
		u.SetLabels(labels)
		u.SetGeneration(3)
		u.SetFinalizers([]string{settingsSpec.Finalizers[0], "other"})
		u.SetAnnotations(map[string]string{settingsSpec.Annotations[0]: "[\"sv\"]", "other": "x"})
		u.SetCreationTimestamp(metav1.NewTime(created))
		u.SetDeletionTimestamp(deletion)
		m, err := utils.MetaAccessor(u)
		require.NoError(t, err)
		return m
	}

	t.Run("reads the object and previous labels", func(t *testing.T) {
		got := newWatchMetadata(settingsGR, mk(map[string]string{"encrypted": "true", "other": "x"}, &deleted), mk(map[string]string{"encrypted": "false"}, nil))
		assert.Equal(t, &watchMetadata{
			Labels:            map[string]string{"encrypted": "true"}, // "other" is not allowlisted
			PreviousLabels:    map[string]string{"encrypted": "false"},
			Generation:        3,
			CreationTimestamp: 1000,
			DeletionTimestamp: 2000,
			Finalizers:        []string{settingsSpec.Finalizers[0]},                       // "other" is not allowlisted
			Annotations:       map[string]string{settingsSpec.Annotations[0]: "[\"sv\"]"}, // "other" is not allowlisted
		}, got)
	})

	t.Run("leaves previous labels and deletion timestamp empty on create", func(t *testing.T) {
		got := newWatchMetadata(settingsGR, mk(nil, nil), nil)
		assert.Nil(t, got.PreviousLabels)
		assert.Zero(t, got.DeletionTimestamp)
	})

	t.Run("a resource without an allowlist entry yields nil", func(t *testing.T) {
		other := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
		assert.Nil(t, newWatchMetadata(other, mk(map[string]string{"encrypted": "true"}, nil), nil))
	})

	t.Run("nil object yields nil", func(t *testing.T) {
		assert.Nil(t, newWatchMetadata(settingsGR, nil, nil))
	})
}

func TestWatchNotificationAllowlists(t *testing.T) {
	t.Run("labels and annotations keep only allowlisted keys", func(t *testing.T) {
		for name, allowed := range map[string][]string{"labels": settingsSpec.Labels, "annotations": settingsSpec.Annotations} {
			t.Run(name, func(t *testing.T) {
				in := map[string]string{"not-allowlisted": "x"}
				assert.Nil(t, filterKeys(in, allowed), "nothing allowlisted is nil, not an empty map")
				assert.Nil(t, filterKeys(nil, allowed))

				in[allowed[0]] = "v"
				assert.Equal(t, map[string]string{allowed[0]: "v"}, filterKeys(in, allowed))
			})
		}
	})

	t.Run("finalizers keep only allowlisted entries", func(t *testing.T) {
		assert.Nil(t, filterFinalizers([]string{"other"}, settingsSpec.Finalizers))
		assert.Nil(t, filterFinalizers(nil, settingsSpec.Finalizers))
		assert.Equal(t, []string{settingsSpec.Finalizers[0]},
			filterFinalizers([]string{"other", settingsSpec.Finalizers[0]}, settingsSpec.Finalizers))
	})

	t.Run("previous labels are filtered too", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]any{}}
		obj.SetName("n")
		prev := obj.DeepCopy()
		prev.SetLabels(map[string]string{"encrypted": "true", "other": "x"})
		om, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		pm, err := utils.MetaAccessor(prev)
		require.NoError(t, err)

		got := newWatchMetadata(settingsGR, om, pm)
		assert.Equal(t, map[string]string{"encrypted": "true"}, got.PreviousLabels)
	})
}
