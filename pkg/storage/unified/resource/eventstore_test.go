package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func setupTestEventStore(t *testing.T) *eventStore {
	return newEventStore(setupBadgerKV(t))
}

// TestMain verifies that all background goroutines are properly shut down after tests.
func TestMain(m *testing.M) {
	db.SetupTestDB()
	goleak.VerifyTestMain(m,
		goleak.Cleanup(func(exitCode int) {
			db.CleanupTestDB()
			os.Exit(exitCode)
		}),
		goleak.IgnoreTopFunction("github.com/open-feature/go-sdk/openfeature.(*eventExecutor).startEventListener.func1.1"),
		goleak.IgnoreTopFunction("github.com/patrickmn/go-cache.(*janitor).Run"),                          // go-cache janitor stops via GC finalizer, not an explicit close.
		goleak.IgnoreTopFunction("go.opentelemetry.io/otel/sdk/trace.(*batchSpanProcessor).processQueue"), // OTel span processor from test infra.
		goleak.IgnoreTopFunction("database/sql.(*DB).connectionOpener"),                                   // database/sql background goroutines from test DB setup.
		goleak.IgnoreTopFunction("database/sql.(*DB).connectionCleaner"),
		goleak.IgnoreTopFunction("github.com/go-sql-driver/mysql.(*mysqlConn).startWatcher.func1"),                                             // MySQL driver connection watcher from test DB setup.
		goleak.IgnoreTopFunction("github.com/hashicorp/golang-lru/v2/expirable.NewLRU[...].func1"),                                             // expirable LRU cleanup goroutine.
		goleak.IgnoreTopFunction("github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager.(*ResourceVersionManager).startBatchProcessor"), // ResourceVersionManager has no shutdown hook; compat tests intentionally exercise it.
	)
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

	for _, tc := range []struct {
		name           string
		previousRV     int64
		previousAction kv.DataAction
		previousFolder string
	}{
		{name: "no previous revision"},
		{name: "legacy event", previousRV: 999},
		{name: "bulk exclusion", previousRV: -1},
		{name: "empty previous folder", previousRV: 999, previousAction: DataActionCreated},
		{name: "previous folder", previousRV: 999, previousAction: DataActionUpdated, previousFolder: "old-folder"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			event.PreviousRV = tc.previousRV
			event.PreviousAction = tc.previousAction
			event.PreviousFolder = tc.previousFolder
			require.NoError(t, store.Save(ctx, event))

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

			var listed []Event
			for listedEvent, err := range store.ListSince(ctx, 0) {
				require.NoError(t, err)
				listed = append(listed, listedEvent)
			}
			require.Equal(t, []Event{event}, listed)
		})
	}
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

func TestIntegrationEventStore_ListSince_Empty(t *testing.T) {
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreListSinceEmpty)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreListSinceEmpty)
}

func testEventStoreListSinceEmpty(t *testing.T, ctx context.Context, store *eventStore) {
	testutil.SkipIntegrationTestInShortMode(t)
	// List events when store is empty
	retrievedEvents := make([]Event, 0) //nolint:prealloc
	for event, err := range store.ListSince(ctx, 0) {
		require.NoError(t, err)
		retrievedEvents = append(retrievedEvents, event)
	}

	assert.Empty(t, retrievedEvents)
}

func TestIntegrationEventStore_ListSince_Pages(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	runEventStoreTestWith(t, "badger", setupTestEventStore, testEventStoreListSincePages)
	runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, testEventStoreListSincePages)
}

func testEventStoreListSincePages(t *testing.T, ctx context.Context, store *eventStore) {
	events := eventStoreTestEvents(623)
	for _, event := range slices.Backward(events) {
		require.NoError(t, store.Save(ctx, event))
	}

	for _, since := range []int64{0, 1000, 1016, 1166, 1207, 1208} {
		t.Run(fmt.Sprintf("since=%d", since), func(t *testing.T) {
			probe := &eventStoreKVProbe{KV: store.kv, t: t}
			var expected []Event
			for _, event := range events {
				if event.ResourceVersion >= since {
					expected = append(expected, event)
				}
			}
			var actual []Event
			for event, err := range newEventStore(probe).ListSince(ctx, since) {
				require.NoError(t, err)
				probe.assertClosed()
				actual = append(actual, event)
			}
			require.Equal(t, expected, actual)
			require.Zero(t, probe.gets)
			require.Len(t, probe.batches, (len(expected)+49)/50)
			require.Len(t, probe.scans, len(expected)/500+1)
			for i, batch := range probe.batches {
				require.Len(t, batch, min(50, len(expected)-i*50))
			}
			for i, scan := range probe.scans {
				require.Equal(t, SortOrderAsc, scan.Sort)
				require.Equal(t, int64(500), scan.Limit)
				if i == 0 {
					require.Equal(t, fmt.Sprint(since), scan.StartKey)
				} else {
					cursor := eventStoreTestKey(expected[i*500-1])
					require.Equal(t, PrefixRangeEnd(cursor), scan.StartKey)
				}
			}
			probe.assertClosed()
		})
	}
}

func TestIntegrationEventStore_ListSince_PageBoundaries(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, count := range []int{0, 1, 49, 50, 51, 100, 101, 123, 499, 500, 501} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			test := func(t *testing.T, ctx context.Context, store *eventStore) {
				events := eventStoreTestEvents(count)
				for _, event := range events {
					require.NoError(t, store.Save(ctx, event))
				}
				probe := &eventStoreKVProbe{KV: store.kv, t: t}
				actual := make([]Event, 0, count)
				for event, err := range newEventStore(probe).ListSince(ctx, 0) {
					require.NoError(t, err)
					probe.assertClosed()
					actual = append(actual, event)
				}
				require.Equal(t, events, actual)
				require.Len(t, probe.batches, (count+49)/50)
				require.Len(t, probe.scans, count/500+1)
				require.Zero(t, probe.gets)
			}
			runEventStoreTestWith(t, "badger", setupTestEventStore, test)
			runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, test)
		})
	}
}

func TestIntegrationEventStore_ListSince_Stop(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, tc := range []struct {
		mode  string
		count int
	}{
		{mode: "early stop", count: 1},
		{mode: "stop at batch boundary", count: 50},
		{mode: "stop at page boundary", count: 500},
		{mode: "cancel and stop", count: 1},
		{mode: "deleted cursor", count: 623},
	} {
		t.Run(tc.mode, func(t *testing.T) {
			test := func(t *testing.T, ctx context.Context, store *eventStore) {
				ctx, cancel := context.WithCancel(ctx)
				defer cancel()
				events := eventStoreTestEvents(623)
				for _, event := range events {
					require.NoError(t, store.Save(ctx, event))
				}
				probe := &eventStoreKVProbe{KV: store.kv, t: t}
				var actual []Event
				for event, err := range newEventStore(probe).ListSince(ctx, 0) {
					probe.assertClosed()
					require.NoError(t, err)
					actual = append(actual, event)
					if tc.mode == "cancel and stop" {
						cancel()
					}
					if tc.mode == "deleted cursor" && len(actual) == 500 {
						key := eventStoreTestKey(event)
						require.NoError(t, store.kv.Delete(ctx, eventsSection, key))
					}
					if tc.mode != "deleted cursor" && len(actual) == tc.count {
						break
					}
				}
				probe.assertClosed()
				require.Equal(t, events[:tc.count], actual)
				require.Len(t, probe.scans, (tc.count+499)/500)
				require.Len(t, probe.batches, (tc.count+49)/50)
			}
			runEventStoreTestWith(t, "badger", setupTestEventStore, test)
			runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, test)
		})
	}
}

func TestIntegrationEventStore_ListSince_MissingRecords(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, mode := range []string{"partial batches", "first batch", "first key page", "all records"} {
		t.Run(mode, func(t *testing.T) {
			test := func(t *testing.T, ctx context.Context, store *eventStore) {
				events := eventStoreTestEvents(623)
				partial := make(map[string]bool)
				for i, event := range events {
					require.NoError(t, store.Save(ctx, event))
					partial[eventStoreTestKey(event)] = i%3 == 0
				}
				removed := make(map[string]bool)
				probe := &eventStoreKVProbe{KV: store.kv, t: t}
				probe.batch = func(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
					for _, key := range keys {
						if mode == "all records" ||
							(mode == "first batch" && len(probe.batches) == 1) ||
							(mode == "first key page" && len(probe.batches) <= 10) ||
							(mode == "partial batches" && partial[key]) {
							// Delete after enumeration to exercise successful BatchGet omissions.
							require.NoError(t, store.kv.Delete(ctx, section, key))
							removed[key] = true
						}
					}
					return store.kv.BatchGet(ctx, section, keys)
				}
				actual := make([]Event, 0, len(events))
				for event, err := range newEventStore(probe).ListSince(ctx, 0) {
					require.NoError(t, err)
					probe.assertClosed()
					actual = append(actual, event)
				}
				expected := make([]Event, 0, len(events))
				for _, event := range events {
					if !removed[eventStoreTestKey(event)] {
						expected = append(expected, event)
					}
				}
				require.Equal(t, expected, actual)
				require.Len(t, probe.scans, 2)
				require.Len(t, probe.batches, 13)
				require.Zero(t, probe.gets)
				probe.assertClosed()
			}
			runEventStoreTestWith(t, "badger", setupTestEventStore, test)
			runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, test)
		})
	}
}

func TestIntegrationEventStore_ListSince_Failures(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	backendErr := errors.New("backend unavailable")
	for _, mode := range []string{
		"keys error", "batch error", "late batch error", "batch not found", "batch timeout",
		"unexpected key", "wrong identity", "wrong RV", "invalid action", "invalid JSON", "reader error",
		"cancel before scan", "cancel keys", "cancel batch", "cancel reader",
	} {
		t.Run(mode, func(t *testing.T) {
			test := func(t *testing.T, ctx context.Context, store *eventStore) {
				ctx, cancel := context.WithCancel(ctx)
				defer cancel()
				events := eventStoreTestEvents(2)
				for _, event := range events {
					require.NoError(t, store.Save(ctx, event))
				}
				probe := &eventStoreKVProbe{KV: store.kv, t: t}
				probe.keys = func(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
					return func(yield func(string, error) bool) {
						for key, err := range store.kv.Keys(ctx, section, opts) {
							if !yield(key, err) {
								return
							}
							if mode == "keys error" {
								yield("", backendErr)
								return
							}
							if mode == "cancel keys" {
								cancel()
								return
							}
						}
					}
				}
				probe.batch = func(context.Context, string, []string) iter.Seq2[kv.KeyValue, error] {
					return eventStoreFailureBatch(t, mode, events, cancel, backendErr)
				}
				if mode == "cancel before scan" {
					cancel()
				}
				failures := 0
				for event, err := range newEventStore(probe).ListSince(ctx, 0) {
					probe.assertClosed()
					require.Error(t, err)
					require.Equal(t, Event{}, event)
					switch mode {
					case "keys error", "batch error", "late batch error", "reader error":
						require.ErrorIs(t, err, backendErr)
					case "batch not found":
						require.ErrorIs(t, err, ErrNotFound)
					case "batch timeout":
						require.ErrorIs(t, err, context.DeadlineExceeded)
					default:
						require.NotErrorIs(t, err, ErrNotFound)
						if strings.HasPrefix(mode, "cancel") {
							require.ErrorIs(t, err, context.Canceled)
						}
					}
					failures++
				}
				require.Equal(t, 1, failures)
				if mode == "cancel before scan" {
					require.Empty(t, probe.scans)
				}
				if mode == "cancel before scan" || mode == "cancel keys" || mode == "keys error" {
					require.Empty(t, probe.batches)
				}
				probe.assertClosed()
				require.Zero(t, probe.gets)
			}
			runEventStoreTestWith(t, "badger", setupTestEventStore, test)
			runEventStoreTestWith(t, "sqlkv", setupTestEventStoreSqlKv, test)
		})
	}
}

func eventStoreFailureBatch(t *testing.T, mode string, events []Event, cancel context.CancelFunc, backendErr error) iter.Seq2[kv.KeyValue, error] {
	t.Helper()
	return func(yield func(kv.KeyValue, error) bool) {
		switch mode {
		case "batch error":
			yield(kv.KeyValue{Value: io.NopCloser(strings.NewReader(""))}, backendErr)
			return
		case "batch not found":
			yield(kv.KeyValue{}, ErrNotFound)
			return
		case "batch timeout":
			yield(kv.KeyValue{}, context.DeadlineExceeded)
			return
		case "cancel batch":
			cancel()
			return
		}
		for _, event := range events {
			key := eventStoreTestKey(event)
			switch mode {
			case "unexpected key":
				key = "unexpected"
			case "wrong identity":
				event.Name = "wrong"
			case "wrong RV":
				event.ResourceVersion++
			case "invalid action":
				event.Action = "invalid"
			}
			data, err := json.Marshal(event)
			require.NoError(t, err)
			var reader io.Reader = strings.NewReader(string(data))
			switch mode {
			case "invalid JSON":
				reader = strings.NewReader("{")
			case "reader error":
				reader = eventStoreErrorReader{err: backendErr}
			case "cancel reader":
				reader = eventStoreErrorReader{err: context.Canceled, cancel: cancel}
			}
			if !yield(kv.KeyValue{Key: key, Value: io.NopCloser(reader)}, nil) {
				return
			}
		}
		if mode == "late batch error" {
			yield(kv.KeyValue{}, backendErr)
		}
	}
}

func eventStoreTestEvents(count int) []Event {
	events := make([]Event, count)
	actions := []kv.DataAction{DataActionCreated, DataActionUpdated, DataActionDeleted}
	for i := range events {
		events[i] = Event{
			Namespace: "default", Group: "apps", Resource: "resource", Name: fmt.Sprintf("test-%03d", i),
			ResourceVersion: 1000 + int64(i/3), Action: actions[i%len(actions)], Folder: "folder",
		}
	}
	return events
}

func eventStoreTestKey(event Event) string {
	return EventKey{
		Namespace: event.Namespace, Group: event.Group, Resource: event.Resource, Name: event.Name,
		ResourceVersion: event.ResourceVersion, Action: event.Action, Folder: event.Folder,
	}.String()
}

type eventStoreKVProbe struct {
	KV
	t         *testing.T
	gets      int
	scans     []ListOptions
	batches   [][]string
	keysOpen  bool
	batchOpen bool
	readers   int
	closed    int
	keys      func(context.Context, string, ListOptions) iter.Seq2[string, error]
	batch     func(context.Context, string, []string) iter.Seq2[kv.KeyValue, error]
}

func (p *eventStoreKVProbe) assertClosed() {
	p.t.Helper()
	assert.False(p.t, p.keysOpen, "key cursor is still open")
	assert.False(p.t, p.batchOpen, "batch cursor is still open")
	assert.Equal(p.t, p.readers, p.closed, "readers are still open")
}

func (p *eventStoreKVProbe) Get(ctx context.Context, section, key string) (io.ReadCloser, error) {
	p.gets++
	return p.KV.Get(ctx, section, key)
}

func (p *eventStoreKVProbe) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		p.assertClosed()
		assert.Equal(p.t, eventsSection, section)
		p.scans = append(p.scans, opts)
		p.keysOpen = true
		defer func() { p.keysOpen = false }()
		keys := p.KV.Keys
		if p.keys != nil {
			keys = p.keys
		}
		keys(ctx, section, opts)(yield)
	}
}

func (p *eventStoreKVProbe) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	return func(yield func(kv.KeyValue, error) bool) {
		p.assertClosed()
		assert.Equal(p.t, eventsSection, section)
		p.batches = append(p.batches, slices.Clone(keys))
		p.batchOpen = true
		defer func() { p.batchOpen = false }()
		batch := p.KV.BatchGet
		if p.batch != nil {
			batch = p.batch
		}
		for pair, err := range batch(ctx, section, keys) {
			if pair.Value != nil {
				p.readers++
				pair.Value = &eventStoreProbeReader{ReadCloser: pair.Value, closed: &p.closed}
			}
			more := yield(pair, err)
			assert.Equal(p.t, p.readers, p.closed)
			if !more {
				return
			}
		}
	}
}

type eventStoreProbeReader struct {
	io.ReadCloser
	closed *int
}

func (r *eventStoreProbeReader) Close() error {
	*r.closed++
	return r.ReadCloser.Close()
}

type eventStoreErrorReader struct {
	err    error
	cancel context.CancelFunc
}

func (r eventStoreErrorReader) Read([]byte) (int, error) {
	if r.cancel != nil {
		r.cancel()
	}
	return 0, r.err
}

func TestEvent_JSONSerialization(t *testing.T) {
	const fields = `"namespace":"default","group":"apps","resource":"resource","name":"test-resource","resource_version":1000,"action":"updated","folder":"new-folder","previous_rv":999`
	// Match the pre-enrichment reader to verify it can still read new records.
	type legacyEvent struct {
		Namespace       string `json:"namespace"`
		Group           string `json:"group"`
		Resource        string `json:"resource"`
		Name            string `json:"name"`
		ResourceVersion int64  `json:"resource_version"`
		Action          string `json:"action"`
		Folder          string `json:"folder"`
		PreviousRV      int64  `json:"previous_rv"`
	}
	var expectedLegacy legacyEvent
	require.NoError(t, json.Unmarshal([]byte("{"+fields+"}"), &expectedLegacy))

	for _, tc := range []struct {
		name           string
		previous       string
		previousAction kv.DataAction
		previousFolder string
	}{
		{name: "legacy record"},
		{name: "null metadata", previous: `,"previous_action":null,"previous_folder":null`},
		{name: "empty action", previous: `,"previous_action":"","previous_folder":""`},
		{
			name:           "empty folder",
			previous:       `,"previous_action":"created","previous_folder":""`,
			previousAction: DataActionCreated,
		},
		{
			name:           "created",
			previous:       `,"previous_action":"created","previous_folder":"old-folder"`,
			previousAction: DataActionCreated,
			previousFolder: "old-folder",
		},
		{
			name:           "updated",
			previous:       `,"previous_action":"updated","previous_folder":"old-folder"`,
			previousAction: DataActionUpdated,
			previousFolder: "old-folder",
		},
		{
			name:           "deleted",
			previous:       `,"previous_action":"deleted","previous_folder":"old-folder"`,
			previousAction: DataActionDeleted,
			previousFolder: "old-folder",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var event Event
			require.NoError(t, json.Unmarshal([]byte("{"+fields+tc.previous+"}"), &event))
			require.Equal(t, tc.previousAction, event.PreviousAction)
			require.Equal(t, tc.previousFolder, event.PreviousFolder)

			data, err := json.Marshal(event)
			require.NoError(t, err)
			if tc.previousAction == "" {
				require.JSONEq(t, "{"+fields+`,"previous_folder":""}`, string(data))
			} else {
				require.JSONEq(t, "{"+fields+tc.previous+"}", string(data))
			}

			var roundTrip Event
			require.NoError(t, json.Unmarshal(data, &roundTrip))
			require.Equal(t, event, roundTrip)

			var legacy legacyEvent
			require.NoError(t, json.Unmarshal(data, &legacy))
			require.Equal(t, expectedLegacy, legacy)
		})
	}
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
	for i := range 75 {
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
	for i := range 75 {
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
			resultSnowflake := SubtractDurationFromSnowflake(baseSnowflake, tt.addTime)

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

	// List events since 90 minutes ago using SubtractDurationFromSnowflake
	sinceRV := SubtractDurationFromSnowflake(snowflakeFromTime(now), 90*time.Minute)
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

	// List events since 30 minutes ago using SubtractDurationFromSnowflake
	sinceRV = SubtractDurationFromSnowflake(snowflakeFromTime(now), 30*time.Minute)
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
