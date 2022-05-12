//go:build integration
// +build integration

package serverlock

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestIntegrationServerLok(t *testing.T) {
	sl := createTestableServerLock(t)

	counter := 0
	fn := func(context.Context) { counter++ }
	atInterval := time.Hour
	ctx := context.Background()

	//this time `fn` should be executed
	require.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	require.Equal(t, 1, counter)

	//this should not execute `fn`
	require.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	require.Nil(t, sl.LockAndExecute(ctx, "test-operation", atInterval, fn))
	require.Equal(t, 1, counter)

	atInterval = time.Millisecond

	// now `fn` should be executed again
	err := sl.LockAndExecute(ctx, "test-operation", atInterval, fn)
	require.Nil(t, err)
	require.Equal(t, 2, counter)
}
