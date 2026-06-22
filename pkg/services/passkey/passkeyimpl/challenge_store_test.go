package passkeyimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
)

func TestChallengeStore(t *testing.T) {
	ctx := context.Background()

	t.Run("set then take returns the stored bytes", func(t *testing.T) {
		store := newChallengeStore(newFakeCache())
		require.NoError(t, store.set(ctx, "sess-1", []byte("challenge")))

		got, err := store.take(ctx, "sess-1")
		require.NoError(t, err)
		require.Equal(t, []byte("challenge"), got)
	})

	t.Run("take is single-use: a second take reports not found", func(t *testing.T) {
		store := newChallengeStore(newFakeCache())
		require.NoError(t, store.set(ctx, "sess-1", []byte("challenge")))

		_, err := store.take(ctx, "sess-1")
		require.NoError(t, err)

		_, err = store.take(ctx, "sess-1")
		require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound)
	})

	t.Run("take on an unknown session id reports not found", func(t *testing.T) {
		store := newChallengeStore(newFakeCache())
		_, err := store.take(ctx, "nope")
		require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound)
	})

	t.Run("set uses a non-zero 5 minute TTL", func(t *testing.T) {
		fake := newFakeCache()
		store := newChallengeStore(fake)
		require.NoError(t, store.set(ctx, "sess-1", []byte("challenge")))
		require.Equal(t, 5*time.Minute, fake.expires[challengeKeyPrefix+"sess-1"])
	})
}

// fakeCache is an in-memory cacheStorage that records the TTL passed to Set and returns
// remotecache.ErrCacheItemNotFound for missing keys, matching the real backend's contract.
type fakeCache struct {
	data    map[string][]byte
	expires map[string]time.Duration
}

func newFakeCache() *fakeCache {
	return &fakeCache{
		data:    make(map[string][]byte),
		expires: make(map[string]time.Duration),
	}
}

func (f *fakeCache) Get(_ context.Context, key string) ([]byte, error) {
	v, ok := f.data[key]
	if !ok {
		return nil, remotecache.ErrCacheItemNotFound
	}
	return v, nil
}

func (f *fakeCache) Set(_ context.Context, key string, value []byte, expire time.Duration) error {
	f.data[key] = value
	f.expires[key] = expire
	return nil
}

func (f *fakeCache) Delete(_ context.Context, key string) error {
	delete(f.data, key)
	delete(f.expires, key)
	return nil
}
