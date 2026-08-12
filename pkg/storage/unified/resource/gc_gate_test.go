package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGCGate_NilProceedsImmediately(t *testing.T) {
	t.Parallel()

	var g *GCGate // nil gate
	require.True(t, g.Wait(context.Background(), nil))
	// Release on a nil gate must not panic.
	require.NotPanics(t, func() { g.Release() })
}

func TestGCGate_BlocksUntilRelease(t *testing.T) {
	t.Parallel()

	g := NewGCGate()

	// Before release, Wait must not return. Use a short window with a
	// never-closing done channel to assert it blocks.
	released := make(chan bool, 1)
	go func() {
		released <- g.Wait(context.Background(), make(chan struct{}))
	}()

	select {
	case <-released:
		t.Fatal("Wait returned before Release was called")
	case <-time.After(50 * time.Millisecond):
		// expected: still blocked
	}

	g.Release()

	select {
	case proceed := <-released:
		require.True(t, proceed, "Wait should return true after Release")
	case <-time.After(time.Second):
		t.Fatal("Wait did not return after Release")
	}
}

func TestGCGate_ReleaseIdempotent(t *testing.T) {
	t.Parallel()

	g := NewGCGate()
	require.NotPanics(t, func() {
		g.Release()
		g.Release()
	})
	// Still proceeds after multiple releases.
	require.True(t, g.Wait(context.Background(), make(chan struct{})))
}

func TestGCGate_AbortsOnDone(t *testing.T) {
	t.Parallel()

	g := NewGCGate()
	done := make(chan struct{})
	close(done)
	require.False(t, g.Wait(context.Background(), done), "Wait should abort when done is closed")
}

func TestGCGate_AbortsOnContextCancel(t *testing.T) {
	t.Parallel()

	g := NewGCGate()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.False(t, g.Wait(ctx, make(chan struct{})), "Wait should abort when context is cancelled")
}
