package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestKVNotifier(t *testing.T, opts KVNotifierOptions) *kvNotifier {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		db.Close()
	})
	kv := NewBadgerKV(db)
	return newKVNotifier(kv, opts)
}

func TestNewKVNotifier(t *testing.T) {
	tests := []struct {
		name     string
		opts     KVNotifierOptions
		expected KVNotifierOptions
	}{
		{
			name: "default options",
			opts: KVNotifierOptions{},
			expected: KVNotifierOptions{
				LookbackPeriod: time.Duration(0),
				PollInterval:   defaultPollInterval,
				BufferSize:     defaultBufferSize,
			},
		},
		{
			name: "custom options",
			opts: KVNotifierOptions{
				LookbackPeriod: 5 * time.Minute,
				PollInterval:   1 * time.Second,
				BufferSize:     100,
			},
			expected: KVNotifierOptions{
				LookbackPeriod: 5 * time.Minute,
				PollInterval:   1 * time.Second,
				BufferSize:     100,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notifier := setupTestKVNotifier(t, tt.opts)

			assert.Equal(t, tt.expected.LookbackPeriod, notifier.opts.LookbackPeriod)
			assert.Equal(t, tt.expected.PollInterval, notifier.opts.PollInterval)
			assert.Equal(t, tt.expected.BufferSize, notifier.opts.BufferSize)
			assert.NotNil(t, notifier.seenRVs)
			assert.NotNil(t, notifier.rvHistory)
			assert.Equal(t, 0, notifier.rvIndex)
		})
	}
}

func TestEvent_getValue(t *testing.T) {
	rv := node.Generate()
	event := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv.Int64(),
		Action:          "created",
	}

	value, err := event.getValue()
	require.NoError(t, err)
	assert.NotNil(t, value)

	// Verify the JSON can be unmarshaled back
	var eventValue Event
	err = json.Unmarshal(value, &eventValue)
	require.NoError(t, err)
	assert.Equal(t, event, eventValue)
}

func TestParseEvent(t *testing.T) {
	rv := node.Generate()
	ev := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv.Int64(),
		Action:          "created",
	}

	value, err := json.Marshal(ev)
	require.NoError(t, err)

	tests := []struct {
		name      string
		value     []byte
		expectErr bool
		expected  Event
	}{
		{
			name:     "valid event",
			value:    value,
			expected: ev,
		},
		{
			name:      "invalid JSON value",
			value:     []byte("invalid json"),
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event, err := parseEvent(tt.value)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected.ResourceVersion, event.ResourceVersion)
				assert.Equal(t, tt.expected, event)
			}
		})
	}
}

func TestKVNotifier_getKey(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})
	rv := int64(1934555792099250176)
	key := notifier.getKey(EventKey{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv,
	})
	assert.Equal(t, "1934555792099250176~test-namespace~apps~deployments~test-deployment", key)
}

func TestKVNotifier_parseKey(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})

	tests := []struct {
		name        string
		key         string
		expectError bool
		expected    EventKey
	}{
		{
			name: "valid key",
			key:  "1934555792099250176~test-namespace~apps~deployments~test-deployment",
			expected: EventKey{
				ResourceVersion: 1934555792099250176,
				Namespace:       "test-namespace",
				Group:           "apps",
				Resource:        "deployments",
				Name:            "test-deployment",
			},
		},
		{
			name: "key with empty parts",
			key:  "1000~~apps~deployments~test-deployment",
			expected: EventKey{
				ResourceVersion: 1000,
				Namespace:       "",
				Group:           "apps",
				Resource:        "deployments",
				Name:            "test-deployment",
			},
		},
		{
			name: "key with special characters",
			key:  "2000~test-namespace~apps~deployments~test-deployment-with-dashes",
			expected: EventKey{
				ResourceVersion: 2000,
				Namespace:       "test-namespace",
				Group:           "apps",
				Resource:        "deployments",
				Name:            "test-deployment-with-dashes",
			},
		},
		{
			name:        "invalid key - too few parts",
			key:         "1000~test-namespace~apps~deployments",
			expectError: true,
		},
		{
			name:        "invalid key - too many parts",
			key:         "1000~test-namespace~apps~deployments~test-deployment~extra",
			expectError: true,
		},
		{
			name:        "invalid key - non-numeric resource version",
			key:         "invalid~test-namespace~apps~deployments~test-deployment",
			expectError: true,
		},
		{
			name:        "invalid key - empty string",
			key:         "",
			expectError: true,
		},
		{
			name:        "invalid key - no delimiters",
			key:         "justonepart",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eventKey, err := notifier.parseKey(tt.key)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, EventKey{}, eventKey)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, eventKey)
			}
		})
	}
}

func TestKVNotifier_parseKey_RoundTrip(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})

	originalEventKey := EventKey{
		ResourceVersion: 1934555792099250176,
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
	}

	// Convert EventKey to string
	keyString := notifier.getKey(originalEventKey)

	// Parse string back to EventKey
	parsedEventKey, err := notifier.parseKey(keyString)
	require.NoError(t, err)

	// Verify round trip works correctly
	assert.Equal(t, originalEventKey, parsedEventKey)
}

func TestKVNotifier_UIDDeduplication(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})

	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()

	// Initially, no UIDs should be seen
	assert.False(t, notifier.hasSeenUID(rv1))
	assert.False(t, notifier.hasSeenUID(rv2))

	// Mark uid1 as seen
	notifier.markUIDSeen(rv1)
	assert.True(t, notifier.hasSeenUID(rv1))
	assert.False(t, notifier.hasSeenUID(rv2))

	// Mark uid2 as seen
	notifier.markUIDSeen(rv2)
	assert.True(t, notifier.hasSeenUID(rv1))
	assert.True(t, notifier.hasSeenUID(rv2))

	// Marking the same UID again should not change anything
	notifier.markUIDSeen(rv1)
	assert.True(t, notifier.hasSeenUID(rv1))
	assert.True(t, notifier.hasSeenUID(rv2))
}

func TestKVNotifier_UIDDeduplication_MaxCapacity(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{
		EventCacheSize: 10,
	})

	// Fill up to capacity
	rvs := make([]int64, notifier.opts.EventCacheSize+10)
	for i := 0; i < len(rvs); i++ {
		rvs[i] = node.Generate().Int64()
		notifier.markUIDSeen(rvs[i])
	}

	// The first few UIDs should be evicted
	for i := 0; i < 10; i++ {
		assert.False(t, notifier.hasSeenUID(rvs[i]), "UID %d should have been evicted", i)
	}

	// The last maxSeenUIDs UIDs should still be present
	for i := 10; i < len(rvs); i++ {
		assert.True(t, notifier.hasSeenUID(rvs[i]), "UID %d should still be present", i)
	}
}

func TestKVNotifier_getLastResourceVersion(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name           string
		events         []Event
		expectedLastRV int64
	}{
		{
			name:           "no events - returns 0",
			events:         []Event{},
			expectedLastRV: 0,
		},
		{
			name: "single event - returns event RV",
			events: []Event{
				{
					Namespace:       "test-namespace",
					Group:           "apps",
					Resource:        "deployments",
					Name:            "test-deployment",
					ResourceVersion: 2000,
					Action:          "created",
				},
			},
			expectedLastRV: 2000,
		},
		{
			name: "multiple events - returns highest RV",
			events: []Event{
				{
					Namespace:       "test-namespace",
					Group:           "apps",
					Resource:        "deployments",
					Name:            "test-deployment-1",
					ResourceVersion: 2000,
					Action:          "created",
				},
				{
					Namespace:       "test-namespace",
					Group:           "apps",
					Resource:        "deployments",
					Name:            "test-deployment-2",
					ResourceVersion: 3000,
					Action:          "created",
				},
				{
					Namespace:       "test-namespace",
					Group:           "apps",
					Resource:        "deployments",
					Name:            "test-deployment-3",
					ResourceVersion: 1500,
					Action:          "created",
				},
			},
			expectedLastRV: 3000,
		},
		{
			name: "multiple events with different RVs - returns highest RV",
			events: []Event{
				{
					Namespace:       "test-namespace",
					Group:           "apps",
					Resource:        "deployments",
					Name:            "test-deployment-1",
					ResourceVersion: 2000,
					Action:          "created",
				},
				{
					Namespace:       "test-namespace",
					Group:           "apps",
					Resource:        "deployments",
					Name:            "test-deployment-2",
					ResourceVersion: 3000,
					Action:          "created",
				},
			},
			expectedLastRV: 3000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notifier := setupTestKVNotifier(t, KVNotifierOptions{})

			// Send all events
			for _, event := range tt.events {
				err := notifier.Send(ctx, event)
				require.NoError(t, err)
			}

			// Get the last resource version
			lastRV := notifier.getLastResourceVersion(ctx)
			assert.Equal(t, tt.expectedLastRV, lastRV)
		})
	}
}

func TestKVNotifier_getLastResourceVersion_WithErrors(t *testing.T) {
	ctx := context.Background()

	notifier := setupTestKVNotifier(t, KVNotifierOptions{})

	// Test with malformed keys in the store
	// This simulates a scenario where there might be corrupted data
	malformedKey := "invalid-key-format"
	malformedValue := []byte(`{"test": "data"}`)

	err := notifier.kv.Save(ctx, eventsSection, malformedKey, malformedValue)
	require.NoError(t, err)

	// The function should handle malformed keys gracefully and return 0
	lastRV := notifier.getLastResourceVersion(ctx)
	assert.Equal(t, int64(0), lastRV)
}

func TestKVNotifier_Notify_WithNoEvents(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{
		PollInterval: 5 * time.Millisecond,
		BufferSize:   10,
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Verify that getLastResourceVersion returns 0 when no events exist
	lastRV := notifier.getLastResourceVersion(ctx)
	assert.Equal(t, int64(0), lastRV)

	// Start notification listener
	events, err := notifier.Notify(ctx)
	require.NoError(t, err)

	// Send an event
	event := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: 6000,
		Action:          "created",
	}

	err = notifier.Send(ctx, event)
	require.NoError(t, err)

	// Wait for the event to be received
	select {
	case receivedEvent := <-events:
		require.NotNil(t, receivedEvent)
		assert.Equal(t, event.ResourceVersion, receivedEvent.ResourceVersion)
		assert.Equal(t, event, receivedEvent)
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for event")
	}
}

func TestKVNotifier_Send(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})
	ctx := context.Background()

	rv := node.Generate().Int64()
	event := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv,
		Action:          "created",
	}

	// Send the event
	err := notifier.Send(ctx, event)
	require.NoError(t, err)

	// Verify the event was saved in KV store
	key := notifier.getKey(EventKey{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv,
	})
	obj, err := notifier.kv.Get(ctx, eventsSection, key)
	require.NoError(t, err)

	// Parse the stored event
	storedEvent, err := parseEvent(obj.Value)
	require.NoError(t, err)
	assert.Equal(t, event, storedEvent)
}

func TestKVNotifier_Notify(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{
		PollInterval: 5 * time.Millisecond,
		BufferSize:   10,
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start notification listener
	events, err := notifier.Notify(ctx)
	require.NoError(t, err)

	// Send an event
	rv := node.Generate().Int64()
	event := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv,
		Action:          "created",
	}

	err = notifier.Send(ctx, event)
	require.NoError(t, err)

	// Wait for the event to be received
	select {
	case receivedEvent := <-events:
		require.NotNil(t, receivedEvent)
		assert.Equal(t, event.ResourceVersion, receivedEvent.ResourceVersion)
		assert.Equal(t, event, receivedEvent)
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for event")
	}
}

func TestKVNotifier_Notify_Deduplication(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{
		PollInterval: 10 * time.Millisecond,
		BufferSize:   10,
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start notification listener
	events, err := notifier.Notify(ctx)
	require.NoError(t, err)

	// Send the event in incorrect order
	rv1 := node.Generate().Int64()
	rv2 := node.Generate().Int64()
	require.NoError(t, err)

	event1 := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv1,
		Action:          "created",
	}
	event2 := Event{
		Namespace:       "test-namespace",
		Group:           "apps",
		Resource:        "deployments",
		Name:            "test-deployment",
		ResourceVersion: rv2,
		Action:          "created",
	}

	err = notifier.Send(ctx, event2)
	require.NoError(t, err)
	err = notifier.Send(ctx, event1)
	require.NoError(t, err)

	// Ensure both events are received
	// Note : This might be racy ?
	e1 := <-events
	assert.Equal(t, event1.ResourceVersion, e1.ResourceVersion)

	e2 := <-events
	assert.Equal(t, event2.ResourceVersion, e2.ResourceVersion)
}
