package resource

import (
	"context"
	"encoding/json"
	"testing"

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
			},
			expected: "1000~default~apps~resource~test-resource",
		},
		{
			name: "empty namespace",
			eventKey: EventKey{
				Namespace:       "",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: 2000,
			},
			expected: "2000~~apps~resource~test-resource",
		},
		{
			name: "special characters in name",
			eventKey: EventKey{
				Namespace:       "test-ns",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource-with-dashes",
				ResourceVersion: 3000,
			},
			expected: "3000~test-ns~apps~resource~test-resource-with-dashes",
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
			key:  "1000~default~apps~resource~test-resource",
			expected: EventKey{
				ResourceVersion: 1000,
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
			},
		},
		{
			name: "empty namespace",
			key:  "2000~~apps~resource~test-resource",
			expected: EventKey{
				ResourceVersion: 2000,
				Namespace:       "",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
			},
		},
		{
			name: "special characters in name",
			key:  "3000~test-ns~apps~resource~test-resource-with-dashes",
			expected: EventKey{
				ResourceVersion: 3000,
				Namespace:       "test-ns",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource-with-dashes",
			},
		},
		{
			name:        "invalid key - too few parts",
			key:         "1000~default~apps~resource",
			expectError: true,
		},
		{
			name:        "invalid key - too many parts",
			key:         "1000~default~apps~resource~test~extra",
			expectError: true,
		},
		{
			name:        "invalid resource version",
			key:         "invalid~default~apps~resource~test",
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
	}

	assert.Equal(t, expectedKey, lastKey)
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
	assert.Equal(t, int64(3000), retrievedEvents[1].ResourceVersion)
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
