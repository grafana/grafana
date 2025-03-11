package sql

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
)

func TestHistoryPruner_Deduplication(t *testing.T) {
	// Create a new history pruner with a buffer size of 10
	pruner := newHistoryPruner(&historyPrunerCfg{
		bufferSize: 10,
		metrics:    nil,
		keyFunc: func(key *resource.ResourceKey) string {
			return key.Namespace + ":" + key.Group + ":" + key.Resource
		},
		minWait: 50 * time.Millisecond,
		maxWait: 100 * time.Millisecond,
	})

	// Create a map to track processed keys and a mutex to protect it
	processedKeys := make(map[string]int)
	processedMutex := sync.Mutex{}

	// Define a processing function that counts each key
	processFunc := func(ctx context.Context, key *resource.ResourceKey) error {
		keyStr := createKeyString(key)

		processedMutex.Lock()
		processedKeys[keyStr]++
		processedMutex.Unlock()

		return nil
	}

	// Start the worker with a context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pruner.startWorker(ctx, processFunc)
	defer pruner.stopWorker()

	// Test case 1: Send the same key multiple times in quick succession
	// It should only be processed once due to debouncing
	for i := 0; i < 5; i++ {
		err := pruner.Prune("default", "core", "dashboard")
		require.NoError(t, err)
	}

	// Wait for the max timer to expire to ensure processing
	time.Sleep(150 * time.Millisecond)

	// Check that the key was processed once
	processedMutex.Lock()
	require.Equal(t, 1, processedKeys["default:core:dashboard"])
	processedMutex.Unlock()

	// Test case 2: Send different keys
	// Each should be processed once
	err := pruner.Prune("default", "core", "folder")
	require.NoError(t, err)

	err = pruner.Prune("default", "alerting", "rule")
	require.NoError(t, err)

	// Wait for the min timer to expire
	time.Sleep(150 * time.Millisecond)

	// Check that each key was processed once
	processedMutex.Lock()
	require.Equal(t, 1, processedKeys["default:core:dashboard"])
	require.Equal(t, 1, processedKeys["default:core:folder"])
	require.Equal(t, 1, processedKeys["default:alerting:rule"])
	processedMutex.Unlock()

	// Test case 3: Wait longer than the min wait time and send the same key again
	// It should be processed again
	time.Sleep(100 * time.Millisecond)

	// Send the same key again
	err = pruner.Prune("default", "core", "dashboard")
	require.NoError(t, err)

	// Wait for the min timer to expire
	time.Sleep(150 * time.Millisecond)

	// Check that the key was processed again
	processedMutex.Lock()
	require.Equal(t, 2, processedKeys["default:core:dashboard"])
	processedMutex.Unlock()
}

func TestHistoryPruner_BufferFull(t *testing.T) {
	// Create a new history pruner with a very small buffer size
	pruner := newHistoryPruner(&historyPrunerCfg{
		bufferSize: 1,
		metrics:    nil,
		keyFunc: func(key *resource.ResourceKey) string {
			return key.Namespace + ":" + key.Group + ":" + key.Resource
		},
	})
	// Fill the buffer but don't start the worker
	err := pruner.Prune("default", "core", "dashboard")
	require.NoError(t, err)

	// The next attempt should fail with ErrPruneBufferFull
	err = pruner.Prune("default", "core", "folder")
	require.Error(t, err)
	require.Equal(t, errPruneBufferFull, err)
}

func TestHistoryPruner_StopWorker(t *testing.T) {
	// Create a new history pruner
	pruner := newHistoryPruner(&historyPrunerCfg{
		bufferSize: 10,
		metrics:    nil,
		keyFunc: func(key *resource.ResourceKey) string {
			return key.Namespace + ":" + key.Group + ":" + key.Resource
		},
	})
	// Override the default wait times for testing
	pruner.setMinWait(100 * time.Millisecond)
	pruner.setMaxWait(500 * time.Millisecond)

	// Create a channel to signal when processing is done
	done := make(chan struct{})

	// Define a processing function that signals when context is canceled
	processFunc := func(ctx context.Context, key *resource.ResourceKey) error {
		// Start a goroutine to wait for context cancellation
		go func() {
			<-ctx.Done()
			close(done)
		}()
		return nil
	}

	// Start the worker with a context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pruner.startWorker(ctx, processFunc)

	// Send a key to trigger processing
	err := pruner.Prune("default", "core", "dashboard")
	require.NoError(t, err)

	// Give the worker a moment to process the key
	time.Sleep(50 * time.Millisecond)

	// Stop the worker, which should cancel the context
	pruner.stopWorker()

	// Wait for the done signal or timeout
	select {
	case <-done:
		// Success - the worker was stopped and the context was canceled
	case <-time.After(time.Second):
		t.Fatal("Timed out waiting for worker to stop")
	}
}

func TestHistoryPruner_MaxWaitTime(t *testing.T) {
	// Create a new history pruner
	pruner := newHistoryPruner(&historyPrunerCfg{
		bufferSize: 10,
		metrics:    nil,
		keyFunc: func(key *resource.ResourceKey) string {
			return key.Namespace + ":" + key.Group + ":" + key.Resource
		},
	})

	// Override the default wait times for testing
	pruner.setMinWait(500 * time.Millisecond) // Long min wait
	pruner.setMaxWait(200 * time.Millisecond) // Shorter max wait to force processing

	// Create a map to track processed keys and a mutex to protect it
	processedKeys := make(map[string]int)
	processedMutex := sync.Mutex{}

	// Define a processing function that counts each key
	processFunc := func(ctx context.Context, key *resource.ResourceKey) error {
		keyStr := createKeyString(key)

		processedMutex.Lock()
		processedKeys[keyStr]++
		processedMutex.Unlock()

		return nil
	}

	// Start the worker with a context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pruner.startWorker(ctx, processFunc)
	defer pruner.stopWorker()

	// Send a key
	err := pruner.Prune("default", "core", "dashboard")
	require.NoError(t, err)

	// Wait for the max timer to expire but not the min timer
	time.Sleep(300 * time.Millisecond)

	// Check that the key was processed due to max wait time
	processedMutex.Lock()
	require.Equal(t, 1, processedKeys["default:core:dashboard"])
	processedMutex.Unlock()
}
