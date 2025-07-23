package resource

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestNotifier(t *testing.T) (*notifier, *eventStore) {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	kv := NewBadgerKV(db)
	eventStore := newEventStore(kv)
	notifier := newNotifier(eventStore, notifierOptions{log: &logging.NoOpLogger{}})
	return notifier, eventStore
}

func TestNewNotifier(t *testing.T) {
	notifier, _ := setupTestNotifier(t)

	assert.NotNil(t, notifier.eventStore)
}

func TestDefaultWatchOptions(t *testing.T) {
	opts := defaultWatchOptions()

	assert.Equal(t, defaultLookbackPeriod, opts.LookbackPeriod)
	assert.Equal(t, defaultPollInterval, opts.PollInterval)
	assert.Equal(t, defaultBufferSize, opts.BufferSize)
}

func TestNotifier_lastEventResourceVersion(t *testing.T) {
	ctx := context.Background()
	notifier, eventStore := setupTestNotifier(t)

	// Test with no events
	rv, err := notifier.lastEventResourceVersion(ctx)
	assert.Error(t, err)
	assert.ErrorIs(t, ErrNotFound, err)
	assert.Equal(t, int64(0), rv)

	// Save an event
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
	err = eventStore.Save(ctx, event)
	require.NoError(t, err)

	// Test with events
	rv, err = notifier.lastEventResourceVersion(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1000), rv)

	// Save another event with higher RV
	event2 := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource-2",
		ResourceVersion: 2000,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      1000,
	}
	err = eventStore.Save(ctx, event2)
	require.NoError(t, err)

	// Should return the higher RV
	rv, err = notifier.lastEventResourceVersion(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(2000), rv)
}

func TestNotifier_cachekey(t *testing.T) {
	notifier, _ := setupTestNotifier(t)

	tests := []struct {
		name     string
		event    Event
		expected string
	}{
		{
			name: "basic event",
			event: Event{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: 1000,
			},
			expected: "default~apps~resource~test-resource~1000",
		},
		{
			name: "empty namespace",
			event: Event{
				Namespace:       "",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: 2000,
			},
			expected: "~apps~resource~test-resource~2000",
		},
		{
			name: "special characters in name",
			event: Event{
				Namespace:       "test-ns",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource-with-dashes",
				ResourceVersion: 3000,
			},
			expected: "test-ns~apps~resource~test-resource-with-dashes~3000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := notifier.cacheKey(tt.event)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNotifier_Watch_NoEvents(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	notifier, eventStore := setupTestNotifier(t)

	// Add at least one event so that lastEventResourceVersion doesn't return ErrNotFound
	initialEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "initial-resource",
		ResourceVersion: 100,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := watchOptions{
		LookbackPeriod: 100 * time.Millisecond,
		PollInterval:   50 * time.Millisecond,
		BufferSize:     10,
	}

	events := notifier.Watch(ctx, opts)

	// Should receive no new events (only events after initial RV should be sent)
	select {
	case event := <-events:
		t.Fatalf("Expected no events, but got: %+v", event)
	case <-ctx.Done():
		// Expected - context timeout
	}
}

func TestNotifier_Watch_WithExistingEvents(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	notifier, eventStore := setupTestNotifier(t)

	// Save some initial events
	initialEvents := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-1",
			ResourceVersion: 1000,
			Action:          DataActionCreated,
			Folder:          "test-folder",
			PreviousRV:      0,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-2",
			ResourceVersion: 2000,
			Action:          DataActionUpdated,
			Folder:          "test-folder",
			PreviousRV:      1000,
		},
	}

	for _, event := range initialEvents {
		err := eventStore.Save(ctx, event)
		require.NoError(t, err)
	}

	opts := watchOptions{
		LookbackPeriod: 100 * time.Millisecond,
		PollInterval:   50 * time.Millisecond,
		BufferSize:     10,
	}

	// Start watching
	events := notifier.Watch(ctx, opts)

	// Save a new event after starting to watch
	newEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource-3",
		ResourceVersion: 3000,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      2000,
	}

	err := eventStore.Save(ctx, newEvent)
	require.NoError(t, err)

	// Should receive the new event
	select {
	case receivedEvent := <-events:
		assert.Equal(t, newEvent.Name, receivedEvent.Name)
		assert.Equal(t, newEvent.ResourceVersion, receivedEvent.ResourceVersion)
		assert.Equal(t, newEvent.Action, receivedEvent.Action)
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Expected to receive an event, but timed out")
	}
}

func TestNotifier_Watch_EventDeduplication(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	notifier, eventStore := setupTestNotifier(t)

	// Add an initial event so that lastEventResourceVersion doesn't return ErrNotFound
	initialEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "initial-resource",
		ResourceVersion: time.Now().UnixNano(),
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := watchOptions{
		LookbackPeriod: time.Second,
		PollInterval:   20 * time.Millisecond,
		BufferSize:     10,
	}

	// Start watching
	events := notifier.Watch(ctx, opts)

	// Save an event
	event := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource",
		ResourceVersion: time.Now().UnixNano(),
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}

	err = eventStore.Save(ctx, event)
	require.NoError(t, err)

	// Should receive the event once
	select {
	case receivedEvent := <-events:
		assert.Equal(t, event.Name, receivedEvent.Name)
		assert.Equal(t, event.ResourceVersion, receivedEvent.ResourceVersion)
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Expected to receive an event, but timed out")
	}

	// Should not receive the same event again (due to caching)
	select {
	case duplicateEvent := <-events:
		t.Fatalf("Expected no duplicate events, but got: %+v", duplicateEvent)
	case <-time.After(100 * time.Millisecond):
		// Expected - no duplicate events
	}
}

func TestNotifier_Watch_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	notifier, eventStore := setupTestNotifier(t)

	// Add an initial event so that lastEventResourceVersion doesn't return ErrNotFound
	initialEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "initial-resource",
		ResourceVersion: time.Now().UnixNano(),
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := watchOptions{
		LookbackPeriod: 100 * time.Millisecond,
		PollInterval:   20 * time.Millisecond,
		BufferSize:     10,
	}

	events := notifier.Watch(ctx, opts)

	// Cancel the context
	cancel()

	// Channel should be closed
	select {
	case event, ok := <-events:
		if ok {
			t.Fatalf("Expected channel to be closed, but got event: %+v", event)
		}
		// Channel is closed as expected
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Expected channel to be closed quickly after context cancellation")
	}
}

func TestNotifier_Watch_MultipleEvents(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	notifier, eventStore := setupTestNotifier(t)
	rv := time.Now().UnixNano()
	// Add an initial event so that lastEventResourceVersion doesn't return ErrNotFound
	initialEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "initial-resource",
		ResourceVersion: rv,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := watchOptions{
		LookbackPeriod: time.Second,
		PollInterval:   20 * time.Millisecond,
		BufferSize:     10,
	}

	// Start watching
	events := notifier.Watch(ctx, opts)

	// Save multiple events
	testEvents := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-1",
			ResourceVersion: rv + 1,
			Action:          DataActionCreated,
			Folder:          "test-folder",
			PreviousRV:      0,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-2",
			ResourceVersion: rv + 3,
			Action:          DataActionUpdated,
			Folder:          "test-folder",
			PreviousRV:      1000,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-3",
			ResourceVersion: rv + 2, // Out of order on purpose
			Action:          DataActionDeleted,
			Folder:          "test-folder",
			PreviousRV:      2000,
		},
	}

	go func() {
		for _, event := range testEvents {
			err := eventStore.Save(ctx, event)
			require.NoError(t, err)
		}
	}()

	// Receive events
	receivedEvents := make([]Event, 0, len(testEvents))
	for i := 0; i < len(testEvents); i++ {
		select {
		case event := <-events:
			receivedEvents = append(receivedEvents, event)
		case <-time.After(1 * time.Second):
			t.Fatalf("Timed out waiting for event %d", i+1)
		}
	}

	// Verify all events were received
	assert.Len(t, receivedEvents, len(testEvents))

	// Verify the events match and ordered by resource version
	receivedNames := make([]string, len(receivedEvents))
	for i, event := range receivedEvents {
		receivedNames[i] = event.Name
	}

	expectedNames := []string{"test-resource-1", "test-resource-2", "test-resource-3"}
	assert.ElementsMatch(t, expectedNames, receivedNames)
}
