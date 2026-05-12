package kv

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

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

// fakeKV is an opaque KV used only to verify identity round-tripping through
// EventualKVProvider. Methods aren't exercised; embedding the interface keeps
// the test cheap while satisfying the type.
type fakeKV struct{ KV }
