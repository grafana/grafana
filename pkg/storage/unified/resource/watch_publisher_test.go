package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
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

func TestActionToWatchEventType(t *testing.T) {
	assert.Equal(t, resourcewatch.Added, actionToWatchEventType(DataActionCreated))
	assert.Equal(t, resourcewatch.Modified, actionToWatchEventType(DataActionUpdated))
	assert.Equal(t, resourcewatch.Deleted, actionToWatchEventType(DataActionDeleted))
	// An unknown action must not masquerade as a real change.
	assert.Equal(t, resourcewatch.EventType(""), actionToWatchEventType("bogus"))
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
	}

	t.Run("publishes a metadata-only notification on the resource subject", func(t *testing.T) {
		pub := &fakeEventPublisher{enabled: true}
		backend := &kvStorageBackend{log: log.NewNopLogger(), eventPublisher: pub}

		backend.publishWatchNotification(context.Background(), event)

		require.Len(t, pub.subjects, 1)
		assert.Equal(t, "provisioning.grafana.app.default.repositories", pub.subjects[0])

		got, err := resourcewatch.UnmarshalEvent(pub.payloads[0])
		require.NoError(t, err)
		assert.Equal(t, resourcewatch.Event{
			Type:            resourcewatch.Modified,
			Group:           event.Group,
			Resource:        event.Resource,
			Namespace:       event.Namespace,
			Name:            event.Name,
			ResourceVersion: event.ResourceVersion,
			Folder:          event.Folder,
		}, got)
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
