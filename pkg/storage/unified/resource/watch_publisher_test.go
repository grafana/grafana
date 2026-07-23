package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fakeEventPublisher records what publishWatchNotification hands to the bus.
type fakeEventPublisher struct {
	enabled  bool
	err      error
	subjects []string
	payloads [][]byte
}

func (f *fakeEventPublisher) Enabled() bool { return f.enabled }

func (f *fakeEventPublisher) Publish(_ context.Context, subject string, data []byte) error {
	f.subjects = append(f.subjects, subject)
	f.payloads = append(f.payloads, data)
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
	}

	t.Run("publishes a metadata-only notification on the resource subject", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}

		backend.publishWatchNotification(context.Background(), event)

		require.Len(t, pub.subjects, 1)
		assert.Equal(t, "provisioning.grafana.app.default.repositories", pub.subjects[0])

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
	})

	t.Run("does nothing when the publisher is disabled", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: false}
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}

		backend.publishWatchNotification(context.Background(), event)

		assert.Empty(t, pub.subjects)
	})

	t.Run("does nothing when no publisher is configured", func(t *testing.T) {
		backend := &kvStorageBackend{log: log.NewNopLogger()}
		// Must not panic on a nil publisher.
		backend.publishWatchNotification(context.Background(), event)
	})
}
