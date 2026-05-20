package vector

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// cleanQueryCache wipes cache + rate-bucket state for the integration
// tenant prefix. Each test starts from an empty slate so timing-sensitive
// assertions (eviction order, rate-limit counters) aren't perturbed by
// leftovers from a prior run.
func cleanQueryCache(t *testing.T, backend VectorBackend) {
	t.Helper()
	ctx := context.Background()
	// Reach into the concrete type to get the underlying DB; the public
	// VectorBackend interface intentionally doesn't expose it.
	b, ok := backend.(*pgvectorBackend)
	require.True(t, ok, "expected *pgvectorBackend")

	_, err := b.db.ExecContext(ctx, `DELETE FROM query_embedding_cache WHERE namespace LIKE 'integration-test%'`)
	require.NoError(t, err)
	_, err = b.db.ExecContext(ctx, `DELETE FROM vector_search_rate_buckets WHERE namespace LIKE 'integration-test%'`)
	require.NoError(t, err)
}

func TestIntegrationQueryCacheGetPutRoundTrip(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)
	cache := backend.(QueryEmbeddingCache)
	cleanQueryCache(t, backend)

	const ns = "integration-test-cache-roundtrip"
	const hash = "deadbeef0000000000000000000000000000000000000000000000000000beef"

	// Miss on first lookup.
	emb, hit, err := cache.Get(ctx, ns, testModel, hash)
	require.NoError(t, err)
	assert.False(t, hit)
	assert.Nil(t, emb)

	// Insert and read back. The stored bytes are zero-padded to EmbeddingDim,
	// so we compare only the prefix we set.
	stored := makeEmbedding(0.42, 0.13)
	require.NoError(t, cache.Put(ctx, ns, testModel, hash, stored))

	got, hit, err := cache.Get(ctx, ns, testModel, hash)
	require.NoError(t, err)
	assert.True(t, hit)
	require.Len(t, got, EmbeddingDim)
	assert.InDelta(t, float32(0.42), got[0], 1e-5)
	assert.InDelta(t, float32(0.13), got[1], 1e-5)

	// Repeat lookups do not mutate state — Count stays at 1.
	_, _, err = cache.Get(ctx, ns, testModel, hash)
	require.NoError(t, err)
	n, err := cache.Count(ctx, ns)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
}

func TestIntegrationQueryCacheEvictOldest(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)
	cache := backend.(QueryEmbeddingCache)
	cleanQueryCache(t, backend)

	const ns = "integration-test-cache-evict"

	// Insert four entries; stagger inserts so created_at ordering is
	// deterministic for the eviction assertion below.
	hashes := []string{
		"a000000000000000000000000000000000000000000000000000000000000001",
		"a000000000000000000000000000000000000000000000000000000000000002",
		"a000000000000000000000000000000000000000000000000000000000000003",
		"a000000000000000000000000000000000000000000000000000000000000004",
	}
	for i, h := range hashes {
		require.NoError(t, cache.Put(ctx, ns, testModel, h, makeEmbedding(float32(i), 0)))
		time.Sleep(20 * time.Millisecond)
	}

	// Evict the two oldest entries: hashes[0] and hashes[1].
	deleted, err := cache.EvictOldest(ctx, ns, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(2), deleted)

	for _, kept := range []string{hashes[2], hashes[3]} {
		_, hit, err := cache.Get(ctx, ns, testModel, kept)
		require.NoError(t, err)
		assert.True(t, hit, "expected %s to remain", kept)
	}
	for _, evicted := range []string{hashes[0], hashes[1]} {
		_, hit, err := cache.Get(ctx, ns, testModel, evicted)
		require.NoError(t, err)
		assert.False(t, hit, "expected %s to be evicted", evicted)
	}
}

func TestIntegrationQueryCacheConcurrentPutSameKeyIsHarmless(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)
	cache := backend.(QueryEmbeddingCache)
	cleanQueryCache(t, backend)

	const ns = "integration-test-cache-concurrent"
	const hash = "c000000000000000000000000000000000000000000000000000000000000001"

	// Race a few goroutines on the same key. ON CONFLICT DO NOTHING means
	// every losing insert is a silent no-op.
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := cache.Put(ctx, ns, testModel, hash, makeEmbedding(1, 0))
			assert.NoError(t, err)
		}()
	}
	wg.Wait()

	n, err := cache.Count(ctx, ns)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n, "concurrent inserts must collapse to one row")
}

func TestIntegrationRateLimiterAllowAndReject(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)
	rl := backend.(RateLimiter)
	cleanQueryCache(t, backend)

	const ns = "integration-test-rl"
	// Use a large window so the bucket stays the same across this test.
	window := time.Hour

	for i := 1; i <= 3; i++ {
		allowed, count, err := rl.Allow(ctx, ns, window, 3)
		require.NoError(t, err)
		assert.True(t, allowed, "request %d should be under threshold", i)
		assert.Equal(t, int64(i), count)
	}

	// 4th call exceeds the threshold.
	allowed, count, err := rl.Allow(ctx, ns, window, 3)
	require.NoError(t, err)
	assert.False(t, allowed)
	assert.Equal(t, int64(4), count)
}

func TestIntegrationRateLimiterSweepOlderThan(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)
	rl := backend.(RateLimiter)
	cleanQueryCache(t, backend)

	const ns = "integration-test-rl-sweep"

	// Seed an OLD bucket directly so we don't have to wait a window-length.
	b := backend.(*pgvectorBackend)
	old := time.Now().Add(-2 * time.Hour).UTC()
	_, err := b.db.ExecContext(ctx,
		`INSERT INTO vector_search_rate_buckets (namespace, window_start, request_count) VALUES ($1, $2, $3)`,
		ns, old, 7)
	require.NoError(t, err)

	// Seed a CURRENT bucket via the limiter; this row must survive the sweep.
	allowed, _, err := rl.Allow(ctx, ns, time.Minute, 100)
	require.NoError(t, err)
	require.True(t, allowed)

	// Sweep anything older than 30 minutes ago.
	deleted, err := rl.SweepOlderThan(ctx, time.Now().Add(-30*time.Minute))
	require.NoError(t, err)
	assert.GreaterOrEqual(t, deleted, int64(1), "expected at least the seeded old row to be deleted")

	// The current bucket is untouched.
	row := b.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM vector_search_rate_buckets WHERE namespace = $1`, ns)
	var remaining int
	require.NoError(t, row.Scan(&remaining))
	assert.Equal(t, 1, remaining)
}
