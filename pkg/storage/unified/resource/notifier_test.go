package resource

import (
	"context"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestNotifier(t *testing.T) (*pollingNotifier, *eventStore) {
	db := setupTestBadgerDB(t)
	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
	})
	kv := NewBadgerKV(db)
	eventStore := newEventStore(kv)
	notifier := newNotifier(eventStore, notifierOptions{log: &logging.NoOpLogger{}})
	return notifier.(*pollingNotifier), eventStore
}

func setupTestNotifierSqlKv(t *testing.T) (*pollingNotifier, *eventStore) {
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	kv, err := NewSQLKV(eDB)
	require.NoError(t, err)
	eventStore := newEventStore(kv)
	notifier := newNotifier(eventStore, notifierOptions{log: &logging.NoOpLogger{}})
	return notifier.(*pollingNotifier), eventStore
}

func TestIntegrationNewNotifier(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	notifier, _ := setupTestNotifier(t)

	assert.NotNil(t, notifier.eventStore)
}

func TestDefaultWatchOptions(t *testing.T) {
	opts := defaultWatchOptions()

	assert.Equal(t, defaultLookbackPeriod, opts.LookbackPeriod)
	assert.Equal(t, defaultBufferSize, opts.BufferSize)
}

func runNotifierTestWith(t *testing.T, storeName string, newStoreFn func(*testing.T) (*pollingNotifier, *eventStore), testFn func(*testing.T, context.Context, *pollingNotifier, *eventStore)) {
	t.Run(storeName, func(t *testing.T) {
		ctx := context.Background()
		notifier, eventStore := newStoreFn(t)
		testFn(t, ctx, notifier, eventStore)
	})
}

func TestIntegrationNotifier_lastEventResourceVersion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierLastEventResourceVersion)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierLastEventResourceVersion)
}

func testNotifierLastEventResourceVersion(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
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

func TestIntegrationNotifier_cachekey(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierCachekey)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierCachekey)
}

func testNotifierCachekey(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
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

func TestIntegrationNotifier_Watch_NoEvents(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierWatchNoEvents)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierWatchNoEvents)
}

func testNotifierWatchNoEvents(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
	ctx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()

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
		BufferSize:     10,
		MinBackoff:     50 * time.Millisecond,
		MaxBackoff:     500 * time.Millisecond,
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

func TestIntegrationNotifier_Watch_WithExistingEvents(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierWatchWithExistingEvents)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierWatchWithExistingEvents)
}

func testNotifierWatchWithExistingEvents(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

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
		BufferSize:     10,
		MinBackoff:     50 * time.Millisecond,
		MaxBackoff:     500 * time.Millisecond,
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

func TestIntegrationNotifier_Watch_EventDeduplication(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierWatchEventDeduplication)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierWatchEventDeduplication)
}

func testNotifierWatchEventDeduplication(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

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
		BufferSize:     10,
		MinBackoff:     20 * time.Millisecond,
		MaxBackoff:     200 * time.Millisecond,
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

func TestIntegrationNotifier_Watch_ContextCancellation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierWatchContextCancellation)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierWatchContextCancellation)
}

func testNotifierWatchContextCancellation(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
	ctx, cancel := context.WithCancel(ctx)

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
		BufferSize:     10,
		MinBackoff:     20 * time.Millisecond,
		MaxBackoff:     200 * time.Millisecond,
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

func TestIntegrationNotifier_Watch_MultipleEvents(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	runNotifierTestWith(t, "badger", setupTestNotifier, testNotifierWatchMultipleEvents)
	runNotifierTestWith(t, "sqlkv", setupTestNotifierSqlKv, testNotifierWatchMultipleEvents)
}

func testNotifierWatchMultipleEvents(t *testing.T, ctx context.Context, notifier *pollingNotifier, eventStore *eventStore) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
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
		BufferSize:     10,
		MinBackoff:     20 * time.Millisecond,
		MaxBackoff:     200 * time.Millisecond,
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

	errCh := make(chan error)
	go func() {
		for _, event := range testEvents {
			errCh <- eventStore.Save(ctx, event)
		}
	}()

	// Receive events
	receivedEvents := make([]string, 0, len(testEvents))
	for len(receivedEvents) != len(testEvents) {
		select {
		case event := <-events:
			receivedEvents = append(receivedEvents, event.Name)
		case err := <-errCh:
			require.NoError(t, err)
		case <-time.After(1 * time.Second):
			t.Fatalf("Timed out waiting for event %d", len(receivedEvents)+1)
		}
	}

	// Verify the events match and ordered by resource version
	expectedNames := []string{"test-resource-1", "test-resource-2", "test-resource-3"}
	assert.ElementsMatch(t, expectedNames, receivedEvents)
}

func TestChannelNotifier(t *testing.T) {
	log := &logging.NoOpLogger{}
	opts := watchOptions{BufferSize: 5}

	var eventCount int64
	newEvent := func() Event {
		eventCount++
		return Event{
			Namespace:       "default",
			Group:           "playlists.grafana.app",
			Resource:        "playlists",
			Name:            fmt.Sprintf("playlist_%d", eventCount),
			ResourceVersion: eventCount,
			Action:          "created",
		}
	}

	t.Run("events are received", func(t *testing.T) {
		notifier := newChannelNotifier(log)
		watcher := notifier.Watch(t.Context(), opts)

		event := newEvent()
		notifier.Publish(event)
		mustReceive(t, watcher, event)
		mustNotReceive(t, watcher)
	})

	t.Run("multiple events are received in order", func(t *testing.T) {
		notifier := newChannelNotifier(log)
		watcher := notifier.Watch(t.Context(), opts)

		events := []Event{newEvent(), newEvent(), newEvent()}
		for _, event := range events {
			notifier.Publish(event)
		}

		for _, event := range events {
			mustReceive(t, watcher, event)
		}

		mustNotReceive(t, watcher)
	})

	t.Run("multiple watchers and multiple events", func(t *testing.T) {
		notifier := newChannelNotifier(log)

		watcher1 := notifier.Watch(t.Context(), opts)
		watcher2 := notifier.Watch(t.Context(), opts)
		watcher3 := notifier.Watch(t.Context(), opts)

		events := []Event{newEvent(), newEvent(), newEvent()}
		for _, event := range events {
			notifier.Publish(event)
		}

		for _, event := range events {
			mustReceive(t, watcher1, event)
			mustReceive(t, watcher2, event)
			mustReceive(t, watcher3, event)
		}

		mustNotReceive(t, watcher1)
		mustNotReceive(t, watcher2)
		mustNotReceive(t, watcher3)
	})

	t.Run("continues to receive events", func(t *testing.T) {
		notifier := newChannelNotifier(log)
		watcher := notifier.Watch(t.Context(), opts)

		events := []Event{newEvent(), newEvent(), newEvent()}
		for _, event := range events {
			notifier.Publish(event)
		}

		for _, event := range events {
			mustReceive(t, watcher, event)
		}

		mustNotReceive(t, watcher)

		nextEvent := newEvent()
		notifier.Publish(nextEvent)
		mustReceive(t, watcher, nextEvent)
		mustNotReceive(t, watcher)
	})

	t.Run("publishing more than the buffer size", func(t *testing.T) {
		notifier := newChannelNotifier(log)
		watcher := notifier.Watch(t.Context(), opts)

		const numEvents = 10
		events := make([]Event, numEvents)
		for j := range 10 {
			events[j] = newEvent()
		}

		// Most events are dropped since the buffer is full.
		for _, e := range events {
			notifier.Publish(e)
		}

		// Only first 5 (bufferSize) events are received.
		mustReceive(t, watcher, events[0])
		mustReceive(t, watcher, events[1])
		mustReceive(t, watcher, events[2])
		mustReceive(t, watcher, events[3])
		mustReceive(t, watcher, events[4])
		mustNotReceive(t, watcher)
	})

	t.Run("canceling the context stops event publishing", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			notifier := newChannelNotifier(log)

			ctx, stop := context.WithCancel(t.Context())
			watcher := notifier.Watch(ctx, opts)

			// Publishing works
			event := newEvent()
			notifier.Publish(event)
			mustReceive(t, watcher, event)

			stop()
			synctest.Wait() // ensure cancelation is propagated to closing the channel

			notifier.Publish(newEvent())     // shouldn't panic
			mustReceive(t, watcher, Event{}) // zero value

			_, isOpen := <-watcher
			require.False(t, isOpen, "channel should be closed after context cancelation")
		})
	})
}

func mustReceive(t *testing.T, watcher <-chan Event, expected Event) {
	select {
	case e := <-watcher:
		require.Equal(t, expected, e)

	default:
		require.FailNow(t, "should have received published event")
	}
}

func mustNotReceive(t *testing.T, watcher <-chan Event) {
	select {
	case e := <-watcher:
		require.FailNow(t, "no new events should have been received", "extra event: %#v", e)

	default:
		// pass
	}
}
