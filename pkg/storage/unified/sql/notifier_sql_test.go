package sql

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
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
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
			},
			expectedErr: nil,
		},
		{
			name: "missing historyPoll",
			config: &pollingNotifierConfig{
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
			},
			expectedErr: errHistoryPollRequired,
		},
		{
			name: "missing listLatestRVs",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
			},
			expectedErr: errListLatestRVsRequired,
		},
		{
			name: "missing batchLock",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
			},
			expectedErr: errBatchLockRequired,
		},
		{
			name: "missing tracer",
			config: &pollingNotifierConfig{
				historyPoll: func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
					return nil, nil
				},
				listLatestRVs:   func(ctx context.Context) (groupResourceRV, error) { return nil, nil },
				batchLock:       &batchLock{},
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
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
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				watchBufferSize: 10,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
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
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 0,
				pollingInterval: time.Second,
				done:            make(chan struct{}),
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
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: 0,
				done:            make(chan struct{}),
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
				batchLock:       &batchLock{},
				tracer:          noop.NewTracerProvider().Tracer("test"),
				log:             log.NewNopLogger(),
				watchBufferSize: 10,
				pollingInterval: time.Second,
			},
			expectedErr: errDoneRequired,
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

		// Create test data
		testEvent := &historyPollResponse{
			Key: resource.ResourceKey{
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

		// Setup mock functions
		var latestRVsCalled bool
		listLatestRVs := func(ctx context.Context) (groupResourceRV, error) {
			latestRVsCalled = true
			return groupResourceRV{
				"test-group": map[string]int64{
					"test-resource": 0,
				},
			}, nil
		}

		var historyPollCalled bool
		historyPoll := func(ctx context.Context, grp string, res string, since int64) ([]*historyPollResponse, error) {
			historyPollCalled = true
			require.Equal(t, "test-group", grp)
			require.Equal(t, "test-resource", res)
			require.Equal(t, int64(0), since)
			return []*historyPollResponse{testEvent}, nil
		}

		// Create notifier
		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             log.NewNopLogger(),
			tracer:          noop.NewTracerProvider().Tracer("test"),
			batchLock:       &batchLock{},
			listLatestRVs:   listLatestRVs,
			historyPoll:     historyPoll,
			done:            done,
		}

		notifier, err := newPollingNotifier(cfg)
		require.NoError(t, err)
		require.NotNil(t, notifier)

		// Start notification channel
		events, err := notifier.notify(context.Background())
		require.NoError(t, err)
		require.NotNil(t, events)

		// Wait for and verify event
		select {
		case event := <-events:
			require.NotNil(t, event)
			require.Equal(t, "test-ns", event.Key.Namespace)
			require.Equal(t, "test-group", event.Key.Group)
			require.Equal(t, "test-resource", event.Key.Resource)
			require.Equal(t, "test-name", event.Key.Name)
			require.Equal(t, int64(2), event.ResourceVersion)
			require.Equal(t, "test-folder", event.Folder)
			require.True(t, latestRVsCalled, "listLatestRVs should be called")
			require.True(t, historyPollCalled, "historyPoll should be called")
		case <-time.After(100 * time.Millisecond):
			t.Fatal("timeout waiting for event")
		}
	})

	t.Run("handles polling errors gracefully", func(t *testing.T) {
		t.Parallel()

		done := make(chan struct{})
		defer close(done)

		// Setup mock functions with error
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

		// Create notifier
		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             log.NewNopLogger(),
			tracer:          noop.NewTracerProvider().Tracer("test"),
			batchLock:       &batchLock{},
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

		// Create notifier
		cfg := &pollingNotifierConfig{
			dialect:         sqltemplate.SQLite,
			pollingInterval: 10 * time.Millisecond,
			watchBufferSize: 10,
			log:             log.NewNopLogger(),
			tracer:          noop.NewTracerProvider().Tracer("test"),
			batchLock:       &batchLock{},
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

		// Close done channel
		close(done)

		// Verify events channel is closed
		select {
		case _, ok := <-events:
			require.False(t, ok, "events channel should be closed")
		case <-time.After(50 * time.Millisecond):
			t.Fatal("timeout waiting for events channel to close")
		}
	})
}
