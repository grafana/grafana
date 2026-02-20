package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupTestEventStore(t *testing.T) *eventStore {
	return newEventStore(setupBadgerKV(t))
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupTestEventStoreSqlKv(t *testing.T) *eventStore {
	return newEventStore(setupSqlKV(t))
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
				Folder:          "test-folder",
			},
			expected: "1000~default~apps~resource~test-resource~created~test-folder",
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
				Folder:          "test-folder",
			},
			expected: "2000~~apps~resource~test-resource~updated~test-folder",
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
				Folder:          "test-folder",
			},
			expected: "3000~test-ns~apps~resource~test-resource-with-dashes~deleted~test-folder",
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
			key:  "1000~default~apps~resource~test-resource~created~test-folder",
			expected: EventKey{
				ResourceVersion: 1000,
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				Action:          "created",
				Folder:          "test-folder",
			},
		},
		{
			name: "empty namespace",
			key:  "2000~~apps~resource~test-resource~updated~",
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
			key:  "3000~test-ns~apps~resource~test-resource-with-dashes~updated~",
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
			key:         "1000~default~apps~resource~",
			expectError: true,
		},
		{
			name:        "invalid key - too many parts",
			key:         "1000~default~apps~resource~test~extra~parts~",
			expectError: true,
		},
		{
			name:        "invalid resource version",
			key:         "invalid~default~apps~resource~test~cerated~",
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

func runEventStoreTestWith(t *testing.T, storeName string, newStoreFn func(*testing.T) *eventStore, testFn func(*testing.T, context.Context, *eventStore)) {
	t.Run(storeName, func(t *testing.T) {
		ctx := context.Background()
		store := newStoreFn(t)
		testFn(t, ctx, store)
	})
}

func TestIntegrationEventStore_Save_Get(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreSaveGet)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreSaveGet)
}

func testEventStoreSaveGet(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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
		Folder:          event.Folder,
	}

	retrievedEvent, err := store.Get(ctx, eventKey)
	require.NoError(t, err)
	assert.Equal(t, event, retrievedEvent)
}

func TestIntegrationEventStore_Get_NotFound(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreGetNotFound)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreGetNotFound)
}

func testEventStoreGetNotFound(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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

func TestIntegrationEventStore_LastEventKey(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreLastEventKey)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreLastEventKey)
}

func testEventStoreLastEventKey(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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

func TestIntegrationEventStore_ListKeysSince(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreListKeysSince)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreListKeysSince)
}

func testEventStoreListKeysSince(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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

	{
		// List events since RV 1500 (should get events with RV 2000 and 3000)
		retrievedEvents := make([]string, 0, 2)
		for eventKey, err := range store.ListKeysSince(ctx, 1500, SortOrderAsc) {
			require.NoError(t, err)
			retrievedEvents = append(retrievedEvents, eventKey)
		}

		// Should return events in ASCENDING order of resource version
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

	{
		// List events since RV 1500 (should get events with RV 2000 and 3000)
		retrievedEvents := make([]string, 0, 2)
		for eventKey, err := range store.ListKeysSince(ctx, 1500, SortOrderDesc) {
			require.NoError(t, err)
			retrievedEvents = append(retrievedEvents, eventKey)
		}

		// Should return events in DESCENDING order of resource version
		require.Len(t, retrievedEvents, 2)
		evt1, err := ParseEventKey(retrievedEvents[0])
		require.NoError(t, err)
		assert.Equal(t, int64(3000), evt1.ResourceVersion)
		assert.Equal(t, "test-3", evt1.Name)
		evt2, err := ParseEventKey(retrievedEvents[1])
		require.NoError(t, err)
		assert.Equal(t, int64(2000), evt2.ResourceVersion)
		assert.Equal(t, "test-2", evt2.Name)
	}
}

func TestIntegrationEventStore_ListSince(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreListSince)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreListSince)
}

func testEventStoreListSince(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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
	for event, err := range store.ListSince(ctx, 1500, SortOrderAsc) {
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

func TestIntegrationEventStore_ListSince_Empty(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreListSinceEmpty)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreListSinceEmpty)
}

func testEventStoreListSinceEmpty(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
	// List events when store is empty
	retrievedEvents := make([]Event, 0) //nolint:prealloc
	for event, err := range store.ListSince(ctx, 0, SortOrderAsc) {
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

func TestIntegrationEventStore_Save_InvalidJSON(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreSaveInvalidJSON)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreSaveInvalidJSON)
}

func testEventStoreSaveInvalidJSON(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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

func TestIntegrationEventStore_CleanupOldEvents(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreCleanupOldEvents)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreCleanupOldEvents)
}

func testEventStoreCleanupOldEvents(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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
		Folder:          oldEvent.Folder,
	})
	require.NoError(t, err)

	_, err = store.Get(ctx, EventKey{
		Namespace:       recentEvent.Namespace,
		Group:           recentEvent.Group,
		Resource:        recentEvent.Resource,
		Name:            recentEvent.Name,
		ResourceVersion: recentEvent.ResourceVersion,
		Action:          recentEvent.Action,
		Folder:          recentEvent.Folder,
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
		Folder:          recentEvent.Folder,
	})
	require.NoError(t, err, "Recent event should still exist")
}

func TestIntegrationEventStore_CleanupOldEvents_NoOldEvents(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreCleanupOldEventsNoOldEvents)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreCleanupOldEventsNoOldEvents)
}

func testEventStoreCleanupOldEventsNoOldEvents(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
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
		Folder:          event.Folder,
	})
	require.NoError(t, err, "Recent event should still exist")
}

func TestIntegrationEventStore_CleanupOldEvents_EmptyStore(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreCleanupOldEventsEmptyStore)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreCleanupOldEventsEmptyStore)
}

func testEventStoreCleanupOldEventsEmptyStore(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
	// Clean up events from empty store
	deletedCount, err := store.CleanupOldEvents(ctx, time.Now().Add(-24*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 0, deletedCount, "Should not have deleted any events from empty store")
}

func TestIntegrationEventStore_BatchDelete(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreBatchDelete)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreBatchDelete)
}

func testEventStoreBatchDelete(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
	// Create multiple events (more than batch size to test batching)
	eventKeys := make([]string, 75)
	for i := 0; i < 75; i++ {
		event := Event{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "deployments",
			Name:            "test-deployment",
			ResourceVersion: int64(1000 + i),
			Action:          DataActionCreated,
			Folder:          "test-folder",
			PreviousRV:      int64(999 + i),
		}
		err := store.Save(ctx, event)
		require.NoError(t, err)

		eventKeys[i] = EventKey{
			Namespace:       event.Namespace,
			Group:           event.Group,
			Resource:        event.Resource,
			Name:            event.Name,
			ResourceVersion: event.ResourceVersion,
			Action:          event.Action,
			Folder:          event.Folder,
		}.String()
	}

	// Batch delete all events
	err := store.batchDelete(ctx, eventKeys)
	require.NoError(t, err)

	// Verify all events were deleted
	for i := 0; i < 75; i++ {
		_, err := store.Get(ctx, EventKey{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "deployments",
			Name:            "test-deployment",
			ResourceVersion: int64(1000 + i),
			Action:          DataActionCreated,
			Folder:          "test-folder",
		})
		require.Error(t, err, "Event should have been deleted")
	}
}

func TestSubtractDurationFromSnowflake(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name    string
		addTime time.Duration
	}{
		{
			name:    "subtract 1 hour",
			addTime: -1 * time.Hour,
		},
		{
			name:    "subtract 2 hours",
			addTime: -2 * time.Hour,
		},
		{
			name:    "subtract 24 hours",
			addTime: -24 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Generate a snowflake from the base time
			baseSnowflake := snowflakeFromTime(baseTime)

			// Subtract the duration
			resultSnowflake := subtractDurationFromSnowflake(baseSnowflake, tt.addTime)

			// Convert back to timestamp and verify
			// Extract timestamp from the result snowflake
			timestamp := snowflake.ID(resultSnowflake).Time()
			resultTime := time.Unix(0, timestamp*int64(time.Millisecond))

			// Compare with expected time (allowing for small differences due to snowflake precision)
			expectedMillis := baseTime.Add(-tt.addTime).UnixMilli()
			resultMillis := resultTime.UnixMilli()
			assert.InDelta(t, expectedMillis, resultMillis, 1,
				"Expected time %v, got %v (diff: %d ms)",
				baseTime, resultTime, expectedMillis-resultMillis)
		})
	}
}

func TestSnowflakeFromTime(t *testing.T) {
	testTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	snowflakeID := snowflakeFromTime(testTime)

	// Extract timestamp and verify it matches
	timestamp := snowflake.ID(snowflakeID).Time()
	reconstructedTime := time.Unix(0, timestamp*int64(time.Millisecond))

	// The times should match at millisecond precision
	expectedMillis := testTime.UnixMilli()
	resultMillis := reconstructedTime.UnixMilli()

	assert.Equal(t, expectedMillis, resultMillis, "Snowflake timestamp should match original time at millisecond precision")
}

func TestIntegrationListKeysSince_WithSnowflakeTime(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testListKeysSinceWithSnowflakeTime)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testListKeysSinceWithSnowflakeTime)
}

func testListKeysSinceWithSnowflakeTime(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
	// Create events with snowflake-based resource versions at different times
	now := time.Now()
	events := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-1",
			ResourceVersion: snowflakeFromTime(now.Add(-2 * time.Hour)),
			Action:          DataActionCreated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-2",
			ResourceVersion: snowflakeFromTime(now.Add(-1 * time.Hour)),
			Action:          DataActionUpdated,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-3",
			ResourceVersion: snowflakeFromTime(now.Add(-30 * time.Minute)),
			Action:          DataActionDeleted,
		},
	}

	// Save all events
	for _, event := range events {
		err := store.Save(ctx, event)
		require.NoError(t, err)
	}

	// List events since 90 minutes ago using subtractDurationFromSnowflake
	sinceRV := subtractDurationFromSnowflake(snowflakeFromTime(now), 90*time.Minute)
	retrievedEvents := make([]string, 0) //nolint:prealloc
	for eventKey, err := range store.ListKeysSince(ctx, sinceRV, SortOrderAsc) {
		require.NoError(t, err)
		retrievedEvents = append(retrievedEvents, eventKey)
	}

	// Should return events from the last hour and 30 minutes
	require.Len(t, retrievedEvents, 2)
	evt1, err := ParseEventKey(retrievedEvents[0])
	require.NoError(t, err)
	assert.Equal(t, "test-2", evt1.Name)
	evt2, err := ParseEventKey(retrievedEvents[1])
	require.NoError(t, err)
	assert.Equal(t, "test-3", evt2.Name)

	// List events since 30 minutes ago using subtractDurationFromSnowflake
	sinceRV = subtractDurationFromSnowflake(snowflakeFromTime(now), 30*time.Minute)
	retrievedEvents = make([]string, 0) //nolint:prealloc
	for eventKey, err := range store.ListKeysSince(ctx, sinceRV, SortOrderAsc) {
		require.NoError(t, err)
		retrievedEvents = append(retrievedEvents, eventKey)
	}

	// Should return events from the last hour and 30 minutes
	require.Len(t, retrievedEvents, 1)
	evt, err := ParseEventKey(retrievedEvents[0])
	require.NoError(t, err)
	assert.Equal(t, "test-3", evt.Name)
}
