package debouncer

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestDebouncer(t *testing.T) {
	t.Run("should process values after min wait", func(t *testing.T) {
		var processedMu sync.Mutex
		processedValues := make(map[string]int)

		group, err := NewGroup(DebouncerOpts[string]{
			BufferSize: 10,
			ProcessHandler: func(ctx context.Context, value string) error {
				processedMu.Lock()
				processedValues[value]++
				processedMu.Unlock()
				return nil
			},
			MinWait: 10 * time.Millisecond,
			MaxWait: 500 * time.Millisecond,
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		group.Start(ctx)

		require.NoError(t, group.Add("key1"))
		require.NoError(t, group.Add("key2"))
		// Should be deduplicated.
		require.NoError(t, group.Add("key1"))

		require.Eventually(t, func() bool {
			// We should have processed key1 and key2 exactly once.
			processedMu.Lock()
			if processedValues["key1"] == 1 && processedValues["key2"] == 1 {
				return true
			}
			processedMu.Unlock()
			return false
		}, time.Millisecond*200, time.Millisecond*20)
	})

	t.Run("should process values after max wait", func(t *testing.T) {
		processed := make(map[string]int, 1)
		clockMock := clock.NewMock()

		group, err := NewGroup(DebouncerOpts[string]{
			BufferSize: 10,
			ProcessHandler: func(ctx context.Context, value string) error {
				processed[value]++
				return nil
			},
			MinWait: 50 * time.Millisecond,
			MaxWait: 500 * time.Millisecond,
			clock:   clockMock,
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		group.Start(ctx)

		start := clockMock.Now()

		for counter := 0; counter < 25; counter++ {
			_ = group.Add("key1")
			clockMock.Add(time.Millisecond * 40)
			if processed["key1"] == 1 {
				break
			}
		}

		// Make sure that the execution happened after the maxTimeout of 500ms, but before the next MaxTimeout.
		require.WithinDuration(t, start.Add(time.Millisecond*500), clockMock.Now(), time.Millisecond*499)
	})

	t.Run("should handle buffer full", func(t *testing.T) {
		group, err := NewGroup(DebouncerOpts[string]{
			BufferSize:     1,
			ProcessHandler: func(ctx context.Context, value string) error { return nil },
			MinWait:        10 * time.Millisecond,
			MaxWait:        100 * time.Millisecond,
		})
		require.NoError(t, err)

		require.NoError(t, group.Add("key1"))
		// Buffer should be full by now as we are not reading from it yet.
		require.ErrorIs(t, group.Add("key2"), ErrBufferFull)
	})

	t.Run("should track metrics", func(t *testing.T) {
		var wg sync.WaitGroup

		group, err := NewGroup(DebouncerOpts[string]{
			BufferSize: 10,
			ProcessHandler: func(ctx context.Context, value string) error {
				wg.Done()
				return nil
			},
			MinWait: 10 * time.Millisecond,
			MaxWait: 100 * time.Millisecond,

			Name: "test",
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		group.Start(ctx)

		wg.Add(1)
		require.NoError(t, group.Add("key1"))
		require.NoError(t, group.Add("key1"))

		wg.Wait()

		require.Equal(t, float64(2), testutil.ToFloat64(group.metrics.itemsAddedCounter))
		require.Equal(t, float64(1), testutil.ToFloat64(group.metrics.itemsProcessedCounter))
	})

	t.Run("should handle errors", func(t *testing.T) {
		var (
			wg          sync.WaitGroup
			errs        = make(chan error, 10)
			expectedErr = errors.New("test error")
		)

		group, err := NewGroup(DebouncerOpts[string]{
			BufferSize: 10,
			ProcessHandler: func(ctx context.Context, value string) error {
				wg.Done()
				return expectedErr
			},
			MinWait:      10 * time.Millisecond,
			MaxWait:      100 * time.Millisecond,
			Reg:          prometheus.NewPedanticRegistry(),
			Name:         "test_errors",
			ErrorHandler: func(_ string, err error) { errs <- err },
		})
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		group.Start(ctx)

		wg.Add(1)
		require.NoError(t, group.Add("key1"))

		wg.Wait()

		select {
		case err := <-errs:
			require.Equal(t, expectedErr, err)
		default:
			t.Fatal("expected error")
		}

		require.Equal(t, float64(1), testutil.ToFloat64(group.metrics.processingErrorsCounter))
	})

	t.Run("should gracefully handle stops", func(t *testing.T) {
		// Create a channel to signal when processing is done.
		done := make(chan struct{})

		group, err := NewGroup(DebouncerOpts[string]{
			BufferSize: 10,
			ProcessHandler: func(ctx context.Context, item string) error {
				// Start a goroutine to wait for context cancellation.
				go func() {
					<-ctx.Done()
					close(done)
				}()
				return nil
			},
			MinWait: 50 * time.Millisecond,
			MaxWait: 500 * time.Millisecond,
		})
		require.NoError(t, err)

		// Start the group with a context
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		group.Start(ctx)

		// Send an item to trigger processing.
		require.NoError(t, group.Add("key-1"))

		// Give the group a moment to process the item.
		time.Sleep(100 * time.Millisecond)

		// Stop the group, which should cancel the context.
		group.Stop()

		// Wait for the done signal or timeout.
		select {
		case <-done:
			// Success - the group was stopped and the context was canceled
		case <-time.After(time.Second):
			t.Fatal("Timed out waiting for group to stop")
		}
	})
}
