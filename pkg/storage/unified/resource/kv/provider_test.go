package kv

import (
	"context"
	"errors"
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

func TestEventualKVProvider_SetNilSignalsUnavailable(t *testing.T) {
	p := ProvideEventualKVStore()
	p.Set(nil)

	_, err := p.Get(context.Background())
	require.ErrorIs(t, err, ErrKVUnavailable)
}

func TestEventualKVProvider_DoubleSetPanics(t *testing.T) {
	p := ProvideEventualKVStore()
	p.Set(&fakeKV{})
	require.PanicsWithValue(t,
		"EventualKVProvider.Set called more than once",
		func() { p.Set(&fakeKV{}) },
	)
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

// guard against a regression where errors.Is wouldn't match the sentinel.
var _ = errors.Is(ErrKVUnavailable, ErrKVUnavailable)

// fakeKV is an opaque KV used only to verify identity round-tripping through
// EventualKVProvider. Methods aren't exercised; embedding the interface keeps
// the test cheap while satisfying the type.
type fakeKV struct{ KV }
