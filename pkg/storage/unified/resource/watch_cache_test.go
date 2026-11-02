package resource

import (
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWatchCacheReplayAndValidity(t *testing.T) {
	first := GroupResource{Group: "g", Resource: "first"}
	second := GroupResource{Group: "g", Resource: "second"}
	unknown := GroupResource{Group: "g", Resource: "unknown"}
	cache := newWatchCache(2, writtenEventIdentity)
	require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{
		items: []*WrittenEvent{cacheEvent(first, 50), cacheEvent(second, 60)}, initialCacheFloor: 40,
	}))
	validate := func(gr GroupResource, since int64) error {
		return cache.validateResume(watchResume{groupResource: gr, since: since, requestedRV: since})
	}
	require.True(t, IsResourceVersionExpired(validate(unknown, 39)))
	require.NoError(t, validate(unknown, 40))

	cache.add(cacheEvent(second, 70))
	cache.add(cacheEvent(second, 80))
	require.True(t, IsResourceVersionExpired(validate(first, 49)))
	require.NoError(t, validate(first, 50))
	require.True(t, IsResourceVersionExpired(validate(second, 59)))
	require.NoError(t, validate(second, 60))
	require.NoError(t, validate(unknown, 40))

	replayed := make(chan *WrittenEvent, 2)
	require.NoError(t, cache.replay(replayed))
	require.Equal(t, int64(70), (<-replayed).ResourceVersion)
	require.Equal(t, int64(80), (<-replayed).ResourceVersion)
	require.ErrorIs(t, cache.replay(make(chan *WrittenEvent, 1)), io.ErrShortBuffer)
}

func TestWatchCacheRejectsOversizedSeed(t *testing.T) {
	cache := newWatchCache[int](1, nil)
	require.ErrorContains(t, cache.seed(cacheSeed[int]{items: []int{1, 2}, initialCacheFloor: 50}), "cache capacity")
	require.Zero(t, cache.events.len)
	require.Zero(t, cache.initialFloor)
}
