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
	require.Equal(t, cacheEvent(second, 70).sizeBytes()+cacheEvent(second, 80).sizeBytes(), cache.sizeBytes)
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

func TestWatchCacheByteLimit(t *testing.T) {
	for _, mode := range []string{"live", "seeded"} {
		t.Run(mode, func(t *testing.T) {
			first := GroupResource{Group: "g", Resource: "first"}
			second := GroupResource{Group: "g", Resource: "second"}
			a, b, c := cacheEvent(first, 50), cacheEvent(second, 60), cacheEvent(second, 70)
			a.Value = make([]byte, 1024)
			b.Value = make([]byte, 1024)
			c.Value = make([]byte, 2048)
			cache := newWatchCache(3, writtenEventIdentity)
			cache.maxBytes = a.sizeBytes() + b.sizeBytes()
			if mode == "seeded" {
				require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{items: []*WrittenEvent{a, b, c}, initialCacheFloor: 40}))
			} else {
				require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{initialCacheFloor: 40}))
				cache.add(a)
				cache.add(b)
				require.Equal(t, cache.maxBytes, cache.sizeBytes)
				cache.add(c)
			}
			require.Equal(t, c.sizeBytes(), cache.sizeBytes)
			require.Equal(t, 1, cache.events.len)
			require.Nil(t, cache.events.buf[0], "eviction must release the payload")
			require.Nil(t, cache.events.buf[1], "eviction must release the payload")
			replayed := make(chan *WrittenEvent, 3)
			require.NoError(t, cache.replay(replayed))
			require.Equal(t, []*WrittenEvent{c}, drainChan(replayed))
			for gr, rv := range map[GroupResource]int64{first: 50, second: 60} {
				require.True(t, IsResourceVersionExpired(cache.validateResume(watchResume{groupResource: gr, since: rv - 1})))
				require.NoError(t, cache.validateResume(watchResume{groupResource: gr, since: rv}))
			}
		})
	}
}

func TestWatchCacheOversizedEvent(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(3, writtenEventIdentity)
	first := cacheEvent(gr, 50)
	first.Value = make([]byte, 16)
	cache.maxBytes = first.sizeBytes()
	cache.add(first)
	large := cacheEvent(gr, 60)
	large.Value = make([]byte, 1, 1024)
	cache.add(large)
	require.Zero(t, cache.events.len)
	require.Zero(t, cache.sizeBytes)
	for _, item := range cache.events.buf {
		require.Nil(t, item)
	}
	require.True(t, IsResourceVersionExpired(cache.validateResume(watchResume{groupResource: gr, since: 59})))
	require.NoError(t, cache.validateResume(watchResume{groupResource: gr, since: 60}))

	next := cacheEvent(gr, 70)
	next.Value = make([]byte, 16)
	cache.add(next)
	require.Equal(t, next.sizeBytes(), cache.sizeBytes)
	replayed := make(chan *WrittenEvent, 3)
	require.NoError(t, cache.replay(replayed))
	require.Equal(t, []*WrittenEvent{next}, drainChan(replayed))
}

func TestWatchCacheByteAccountingWraparound(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(3, writtenEventIdentity)
	cache.maxBytes = 2
	for rv := int64(1); rv <= 20; rv++ {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, 1)
		cache.add(event)
		require.LessOrEqual(t, cache.sizeBytes, cache.maxBytes)
		replayed := make(chan *WrittenEvent, 3)
		require.NoError(t, cache.replay(replayed))
		items := drainChan(replayed)
		require.Len(t, items, min(int(rv), 2))
		var total int64
		for i, item := range items {
			total += item.sizeBytes()
			require.Equal(t, rv-int64(len(items)-1-i), item.ResourceVersion)
		}
		require.Equal(t, total, cache.sizeBytes)
	}
}

func TestWatchCacheEvictionFloorDoesNotRegress(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(1, writtenEventIdentity)
	for _, rv := range []int64{100, 50, 60} {
		cache.add(cacheEvent(gr, rv))
	}
	require.True(t, IsResourceVersionExpired(cache.validateResume(watchResume{groupResource: gr, since: 99})))
	require.NoError(t, cache.validateResume(watchResume{groupResource: gr, since: 100}))
}

func TestWrittenEventSizeBytes(t *testing.T) {
	var event *WrittenEvent
	require.Zero(t, event.sizeBytes())
	event = cacheEvent(GroupResource{Group: "group", Resource: "resource"}, 50)
	event.Folder = "folder"
	event.PreviousFolder = "previous"
	event.PreviousAction = DataActionUpdated
	require.Zero(t, event.sizeBytes(), "metadata does not count toward the payload limit")
	event.Value = make([]byte, 1, 1024)
	require.Equal(t, int64(1024), event.sizeBytes())
}

func TestWatchCacheRejectsOversizedSeed(t *testing.T) {
	cache := newWatchCache[int](1, nil)
	require.ErrorContains(t, cache.seed(cacheSeed[int]{items: []int{1, 2}, initialCacheFloor: 50}), "cache capacity")
	require.Zero(t, cache.events.len)
	require.Zero(t, cache.initialFloor)
}
