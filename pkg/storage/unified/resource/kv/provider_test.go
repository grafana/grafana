package kv

import (
	"bytes"
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
)

func TestEventualKVProvider_GetBlocksUntilSet(t *testing.T) {
	p := ProvideEventualKVStore()
	store := &fakeKV{}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	got := make(chan KV, 1)
	go func() {
		kv, err := p.Get(ctx)
		require.NoError(t, err)
		got <- kv
	}()

	select {
	case <-got:
		t.Fatal("Get returned before Set was called")
	case <-time.After(50 * time.Millisecond):
	}

	p.Set(store)

	select {
	case kv := <-got:
		require.Same(t, store, kv)
	case <-ctx.Done():
		t.Fatal("Get did not return after Set")
	}
}

func TestEventualKVProvider_GetReturnsCtxErr(t *testing.T) {
	p := ProvideEventualKVStore()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := p.Get(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

func TestEventualKVProvider_SetUnavailable(t *testing.T) {
	p := ProvideEventualKVStore()
	p.SetUnavailable()

	_, err := p.Get(context.Background())
	require.ErrorIs(t, err, ErrKVUnavailable)
}

func TestEventualKVProvider_SecondSetIgnored(t *testing.T) {
	captureProviderLog(t) // suppress duplicate-call warnings

	p := ProvideEventualKVStore()
	first := &fakeKV{}
	p.Set(first)
	p.Set(&fakeKV{})   // ignored
	p.SetUnavailable() // ignored

	kv, err := p.Get(context.Background())
	require.NoError(t, err)
	require.Same(t, first, kv)
}

func TestEventualKVProvider_GetIsRepeatable(t *testing.T) {
	p := ProvideEventualKVStore()
	store := &fakeKV{}
	p.Set(store)

	for range 3 {
		kv, err := p.Get(context.Background())
		require.NoError(t, err)
		require.Same(t, store, kv)
	}
}

func TestEventualKVProvider_NilReceiverIsNoOp(t *testing.T) {
	var p *EventualKVProvider
	require.NotPanics(t, func() { p.Set(&fakeKV{}) })
	require.NotPanics(t, func() { p.SetUnavailable() })

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := p.Get(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

// TestEventualKVProvider_ConcurrentSet exercises the first-call-wins
// guarantee under contention. Run with -race to validate that the publish
// of p.store happens-before any Get reader.
func TestEventualKVProvider_ConcurrentSet(t *testing.T) {
	captureProviderLog(t) // suppress duplicate-call warnings

	p := ProvideEventualKVStore()
	stores := []*fakeKV{{}, {}, {}, {}, {}, {}, {}, {}}

	var wg sync.WaitGroup
	wg.Add(len(stores))
	for _, s := range stores {
		go func() {
			defer wg.Done()
			p.Set(s)
		}()
	}
	wg.Wait()

	kv, err := p.Get(context.Background())
	require.NoError(t, err)

	// The winner is one of the stores, and Get is stable across calls.
	winner := kv
	for range 3 {
		again, err := p.Get(context.Background())
		require.NoError(t, err)
		require.Same(t, winner, again)
	}
}

// TestEventualKVProvider_BroadcastsToAllGetters verifies that many
// goroutines blocking on Get all wake up and observe the same store once
// Set lands.
func TestEventualKVProvider_BroadcastsToAllGetters(t *testing.T) {
	p := ProvideEventualKVStore()
	store := &fakeKV{}

	const n = 32
	var (
		wg   sync.WaitGroup
		hits atomic.Int32
	)
	wg.Add(n)
	for range n {
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			kv, err := p.Get(ctx)
			require.NoError(t, err)
			require.Same(t, store, kv)
			hits.Add(1)
		}()
	}

	// Give goroutines a moment to park on <-p.ready before Set lands.
	time.Sleep(20 * time.Millisecond)
	p.Set(store)
	wg.Wait()

	require.Equal(t, int32(n), hits.Load())
}

func TestEventualKVProvider_DuplicateSetLogsWarning(t *testing.T) {
	buf := captureProviderLog(t)

	p := ProvideEventualKVStore()
	p.Set(&fakeKV{})
	p.Set(&fakeKV{})
	p.SetUnavailable()

	out := buf.String()
	require.Contains(t, out, "EventualKVProvider already resolved")
	require.Contains(t, out, "method=Set")
	require.Contains(t, out, "method=SetUnavailable")
	require.Contains(t, out, "provider_test.go:")
}

// captureProviderLog swaps logging.DefaultLogger for a buffer-backed
// SLogLogger for the duration of the test and returns the buffer. The
// original logger is restored on cleanup.
//
// The slog handler internally serializes writes, so concurrent emitters
// (e.g. ConcurrentSet) don't race on the buffer.
func captureProviderLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	orig := logging.DefaultLogger
	logging.DefaultLogger = logging.NewSLogLogger(slog.NewTextHandler(&buf, nil))
	t.Cleanup(func() { logging.DefaultLogger = orig })
	return &buf
}

// fakeKV is an opaque KV used only to verify identity round-tripping through
// EventualKVProvider. Methods aren't exercised; embedding the interface keeps
// the test cheap while satisfying the type.
type fakeKV struct{ KV }
