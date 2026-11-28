package runner

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSyncThenRun(t *testing.T) {
	t.Run("reports ready and runs once synced", func(t *testing.T) {
		var calls []string
		err := SyncThenRun(t.Context(),
			func() { calls = append(calls, "ready") },
			func(context.Context) { calls = append(calls, "run") },
			func() bool { return true },
		)
		require.NoError(t, err)
		require.Equal(t, []string{"ready", "run"}, calls)
	})

	t.Run("returns the cause when ctx ends before the caches sync", func(t *testing.T) {
		stopped := errors.New("stopped")
		ctx, cancel := context.WithCancelCause(t.Context())
		cancel(stopped)
		err := SyncThenRun(ctx,
			func() { t.Fatal("ready must not be reported") },
			func(context.Context) { t.Fatal("run must not start") },
			func() bool { return false },
		)
		require.ErrorIs(t, err, stopped)
	})
}
