package resource

import (
	"context"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupTestNotifier(t *testing.T) (*pollingNotifier, *eventStore) {
	eventStore := newEventStore(setupBadgerKV(t))
	notifier := newNotifier(eventStore, notifierOptions{log: log.NewNopLogger()})
	return notifier.(*pollingNotifier), eventStore
}

func setupTestNotifierSqlKv(t *testing.T) (*pollingNotifier, *eventStore) {
	eventStore := newEventStore(setupSqlKV(t))
	notifier := newNotifier(eventStore, notifierOptions{log: log.NewNopLogger()})
	return notifier.(*pollingNotifier), eventStore
}

func TestIntegrationNewNotifier(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	notifier, _ := setupTestNotifier(t)

	assert.NotNil(t, notifier.eventStore)
}

func TestWatchOptionsNormalize(t *testing.T) {
	var opts WatchOptions
	opts = opts.normalize()

	assert.Equal(t, defaultSettleDelay, opts.SettleDelay)
	assert.Equal(t, defaultBufferSize, opts.BufferSize)
	assert.Equal(t, defaultMinBackoff, opts.MinBackoff)
	assert.Equal(t, defaultMaxBackoff, opts.MaxBackoff)
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
		ResourceVersion: snowflakeFromTime(time.Now().Add(-2 * time.Second)),
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := WatchOptions{
		SettleDelay: 50 * time.Millisecond,
		BufferSize:  10,
		MinBackoff:  50 * time.Millisecond,
		MaxBackoff:  500 * time.Millisecond,
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

	now := time.Now()

	// Save some initial events
	initialEvents := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-1",
			ResourceVersion: snowflakeFromTime(now.Add(-4 * time.Second)),
			Action:          DataActionCreated,
			Folder:          "test-folder",
			PreviousRV:      0,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-2",
			ResourceVersion: snowflakeFromTime(now.Add(-3 * time.Second)),
			Action:          DataActionUpdated,
			Folder:          "test-folder",
			PreviousRV:      snowflakeFromTime(now.Add(-4 * time.Second)),
		},
	}

	for _, event := range initialEvents {
		err := eventStore.Save(ctx, event)
		require.NoError(t, err)
	}

	opts := WatchOptions{
		SettleDelay: 50 * time.Millisecond,
		BufferSize:  10,
		MinBackoff:  50 * time.Millisecond,
		MaxBackoff:  500 * time.Millisecond,
	}

	// Start watching
	events := notifier.Watch(ctx, opts)

	// Save a new event after starting to watch, using a snowflake-based RV
	newEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "test-resource-3",
		ResourceVersion: snowflakeFromTime(now.Add(-2 * time.Second)),
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      snowflakeFromTime(now.Add(-3 * time.Second)),
	}

	err := eventStore.Save(ctx, newEvent)
	require.NoError(t, err)

	// Should receive the new event after settle delay
	select {
	case receivedEvent := <-events:
		assert.Equal(t, newEvent.Name, receivedEvent.Name)
		assert.Equal(t, newEvent.ResourceVersion, receivedEvent.ResourceVersion)
		assert.Equal(t, newEvent.Action, receivedEvent.Action)
	case <-time.After(2 * time.Second):
		t.Fatal("Expected to receive an event, but timed out")
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
		ResourceVersion: snowflakeFromTime(time.Now().Add(-2 * time.Second)),
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := WatchOptions{
		SettleDelay: 50 * time.Millisecond,
		BufferSize:  10,
		MinBackoff:  20 * time.Millisecond,
		MaxBackoff:  200 * time.Millisecond,
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
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	now := time.Now()

	// Add an initial event so that lastEventResourceVersion doesn't return ErrNotFound.
	initialRV := snowflakeFromTime(now.Add(-5 * time.Second))
	initialEvent := Event{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resource",
		Name:            "initial-resource",
		ResourceVersion: initialRV,
		Action:          DataActionCreated,
		Folder:          "test-folder",
		PreviousRV:      0,
	}
	err := eventStore.Save(ctx, initialEvent)
	require.NoError(t, err)

	opts := WatchOptions{
		SettleDelay: 50 * time.Millisecond,
		BufferSize:  10,
		MinBackoff:  20 * time.Millisecond,
		MaxBackoff:  200 * time.Millisecond,
	}

	// Start watching
	events := notifier.Watch(ctx, opts)

	// Save multiple events
	// Resource-3 is saved last but has a lower RV than resource-2 (out of order on purpose).
	rv1 := snowflakeFromTime(now.Add(-4 * time.Second))
	rv2 := snowflakeFromTime(now.Add(-2 * time.Second))
	rv3 := snowflakeFromTime(now.Add(-3 * time.Second))
	testEvents := []Event{
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-1",
			ResourceVersion: rv1,
			Action:          DataActionCreated,
			Folder:          "test-folder",
			PreviousRV:      0,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-2",
			ResourceVersion: rv2,
			Action:          DataActionUpdated,
			Folder:          "test-folder",
			PreviousRV:      rv1,
		},
		{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resource",
			Name:            "test-resource-3",
			ResourceVersion: rv3,
			Action:          DataActionDeleted,
			Folder:          "test-folder",
			PreviousRV:      rv1,
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
		case <-time.After(2 * time.Second):
			t.Fatalf("Timed out waiting for event %d", len(receivedEvents)+1)
		}
	}

	// Verify events are emitted sorted by resource version (ascending).
	// resource-1 (rv1, -4s) < resource-3 (rv3, -3s) < resource-2 (rv2, -2s)
	expectedNames := []string{"test-resource-1", "test-resource-3", "test-resource-2"}
	assert.Equal(t, expectedNames, receivedEvents)
}

func TestChannelNotifier(t *testing.T) {
	log := log.NewNopLogger()

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

	// Use a very short settle delay for unit tests so events are emitted immediately
	// after the buffering goroutine processes them.
	opts := WatchOptions{BufferSize: 5, SettleDelay: 1 * time.Millisecond, MinBackoff: 1 * time.Millisecond}

	t.Run("events are received", func(t *testing.T) {
		notifier := newChannelNotifier(log)
		watcher := notifier.Watch(t.Context(), opts)

		event := newEvent()
		notifier.Publish(event)
		mustReceiveTimeout(t, watcher, event)
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
			mustReceiveTimeout(t, watcher, event)
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
			mustReceiveTimeout(t, watcher1, event)
			mustReceiveTimeout(t, watcher2, event)
			mustReceiveTimeout(t, watcher3, event)
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
			mustReceiveTimeout(t, watcher, event)
		}

		mustNotReceive(t, watcher)

		nextEvent := newEvent()
		notifier.Publish(nextEvent)
		mustReceiveTimeout(t, watcher, nextEvent)
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

		// Some events may be dropped if the buffer is full.
		for _, e := range events {
			notifier.Publish(e)
		}

		// At least first 5 (bufferSize) events are received.
		mustReceiveTimeout(t, watcher, events[0])
		mustReceiveTimeout(t, watcher, events[1])
		mustReceiveTimeout(t, watcher, events[2])
		mustReceiveTimeout(t, watcher, events[3])
		mustReceiveTimeout(t, watcher, events[4])
	})

	t.Run("canceling the context stops event publishing", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			notifier := newChannelNotifier(log)

			ctx, stop := context.WithCancel(t.Context())
			watcher := notifier.Watch(ctx, opts)

			event := newEvent()
			event.ResourceVersion = snowflakeFromTime(time.Now())
			notifier.Publish(event)

			// Advance synctest's time past the settle delay plus
			// the ticker period so the event is emitted.
			time.Sleep(opts.SettleDelay + 1*time.Second)
			synctest.Wait()
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

func mustReceiveTimeout(t *testing.T, watcher <-chan Event, expected Event) {
	t.Helper()
	select {
	case e := <-watcher:
		require.Equal(t, expected, e)
	case <-time.After(2 * time.Second):
		require.FailNow(t, "timed out waiting for event")
	}
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
