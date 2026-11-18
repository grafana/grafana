package sql

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func TestPollingNotifierConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		config      *pollingNotifierConfig
		expectedErr error
	}{
		{
			name: "valid config",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: nil,
		},
		{
			name: "missing historyPoll",
			config: &pollingNotifierConfig{
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errHistoryPollRequired,
		},
		{
			name: "missing listLatestRVs",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errListLatestRVsRequired,
		},
		{
			name: "missing bulkLock",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errBulkLockRequired,
		},
		{
			name: "missing logger",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errLogRequired,
		},
		{
			name: "invalid watch buffer size",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 0,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errInvalidWatchBufferSize,
		},
		{
			name: "invalid polling interval",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: 0,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errInvalidPollingInterval,
		},
		{
			name: "missing done channel",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errDoneRequired,
		},
		{
			name: "missing dialect",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
			},
			expectedErr: errDialectRequired,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := tt.config.validate()
			if tt.expectedErr != nil {
				require.ErrorIs(t, err, tt.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestPollingNotifier(t *testing.T) {
	t.Parallel()

	t.Run("notify returns channel and starts polling", func(t *testing.T) {
		t.Parallel()

		done := make(chan struct{})
		defer close(done)

		testEvent := &historyPollResponse{
			Key: resourcepb.ResourceKey{
				Namespace: "test-ns",
				Group:     "test-group",
				Resource:  "test-resource",
				Name:      "test-name",
			},
			ResourceVersion: 2,
			Folder:          "test-folder",
			Value:           []byte(`{"test": "data"}`),
			Action:          1,
		}

		var listLatestRVsCalledCounter int
		listLatestRVs := func(ctx context.Context) (groupResourceRV, error) {
			// On the first call return 0, then the highest known RV.
			var value int64 = 0
			if listLatestRVsCalledCounter > 0 {
				value = testEvent.ResourceVersion
			}
			listLatestRVsCalledCounter++
			return groupResourceRV{
				"test-group": map[string]int64{
					"test-resource": value,
				},
			}, nil
		}

		var historyPollCalledCounter int
		once := sync.Once{}
		historyPoll := func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
			// only assert the first time - this may be called multiple times
			// depending on the host hardware etc, due to timing issues...
			historyPollCalledCounter++
			once.Do(func() {
				require.Equal(t, "test-group", grp)
				require.Equal(t, "test-resource", res)
				require.Equal(t, int64(0), since)
			})
			return []*historyPollResponse{testEvent}, nil
		}

		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             &logging.NoOpLogger{},
			bulkLock:        &bulkLock{},
			listLatestRVs:   listLatestRVs,
			historyPoll:     historyPoll,
			done:            done,
		}

		notifier, err := newPollingNotifier(cfg)
		require.NoError(t, err)
		require.NotNil(t, notifier)

		events, err := notifier.notify(context.Background())
		require.NoError(t, err)
		require.NotNil(t, events)

		select {
		case event := <-events:
			require.NotNil(t, event)
			require.Equal(t, "test-ns", event.Key.Namespace)
			require.Equal(t, "test-group", event.Key.Group)
			require.Equal(t, "test-resource", event.Key.Resource)
			require.Equal(t, "test-name", event.Key.Name)
			require.Equal(t, int64(2), event.ResourceVersion)
			require.Equal(t, "test-folder", event.Folder)
			require.True(t, listLatestRVsCalledCounter > 0, "listLatestRVs should be called at least once")
			require.True(t, historyPollCalledCounter == 1, "historyPoll should be called exactly once")
		case <-time.After(100 * time.Millisecond):
			t.Fatal("timeout waiting for event")
		}
	})

	t.Run("handles polling errors gracefully", func(t *testing.T) {
		t.Parallel()

		done := make(chan struct{})
		defer close(done)

		listLatestRVs := func(ctx context.Context) (groupResourceRV, error) {
			return groupResourceRV{
				"test-group": map[string]int64{
					"test-resource": 0,
				},
			}, nil
		}

		historyPoll := func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
			return nil, errTest
		}

		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             &logging.NoOpLogger{},
			bulkLock:        &bulkLock{},
			listLatestRVs:   listLatestRVs,
			historyPoll:     historyPoll,
			done:            done,
		}

		notifier, err := newPollingNotifier(cfg)
		require.NoError(t, err)
		require.NotNil(t, notifier)

		events, err := notifier.notify(context.Background())
		require.NoError(t, err)
		require.NotNil(t, events)

		// Verify channel remains open despite error
		select {
		case _, ok := <-events:
			require.True(t, ok, "channel should remain open")
		case <-time.After(50 * time.Millisecond):
			// Expected - no events due to error
		}
	})

	t.Run("stops polling when done channel is closed", func(t *testing.T) {
		t.Parallel()

		done := make(chan struct{})

		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             &logging.NoOpLogger{},
			bulkLock:        &bulkLock{},
			listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
			historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
				return nil, nil
			},
			done: done,
		}

		notifier, err := newPollingNotifier(cfg)
		require.NoError(t, err)
		require.NotNil(t, notifier)

		events, err := notifier.notify(context.Background())
		require.NoError(t, err)
		require.NotNil(t, events)

		close(done)

		select {
		case _, ok := <-events:
			require.False(t, ok, "events channel should be closed")
		case <-time.After(50 * time.Millisecond):
			t.Fatal("timeout waiting for events channel to close")
		}
	})

	t.Run("stops polling when context is cancelled", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())

		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             &logging.NoOpLogger{},
			bulkLock:        &bulkLock{},
			listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
			historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
				return nil, nil
			},
			done: make(chan struct{}),
		}

		notifier, err := newPollingNotifier(cfg)
		require.NoError(t, err)
		require.NotNil(t, notifier)

		events, err := notifier.notify(ctx)
		require.NoError(t, err)
		require.NotNil(t, events)

		cancel()

		select {
		case _, ok := <-events:
			require.False(t, ok, "events channel should be closed")
		case <-time.After(time.Second):
			t.Fatal("timeout waiting for events channel to close")
		}
	})
}

// fakePollStore models how rvmanager commits a batch: rows get consecutive RVs
// from stored+1, then the resource_version table stores one past the last.
type fakePollStore struct {
	mu      sync.Mutex
	tableRV map[string]int64
	history []*historyPollResponse
	polls   int
	failing int
	// duringPoll runs in historyPoll before (selected=false) and after
	// (selected=true) the rows are read. Set it and failing before starting
	// the poller.
	duringPoll func(selected bool)
}

func newFakePollStore() *fakePollStore {
	return &fakePollStore{tableRV: map[string]int64{}}
}

func (s *fakePollStore) commit(grp, res string, names ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rv := s.tableRV[grp+"/"+res] + 1
	for _, name := range names {
		s.history = append(s.history, &historyPollResponse{
			Key:             resourcepb.ResourceKey{Namespace: "default", Group: grp, Resource: res, Name: name},
			ResourceVersion: rv,
			Action:          int(resourcepb.WatchEvent_ADDED),
		})
		rv++
	}
	s.tableRV[grp+"/"+res] = rv
}

func (s *fakePollStore) listLatestRVs(context.Context) (groupResourceRV, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	grv := groupResourceRV{}
	for key, rv := range s.tableRV {
		grp, res, _ := strings.Cut(key, "/")
		if grv[grp] == nil {
			grv[grp] = map[string]int64{}
		}
		grv[grp][res] = rv
	}
	return grv, nil
}

func (s *fakePollStore) historyPoll(_ context.Context, grp, res string, since int64) ([]*historyPollResponse, error) {
	if s.duringPoll != nil {
		s.duringPoll(false)
	}
	s.mu.Lock()
	s.polls++
	if s.failing > 0 {
		s.failing--
		s.mu.Unlock()
		return nil, errTest
	}
	var out []*historyPollResponse
	for _, rec := range s.history {
		if rec.Key.Group == grp && rec.Key.Resource == res && rec.ResourceVersion > since {
			out = append(out, rec)
		}
	}
	s.mu.Unlock()
	if s.duringPoll != nil {
		s.duringPoll(true)
	}
	return out, nil
}

func (s *fakePollStore) pollCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.polls
}

const fakePollInterval = 100 * time.Millisecond

// startFakePoller must run inside a synctest bubble.
func startFakePoller(t *testing.T, store *fakePollStore) <-chan *resource.WrittenEvent {
	t.Helper()
	done := make(chan struct{})
	t.Cleanup(func() { close(done) })
	n, err := newPollingNotifier(&pollingNotifierConfig{
		dialect:         sqltemplate.PostgreSQL,
		pollingInterval: fakePollInterval,
		watchBufferSize: 100,
		log:             &logging.NoOpLogger{},
		bulkLock:        &bulkLock{},
		listLatestRVs:   store.listLatestRVs,
		historyPoll:     store.historyPoll,
		done:            done,
	})
	require.NoError(t, err)
	events, err := n.notify(t.Context())
	require.NoError(t, err)
	// Keep the test's wakeups half an interval off the poll ticks.
	time.Sleep(fakePollInterval / 2)
	return events
}

// waitTicks lets n poll ticks pass.
func waitTicks(n int) {
	time.Sleep(time.Duration(n) * fakePollInterval)
	synctest.Wait()
}

func drainEvents(events <-chan *resource.WrittenEvent) []string {
	var got []string
	for {
		select {
		case e := <-events:
			got = append(got, fmt.Sprintf("%s/%d", e.Key.Name, e.ResourceVersion))
		default:
			return got
		}
	}
}

func TestPollingNotifierPollsOnlyChangedCollections(t *testing.T) {
	t.Run("idle collection is not polled after its writes are delivered", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			store := newFakePollStore()
			store.commit("g", "r", "existing")
			events := startFakePoller(t, store)

			waitTicks(10)
			require.Empty(t, drainEvents(events))
			require.Equal(t, 0, store.pollCount())

			store.commit("g", "r", "a", "b", "c")
			waitTicks(1)
			require.Equal(t, []string{"a/3", "b/4", "c/5"}, drainEvents(events))
			require.Equal(t, 1, store.pollCount())

			waitTicks(50)
			require.Empty(t, drainEvents(events))
			require.Equal(t, 1, store.pollCount(), "idle collection must not be polled")

			// Another instance writes to the same collection.
			store.commit("g", "r", "d")
			waitTicks(50)
			require.Equal(t, []string{"d/7"}, drainEvents(events))
			require.Equal(t, 2, store.pollCount())

			// An RV bump without history rows, like the bulk import's.
			store.commit("g", "r")
			waitTicks(50)
			require.Empty(t, drainEvents(events))
			require.Equal(t, 3, store.pollCount())
		})
	})

	t.Run("new collection is delivered from the start", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			store := newFakePollStore()
			events := startFakePoller(t, store)

			store.commit("g", "new", "a", "b")
			waitTicks(50)
			require.Equal(t, []string{"a/1", "b/2"}, drainEvents(events))
			require.Equal(t, 1, store.pollCount())
		})
	})

	t.Run("writes committed during a poll are delivered once", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			store := newFakePollStore()
			store.commit("g", "r", "existing")
			store.duringPoll = func(selected bool) {
				switch {
				case !selected && store.pollCount() == 0:
					// After listLatestRVs, before the rows are read.
					store.commit("g", "r", "b")
				case selected && store.pollCount() == 1:
					// After the rows are read.
					store.commit("g", "r", "c")
				}
			}
			events := startFakePoller(t, store)

			store.commit("g", "r", "a")
			waitTicks(50)
			require.Equal(t, []string{"a/3", "b/5", "c/7"}, drainEvents(events))
			require.Equal(t, 2, store.pollCount())
		})
	})

	t.Run("failed poll is retried", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			store := newFakePollStore()
			store.commit("g", "r", "existing")
			store.failing = 2
			events := startFakePoller(t, store)

			store.commit("g", "r", "a")
			waitTicks(50)
			require.Equal(t, []string{"a/3"}, drainEvents(events))
			require.Equal(t, 3, store.pollCount())
		})
	})
}
