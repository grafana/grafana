package annotation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewShardedPostgresStore_Validation(t *testing.T) {
	t.Run("no shard connection strings", func(t *testing.T) {
		_, err := NewShardedPostgresStore(t.Context(), ShardedStoreConfig{
			MetadataConnectionString: "postgresql://metadata",
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "at least one shard connection string")
	})

	t.Run("no metadata connection string", func(t *testing.T) {
		_, err := NewShardedPostgresStore(t.Context(), ShardedStoreConfig{
			ShardConnectionStrings: []string{"postgresql://shard0"},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "metadata connection string is required")
	})
}

func TestLeastLoadedShard(t *testing.T) {
	t.Run("empty cache picks shard 0", func(t *testing.T) {
		r := newShardAssignmentResolver(nil, 4, nil)
		assert.Equal(t, 0, r.leastLoadedShard())
	})

	t.Run("picks shard with fewest assignments", func(t *testing.T) {
		r := newShardAssignmentResolver(nil, 4, nil)
		r.cache["org-1"] = 0
		r.cache["org-2"] = 0
		r.cache["org-3"] = 1
		r.cache["org-4"] = 2
		assert.Equal(t, 3, r.leastLoadedShard())
	})

	t.Run("ties broken by lowest index", func(t *testing.T) {
		r := newShardAssignmentResolver(nil, 4, nil)
		r.cache["org-a"] = 0
		r.cache["org-b"] = 1
		assert.Equal(t, 2, r.leastLoadedShard())
	})

	t.Run("single shard always returns 0", func(t *testing.T) {
		r := newShardAssignmentResolver(nil, 1, nil)
		r.cache["org-1"] = 0
		r.cache["org-2"] = 0
		assert.Equal(t, 0, r.leastLoadedShard())
	})
}

func TestShardAssignmentResolver_CacheHit(t *testing.T) {
	r := newShardAssignmentResolver(nil, 4, nil)
	r.cacheAssignment("org-cached", 3)

	idx, err := r.resolve(t.Context(), "org-cached")
	require.NoError(t, err)
	assert.Equal(t, 3, idx)
}

func TestShardForOutOfRange(t *testing.T) {
	s := &ShardedPostgresStore{
		shards:   make([]*PostgreSQLStore, 2),
		resolver: newShardAssignmentResolver(nil, 2, nil),
	}
	// Seed a cached assignment pointing beyond the shard slice
	s.resolver.cacheAssignment("org-bad", 5)

	_, err := s.shardFor(t.Context(), "org-bad")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "out of range")
}
