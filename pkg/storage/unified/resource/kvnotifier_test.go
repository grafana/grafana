package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
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
				LookbackPeriod: defaultLookbackPeriod,
				PollInterval:   defaultPollInterval,
				BufferSize:     0,
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
			assert.NotNil(t, notifier.seenUIDs)
			assert.NotNil(t, notifier.uidHistory)
			assert.Equal(t, 0, notifier.uidIndex)
		})
	}
}

func TestEvent_getValue(t *testing.T) {
	uid := uuid.New()
	event := Event{
		Namespace: "test-namespace",
		Group:     "apps",
		Resource:  "deployments",
		Name:      "test-deployment",
		UID:       uid,
		Action:    "created",
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
	uid := uuid.New()
	ev := Event{
		Namespace: "test-namespace",
		Group:     "apps",
		Resource:  "deployments",
		Name:      "test-deployment",
		UID:       uid,
		Action:    "created",
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
				assert.Equal(t, tt.expected.UID, event.UID)
				assert.Equal(t, tt.expected, event)
			}
		})
	}
}

func TestKVNotifier_getKey(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})

	uid := uuid.MustParse("019764aa-ffca-7d08-b3df-0839548b6103")
	key := notifier.getKey(uid)
	assert.Equal(t, "/unified/events/1749740580/019764aa-ffca-7d08-b3df-0839548b6103", key)
}

func TestKVNotifier_UIDDeduplication(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})

	uid1 := uuid.New()
	uid2 := uuid.New()

	// Initially, no UIDs should be seen
	assert.False(t, notifier.hasSeenUID(uid1))
	assert.False(t, notifier.hasSeenUID(uid2))

	// Mark uid1 as seen
	notifier.markUIDSeen(uid1)
	assert.True(t, notifier.hasSeenUID(uid1))
	assert.False(t, notifier.hasSeenUID(uid2))

	// Mark uid2 as seen
	notifier.markUIDSeen(uid2)
	assert.True(t, notifier.hasSeenUID(uid1))
	assert.True(t, notifier.hasSeenUID(uid2))

	// Marking the same UID again should not change anything
	notifier.markUIDSeen(uid1)
	assert.True(t, notifier.hasSeenUID(uid1))
	assert.True(t, notifier.hasSeenUID(uid2))
}

func TestKVNotifier_UIDDeduplication_MaxCapacity(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{
		EventCacheSize: 10,
	})

	// Fill up to capacity
	uids := make([]uuid.UUID, notifier.opts.EventCacheSize+10)
	for i := 0; i < len(uids); i++ {
		uids[i] = uuid.New()
		notifier.markUIDSeen(uids[i])
	}

	// The first few UIDs should be evicted
	for i := 0; i < 10; i++ {
		assert.False(t, notifier.hasSeenUID(uids[i]), "UID %d should have been evicted", i)
	}

	// The last maxSeenUIDs UIDs should still be present
	for i := 10; i < len(uids); i++ {
		assert.True(t, notifier.hasSeenUID(uids[i]), "UID %d should still be present", i)
	}
}

func TestKVNotifier_Send(t *testing.T) {
	notifier := setupTestKVNotifier(t, KVNotifierOptions{})
	ctx := context.Background()

	uid := uuid.New()
	event := Event{
		Namespace: "test-namespace",
		Group:     "apps",
		Resource:  "deployments",
		Name:      "test-deployment",
		UID:       uid,
		Action:    "created",
	}

	// Send the event
	err := notifier.Send(ctx, event)
	require.NoError(t, err)

	// Verify the event was saved in KV store
	key := notifier.getKey(uid)
	obj, err := notifier.kv.Get(ctx, key)
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
	uid := uuid.New()
	event := Event{
		Namespace: "test-namespace",
		Group:     "apps",
		Resource:  "deployments",
		Name:      "test-deployment",
		UID:       uid,
		Action:    "created",
	}

	err = notifier.Send(ctx, event)
	require.NoError(t, err)

	// Wait for the event to be received
	select {
	case receivedEvent := <-events:
		require.NotNil(t, receivedEvent)
		assert.Equal(t, event.UID, receivedEvent.UID)
		assert.Equal(t, event, *receivedEvent)
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
	uuid1, err := uuid.NewV7()
	require.NoError(t, err)
	uuid2, err := uuid.NewV7()
	require.NoError(t, err)

	event1 := Event{
		Namespace: "test-namespace",
		Group:     "apps",
		Resource:  "deployments",
		Name:      "test-deployment",
		UID:       uuid1,
		Action:    "created",
	}
	event2 := Event{
		Namespace: "test-namespace",
		Group:     "apps",
		Resource:  "deployments",
		Name:      "test-deployment",
		UID:       uuid2,
		Action:    "created",
	}

	err = notifier.Send(ctx, event2)
	require.NoError(t, err)
	err = notifier.Send(ctx, event1)
	require.NoError(t, err)

	// Ensure both events are received
	// Note : This might be racy ?
	e1 := <-events
	assert.Equal(t, event1.UID, e1.UID)

	e2 := <-events
	assert.Equal(t, event2.UID, e2.UID)
}
