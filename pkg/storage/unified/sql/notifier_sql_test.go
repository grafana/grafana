package sql

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

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
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
				dialect:         sqltemplate.SQLite,
			},
			expectedErr: errBulkLockRequired,
		},
		{
			name: "missing tracer",
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
			expectedErr: errTracerRequired,
		},
		{
			name: "missing logger",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				bulkLock:        &bulkLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
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
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             &logging.NoOpLogger{},
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
			},
			expectedErr: errDialectRequired,
		},
	}

	for _, tt := range tests {
		tt := tt
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
			tracer:          noop.NewTracerProvider().Tracer("test"),
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
			tracer:          noop.NewTracerProvider().Tracer("test"),
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
			tracer:          noop.NewTracerProvider().Tracer("test"),
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
			tracer:          noop.NewTracerProvider().Tracer("test"),
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
