package util

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestItem is a simple test item for the debouncer
type TestItem struct {
	ID   string
	Data string
}

func TestDebouncer_Deduplication(t *testing.T) {
	// Create a key function that extracts a string key from a TestItem
	keyFunc := func(item *TestItem) string {
		return item.ID
	}

	// Create a new debouncer with a buffer size of 10
	debouncer := NewDebouncer(DebouncerCfg[*TestItem]{
		BufferSize: 10,
		KeyFunc:    keyFunc,
		MinWait:    50 * time.Millisecond,
		MaxWait:    100 * time.Millisecond,
	})

	// Create a map to track processed items and a mutex to protect it
	processedItems := make(map[string]int)
	processedMutex := sync.Mutex{}

	// Define a processing function that counts each item
	processFunc := func(ctx context.Context, item *TestItem) error {
		processedMutex.Lock()
		processedItems[item.ID]++
		processedMutex.Unlock()

		return nil
	}

	// Start the debouncer with a context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	debouncer.Start(ctx, processFunc)
	defer debouncer.Stop()

	// Test case 1: Send the same item multiple times in quick succession
	// It should only be processed once due to debouncing
	for i := 0; i < 5; i++ {
		success := debouncer.Add(&TestItem{ID: "item1", Data: "data" + string(rune('A'+i))})
		require.True(t, success)
	}

	// Wait for the max timer to expire to ensure processing
	time.Sleep(150 * time.Millisecond)

	// Check that the item was processed once
	processedMutex.Lock()
	require.Equal(t, 1, processedItems["item1"])
	processedMutex.Unlock()

	// Test case 2: Send different items
	// Each should be processed once
	success := debouncer.Add(&TestItem{ID: "item2", Data: "data2"})
	require.True(t, success)

	success = debouncer.Add(&TestItem{ID: "item3", Data: "data3"})
	require.True(t, success)

	// Wait for the min timer to expire
	time.Sleep(150 * time.Millisecond)

	// Check that each item was processed once
	processedMutex.Lock()
	require.Equal(t, 1, processedItems["item1"])
	require.Equal(t, 1, processedItems["item2"])
	require.Equal(t, 1, processedItems["item3"])
	processedMutex.Unlock()

	// Test case 3: Wait longer than the min wait time and send the same item again
	// It should be processed again
	time.Sleep(100 * time.Millisecond)

	// Send the same item again
	success = debouncer.Add(&TestItem{ID: "item1", Data: "data1-updated"})
	require.True(t, success)

	// Wait for the min timer to expire
	time.Sleep(150 * time.Millisecond)

	// Check that the item was processed again
	processedMutex.Lock()
	require.Equal(t, 2, processedItems["item1"])
	processedMutex.Unlock()
}

func TestDebouncer_BufferFull(t *testing.T) {
	// Create a key function that extracts a string key from a TestItem
	keyFunc := func(item *TestItem) string {
		return item.ID
	}

	// Create a new debouncer with a very small buffer size
	debouncer := NewDebouncer(DebouncerCfg[*TestItem]{
		BufferSize: 1,
		KeyFunc:    keyFunc,
		MinWait:    50 * time.Millisecond,
		MaxWait:    100 * time.Millisecond,
	})

	// Fill the buffer but don't start the debouncer
	success := debouncer.Add(&TestItem{ID: "item1", Data: "data1"})
	require.True(t, success)

	// The next attempt should fail because the buffer is full
	success = debouncer.Add(&TestItem{ID: "item2", Data: "data2"})
	require.False(t, success)
}

func TestDebouncer_StopWorker(t *testing.T) {
	// Create a key function that extracts a string key from a TestItem
	keyFunc := func(item *TestItem) string {
		return item.ID
	}

	// Create a new debouncer
	debouncer := NewDebouncer(DebouncerCfg[*TestItem]{
		BufferSize: 10,
		KeyFunc:    keyFunc,
		MinWait:    50 * time.Millisecond,
		MaxWait:    100 * time.Millisecond,
	})

	// Create a channel to signal when processing is done
	done := make(chan struct{})

	// Define a processing function that signals when context is canceled
	processFunc := func(ctx context.Context, item *TestItem) error {
		// Start a goroutine to wait for context cancellation
		go func() {
			<-ctx.Done()
			close(done)
		}()
		return nil
	}

	// Start the debouncer with a context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	debouncer.Start(ctx, processFunc)

	// Send an item to trigger processing
	success := debouncer.Add(&TestItem{ID: "item1", Data: "data1"})
	require.True(t, success)

	// Give the debouncer a moment to process the item
	time.Sleep(50 * time.Millisecond)

	// Stop the debouncer, which should cancel the context
	debouncer.Stop()

	// Wait for the done signal or timeout
	select {
	case <-done:
		// Success - the debouncer was stopped and the context was canceled
	case <-time.After(time.Second):
		t.Fatal("Timed out waiting for debouncer to stop")
	}
}

func TestDebouncer_MaxWaitTime(t *testing.T) {
	// Create a key function that extracts a string key from a TestItem
	keyFunc := func(item *TestItem) string {
		return item.ID
	}

	// Create a new debouncer with a long min wait but short max wait
	debouncer := NewDebouncer(DebouncerCfg[*TestItem]{
		BufferSize: 10,
		KeyFunc:    keyFunc,
		MinWait:    500 * time.Millisecond, // Long min wait
		MaxWait:    200 * time.Millisecond, // Shorter max wait to force processing
	})

	// Create a map to track processed items and a mutex to protect it
	processedItems := make(map[string]int)
	processedMutex := sync.Mutex{}

	// Define a processing function that counts each item
	processFunc := func(ctx context.Context, item *TestItem) error {
		processedMutex.Lock()
		processedItems[item.ID]++
		processedMutex.Unlock()

		return nil
	}

	// Start the debouncer with a context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	debouncer.Start(ctx, processFunc)
	defer debouncer.Stop()

	// Send an item
	success := debouncer.Add(&TestItem{ID: "item1", Data: "data1"})
	require.True(t, success)

	// Wait for the max timer to expire but not the min timer
	time.Sleep(300 * time.Millisecond)

	// Check that the item was processed due to max wait time
	processedMutex.Lock()
	require.Equal(t, 1, processedItems["item1"])
	processedMutex.Unlock()
}

func TestDebouncer(t *testing.T) {
	t.Run("should process values after min wait", func(t *testing.T) {
		// Create a debouncer with a short min wait
		debouncer := NewDebouncer(DebouncerCfg[string]{
			BufferSize: 10,
			KeyFunc:    func(s string) string { return s },
			MinWait:    10 * time.Millisecond,
			MaxWait:    100 * time.Millisecond,
		})

		// Create a channel to receive processed values
		processed := make(chan string, 10)
		var processedMu sync.Mutex
		processedValues := make(map[string]int)

		// Start the debouncer
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		debouncer.Start(ctx, func(ctx context.Context, value string) error {
			processed <- value
			processedMu.Lock()
			processedValues[value]++
			processedMu.Unlock()
			return nil
		})

		// Add values
		assert.True(t, debouncer.Add("key1"))
		assert.True(t, debouncer.Add("key2"))
		assert.True(t, debouncer.Add("key1")) // Should replace the previous key1

		// Wait for processing
		time.Sleep(50 * time.Millisecond)

		// Check processed values
		close(processed)

		// We should have processed key1 and key2
		processedMu.Lock()
		assert.Equal(t, 1, processedValues["key1"])
		assert.Equal(t, 1, processedValues["key2"])
		processedMu.Unlock()
	})

	t.Run("should process values after max wait", func(t *testing.T) {
		// Create a debouncer with a long min wait but short max wait
		debouncer := NewDebouncer(DebouncerCfg[string]{
			BufferSize: 10,
			KeyFunc:    func(s string) string { return s },
			MinWait:    100 * time.Millisecond,
			MaxWait:    20 * time.Millisecond,
		})

		// Create a channel to receive processed values
		processed := make(chan string, 10)

		// Start the debouncer
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		debouncer.Start(ctx, func(ctx context.Context, value string) error {
			processed <- value
			return nil
		})

		// Add a value
		assert.True(t, debouncer.Add("key1"))

		// Wait for max wait to trigger
		time.Sleep(30 * time.Millisecond)

		// Check processed values
		select {
		case v := <-processed:
			assert.Equal(t, "key1", v)
		default:
			t.Fatal("expected key1 to be processed")
		}
	})

	t.Run("should handle buffer full", func(t *testing.T) {
		// Create a debouncer with a small buffer
		debouncer := NewDebouncer(DebouncerCfg[string]{
			BufferSize: 1,
			KeyFunc:    func(s string) string { return s },
			MinWait:    10 * time.Millisecond,
			MaxWait:    100 * time.Millisecond,
		})

		// Fill the buffer
		assert.True(t, debouncer.Add("key1"))
		assert.False(t, debouncer.Add("key2")) // Buffer is full
	})

	t.Run("should track metrics", func(t *testing.T) {
		// Create a registry for testing
		reg := prometheus.NewRegistry()

		// Create a debouncer with metrics
		debouncer := NewDebouncer(DebouncerCfg[string]{
			BufferSize:        10,
			KeyFunc:           func(s string) string { return s },
			MinWait:           10 * time.Millisecond,
			MaxWait:           100 * time.Millisecond,
			MetricsRegisterer: reg,
			Name:              "test",
		})

		// Start the debouncer
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		var wg sync.WaitGroup
		wg.Add(1)
		debouncer.Start(ctx, func(ctx context.Context, value string) error {
			wg.Done()
			return nil
		})

		// Add a value
		assert.True(t, debouncer.Add("key1"))

		// Wait for processing
		wg.Wait()

		// Check metrics
		assert.Equal(t, float64(1), testutil.ToFloat64(debouncer.metrics.itemsAddedCounter))
		assert.Equal(t, float64(1), testutil.ToFloat64(debouncer.metrics.itemsProcessedCounter))
	})

	t.Run("should handle errors", func(t *testing.T) {
		// Create a registry for testing
		reg := prometheus.NewRegistry()

		// Create a channel to receive errors
		errors := make(chan error, 10)

		// Create a debouncer with error handling
		debouncer := NewDebouncer(DebouncerCfg[string]{
			BufferSize:        10,
			KeyFunc:           func(s string) string { return s },
			MinWait:           10 * time.Millisecond,
			MaxWait:           100 * time.Millisecond,
			MetricsRegisterer: reg,
			Name:              "test_errors",
			ErrorHandler:      func(_ string, err error) { errors <- err },
		})

		// Start the debouncer
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		expectedErr := assert.AnError
		var wg sync.WaitGroup
		wg.Add(1)
		debouncer.Start(ctx, func(ctx context.Context, value string) error {
			wg.Done()
			return expectedErr
		})

		// Add a value
		assert.True(t, debouncer.Add("key1"))

		// Wait for processing
		wg.Wait()

		// Check errors
		select {
		case err := <-errors:
			assert.Equal(t, expectedErr, err)
		default:
			t.Fatal("expected error")
		}

		// Check metrics
		assert.Equal(t, float64(1), testutil.ToFloat64(debouncer.metrics.processingErrorsCounter))
	})
}
