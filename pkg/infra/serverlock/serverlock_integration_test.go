package serverlock

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestIntegrationServerLock_LockAndExecute(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sl := createTestableServerLock(t)

	counter := 0
	fn := func(context.Context) { counter++ }
	atInterval := time.Hour
	ctx := context.Background()

	// this time `fn` should be executed
	require.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	require.Equal(t, 1, counter)

	// this should not execute `fn`
	require.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	require.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	require.Equal(t, 1, counter)

	atInterval = time.Millisecond

	// now `fn` should be executed again
	err := sl.LockAndExecute(ctx, "test-operation", atInterval, fn)
	require.Nil(t, err)
	require.Equal(t, 2, counter)
}

func TestIntegrationServerLock_LockExecuteAndRelease(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sl := createTestableServerLock(t)

	counter := 0
	fn := func(context.Context) { counter++ }
	atInterval := time.Hour
	ctx := context.Background()

	//
	err := sl.LockExecuteAndRelease(ctx, "test-operation", atInterval, fn)
	require.NoError(t, err)
	require.Equal(t, 1, counter)

	// the function will be executed again, as everytime the lock is released
	err = sl.LockExecuteAndRelease(ctx, "test-operation", atInterval, fn)
	require.NoError(t, err)
	err = sl.LockExecuteAndRelease(ctx, "test-operation", atInterval, fn)
	require.NoError(t, err)
	err = sl.LockExecuteAndRelease(ctx, "test-operation", atInterval, fn)
	require.NoError(t, err)

	require.Equal(t, 4, counter)
}

func TestIntegrationServerLock_LockExecuteAndReleaseWithRetries(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sl := createTestableServerLock(t)

	retries := 0
	expectedRetries := 10
	funcRuns := 0
	fn := func(context.Context) {
		funcRuns++
	}
	lockTimeConfig := LockTimeConfig{
		MaxInterval: time.Hour,
		MinWait:     0 * time.Millisecond,
		MaxWait:     1 * time.Millisecond,
	}
	ctx := context.Background()
	actionName := "test-operation"

	// Acquire lock so that when `LockExecuteAndReleaseWithRetries` runs, it is forced
	// to retry
	err := sl.acquireForRelease(ctx, actionName, lockTimeConfig.MaxInterval)
	require.NoError(t, err)

	wgRetries := sync.WaitGroup{}
	wgRetries.Add(expectedRetries)
	wgRelease := sync.WaitGroup{}
	wgRelease.Add(1)
	wgCompleted := sync.WaitGroup{}
	wgCompleted.Add(1)

	onRetryFn := func(int) error {
		retries++
		wgRetries.Done()
		if retries == expectedRetries {
			// When we reach `expectedRetries`, wait for the lock to be released
			// to guarantee that next try will succeed
			wgRelease.Wait()
		}
		return nil
	}

	go func() {
		err := sl.LockExecuteAndReleaseWithRetries(ctx, actionName, lockTimeConfig, fn, onRetryFn)
		require.NoError(t, err)
		wgCompleted.Done()
	}()

	// Wait to release the lock until `LockExecuteAndReleaseWithRetries` has retried `expectedRetries` times.
	wgRetries.Wait()
	err = sl.releaseLock(ctx, actionName)
	require.NoError(t, err)
	wgRelease.Done()

	// `LockExecuteAndReleaseWithRetries` has run completely.
	// Check that it had to retry because the lock was already taken.
	wgCompleted.Wait()
	require.Equal(t, expectedRetries, retries)
	require.Equal(t, 1, funcRuns)
}
