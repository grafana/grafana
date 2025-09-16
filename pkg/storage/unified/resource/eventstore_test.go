package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestEventStore(t *testing.T) *eventStore {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	kv := NewBadgerKV(db)
	return newEventStore(kv)
}

func TestNewEventStore(t *testing.T) {
	store := setupTestEventStore(t)
	assert.NotNil(t, store.kv)
}

func TestEventKey_String(t *testing.T) {
	tests := []struct {
		name     string
		eventKey EventKey
		expected string
	}{
		{
			name: "basic event key",
			eventKey: EventKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: 1000,
				Action:          "created",
			},
			expected: "1000~default~apps~resource~test-resource~created",
		},
		{
			name: "empty namespace",
			eventKey: EventKey{
				Namespace:       "",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: 2000,
				Action:          "updated",
			},
			expected: "2000~~apps~resource~test-resource~updated",
		},
		{
			name: "special characters in name",
			eventKey: EventKey{
				Namespace:       "test-ns",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource-with-dashes",
				ResourceVersion: 3000,
				Action:          "deleted",
			},
			expected: "3000~test-ns~apps~resource~test-resource-with-dashes~deleted",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.eventKey.String()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEventKey_Validate(t *testing.T) {
	tests := []struct {
		name        string
		key         string
		expected    EventKey
		expectError bool
	}{
		{
			name: "valid key",
			key:  "1000~default~apps~resource~test-resource~created",
			expected: EventKey{
				ResourceVersion: 1000,
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				Action:          "created",
			},
		},
		{
			name: "empty namespace",
			key:  "2000~~apps~resource~test-resource~updated",
			expected: EventKey{
				ResourceVersion: 2000,
				Namespace:       "",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				Action:          "updated",
			},
		},
		{
			name: "special characters in name",
			key:  "3000~test-ns~apps~resource~test-resource-with-dashes~updated",
			expected: EventKey{
				ResourceVersion: 3000,
				Namespace:       "test-ns",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource-with-dashes",
				Action:          "updated",
			},
		},
		{
			name:        "invalid key - too few parts",
			key:         "1000~default~apps~resource",
			expectError: true,
		},
		{
			name:        "invalid key - too many parts",
			key:         "1000~default~apps~resource~test~extra~parts",
			expectError: true,
		},
		{
			name:        "invalid resource version",
			key:         "invalid~default~apps~resource~test~cerated",
			expectError: true,
		},
		{
			name:        "empty key",
			key:         "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseEventKey(tt.key)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, EventKey{}, result)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestEventStore_ParseEventKey(t *testing.T) {
	originalKey := EventKey{
		ResourceVersion: 1234567890,
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource",
		Action:          "created",
	}

	// Convert to string and back
	keyString := originalKey.String()
	parsedKey, err := ParseEventKey(keyString)

	require.NoError(t, err)
	assert.Equal(t, originalKey, parsedKey)
}

func TestEventStore_Save_Get(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	event := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource",
		ResourceVersion: 1000,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      999,
	}

	// Save the event
	err := store.Save(ctx, event)
	require.NoError(t, err)

	// Get the event back
	eventKey := EventKey{
		Namespace:       event.Namespace,
		Group:           event.Group,
		Resource:        event.Resource,
		Name:            event.Name,
		ResourceVersion: event.ResourceVersion,
		Action:          event.Action,
	}

	retrievedEvent, err := store.Get(ctx, eventKey)
	require.NoError(t, err)
	assert.Equal(t, event, retrievedEvent)
}

func TestEventStore_Get_NotFound(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	nonExistentKey := EventKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "non-existent",
		ResourceVersion: 9999,
		Action:          "created",
	}

	_, err := store.Get(ctx, nonExistentKey)
	assert.Error(t, err)
}

func TestEventStore_LastEventKey(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// Test when no events exist
	_, err := store.LastEventKey(ctx)
	assert.Error(t, err)
	assert.Equal(t, ErrNotFound, err)

	// Add some events with different resource versions
	events := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-1",
			ResourceVersion: 1000,
			Action:          DataActionCreated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-2",
			ResourceVersion: 3000, // highest
			Action:          DataActionCreated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-3",
			ResourceVersion: 2000,
			Action:          DataActionCreated,
		},
	}

	// Save all events
	for _, event := range events {
		err := store.Save(ctx, event)
		require.NoError(t, err)
	}

	// Get the last event key (should be the one with highest RV)
	lastKey, err := store.LastEventKey(ctx)
	require.NoError(t, err)

	expectedKey := EventKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-2",
		ResourceVersion: 3000,
		Action:          "created",
	}

	assert.Equal(t, expectedKey, lastKey)
}

func TestEventStore_ListKeysSince(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// Add events with different resource versions
	events := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-1",
			ResourceVersion: 1000,
			Action:          DataActionCreated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-2",
			ResourceVersion: 2000,
			Action:          DataActionUpdated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-3",
			ResourceVersion: 3000,
			Action:          DataActionDeleted,
		},
	}

	// Save all events
	for _, event := range events {
		err := store.Save(ctx, event)
		require.NoError(t, err)
	}

	// List events since RV 1500 (should get events with RV 2000 and 3000)
	retrievedEvents := make([]string, 0, 2)
	for eventKey, err := range store.ListKeysSince(ctx, 1500) {
		require.NoError(t, err)
		retrievedEvents = append(retrievedEvents, eventKey)
	}

	// Should return events in ascending order of resource version
	require.Len(t, retrievedEvents, 2)
	evt1, err := ParseEventKey(retrievedEvents[0])
	require.NoError(t, err)
	assert.Equal(t, int64(2000), evt1.ResourceVersion)
	assert.Equal(t, "test-2", evt1.Name)
	evt2, err := ParseEventKey(retrievedEvents[1])
	require.NoError(t, err)
	assert.Equal(t, int64(3000), evt2.ResourceVersion)
	assert.Equal(t, "test-3", evt2.Name)
}

func TestEventStore_ListSince(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// Add events with different resource versions
	events := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-1",
			ResourceVersion: 1000,
			Action:          DataActionCreated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-2",
			ResourceVersion: 2000,
			Action:          DataActionUpdated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-3",
			ResourceVersion: 3000,
			Action:          DataActionDeleted,
		},
	}

	// Save all events
	for _, event := range events {
		err := store.Save(ctx, event)
		require.NoError(t, err)
	}

	// List events since RV 1500 (should get events with RV 2000 and 3000)
	retrievedEvents := make([]Event, 0, 2)
	for event, err := range store.ListSince(ctx, 1500) {
		require.NoError(t, err)
		retrievedEvents = append(retrievedEvents, event)
	}

	// Should return events in descending order of resource version
	require.Len(t, retrievedEvents, 2)
	assert.Equal(t, int64(2000), retrievedEvents[0].ResourceVersion)
	assert.Equal(t, "test-2", retrievedEvents[0].Name)
	assert.Equal(t, DataActionUpdated, retrievedEvents[0].Action)
	assert.Equal(t, int64(3000), retrievedEvents[1].ResourceVersion)
	assert.Equal(t, "test-3", retrievedEvents[1].Name)
	assert.Equal(t, DataActionDeleted, retrievedEvents[1].Action)
}

func TestEventStore_ListSince_Empty(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// List events when store is empty
	retrievedEvents := make([]Event, 0)
	for event, err := range store.ListSince(ctx, 0) {
		require.NoError(t, err)
		retrievedEvents = append(retrievedEvents, event)
	}

	assert.Empty(t, retrievedEvents)
}

func TestEvent_JSONSerialization(t *testing.T) {
	event := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource",
		ResourceVersion: 1000,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      999,
	}

	// Serialize to JSON
	data, err := json.Marshal(event)
	require.NoError(t, err)

	// Deserialize from JSON
	var deserializedEvent Event
	err = json.Unmarshal(data, &deserializedEvent)
	require.NoError(t, err)

	assert.Equal(t, event, deserializedEvent)
}

func TestEventKey_Struct(t *testing.T) {
	key := EventKey{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource",
		ResourceVersion: 1234567890,
		Action:          "created",
	}

	assert.Equal(t, "test-namespace", key.Namespace)
	assert.Equal(t, "apps", key.Group)
	assert.Equal(t, "resource", key.Resource)
	assert.Equal(t, "test-resource", key.Name)
	assert.Equal(t, int64(1234567890), key.ResourceVersion)
}

func TestEventStore_Save_InvalidJSON(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// This should work fine as the Event struct should be serializable
	event := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test",
		ResourceVersion: 1000,
		Action:          DataActionCreated,
	}

	err := store.Save(ctx, event)
	assert.NoError(t, err)
}

func TestEventStore_CleanupOldEvents(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	now := time.Now()
	oldRV := snowflakeFromTime(now.Add(-48 * time.Hour))   // 48 hours ago
	recentRV := snowflakeFromTime(now.Add(-1 * time.Hour)) // 1 hour ago

	oldEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "old-resource",
		ResourceVersion: oldRV,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      999,
	}

	recentEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "recent-resource",
		ResourceVersion: recentRV,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      999,
	}

	// Save both events
	err := store.Save(ctx, oldEvent)
	require.NoError(t, err)
	err = store.Save(ctx, recentEvent)
	require.NoError(t, err)

	// Verify both events exist
	_, err = store.Get(ctx, EventKey{
		Namespace:       oldEvent.Namespace,
		Group:           oldEvent.Group,
		Resource:        oldEvent.Resource,
		Name:            oldEvent.Name,
		ResourceVersion: oldEvent.ResourceVersion,
		Action:          oldEvent.Action,
	})
	require.NoError(t, err)

	_, err = store.Get(ctx, EventKey{
		Namespace:       recentEvent.Namespace,
		Group:           recentEvent.Group,
		Resource:        recentEvent.Resource,
		Name:            recentEvent.Name,
		ResourceVersion: recentEvent.ResourceVersion,
		Action:          recentEvent.Action,
	})
	require.NoError(t, err)

	// Clean up events older than 24 hours
	deletedCount, err := store.CleanupOldEvents(ctx, time.Now().Add(-24*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 1, deletedCount, "Should have deleted 1 old event")

	// Verify old event was deleted
	_, err = store.Get(ctx, EventKey{
		Namespace:       oldEvent.Namespace,
		Group:           oldEvent.Group,
		Resource:        oldEvent.Resource,
		Name:            oldEvent.Name,
		ResourceVersion: oldEvent.ResourceVersion,
		Action:          oldEvent.Action,
	})
	assert.Error(t, err, "Old event should have been deleted")

	// Verify recent event still exists
	_, err = store.Get(ctx, EventKey{
		Namespace:       recentEvent.Namespace,
		Group:           recentEvent.Group,
		Resource:        recentEvent.Resource,
		Name:            recentEvent.Name,
		ResourceVersion: recentEvent.ResourceVersion,
		Action:          recentEvent.Action,
	})
	require.NoError(t, err, "Recent event should still exist")
}

func TestEventStore_CleanupOldEvents_NoOldEvents(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// Create an event 1 hour old
	rv := snowflakeFromTime(time.Now().Add(-1 * time.Hour))
	event := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "recent-resource",
		ResourceVersion: rv,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      999,
	}

	err := store.Save(ctx, event)
	require.NoError(t, err)

	// Clean up events older than 24 hours
	deletedCount, err := store.CleanupOldEvents(ctx, time.Now().Add(-24*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 0, deletedCount, "Should not have deleted any events")

	// Verify event still exists
	_, err = store.Get(ctx, EventKey{
		Namespace:       event.Namespace,
		Group:           event.Group,
		Resource:        event.Resource,
		Name:            event.Name,
		ResourceVersion: event.ResourceVersion,
		Action:          event.Action,
	})
	require.NoError(t, err, "Recent event should still exist")
}

func TestEventStore_CleanupOldEvents_EmptyStore(t *testing.T) {
	ctx := context.Background()
	store := setupTestEventStore(t)

	// Clean up events from empty store
	deletedCount, err := store.CleanupOldEvents(ctx, time.Now().Add(-24*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 0, deletedCount, "Should not have deleted any events from empty store")
}
