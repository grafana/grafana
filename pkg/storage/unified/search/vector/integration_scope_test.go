package vector

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestIntegrationSharedScopeIsImmutableAndRetryable(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)
	b := backend.(*pgvectorBackend)
	t.Cleanup(func() {
		_, _ = engine.DB().ExecContext(context.Background(), `DROP TABLE IF EXISTS embeddings_scope_articles_external`)
		_, _ = engine.DB().ExecContext(context.Background(), `DROP TABLE IF EXISTS embeddings_scope_race_external`)
		_, _ = engine.DB().ExecContext(context.Background(), `DELETE FROM embedding_collections WHERE group_name = 'scope.example.com'`)
	})

	// Old inserts omit scope and therefore retain tenant ownership.
	_, err := engine.DB().ExecContext(ctx, `INSERT INTO embedding_collections (group_name, resource, partition_key, is_external) VALUES ('scope.example.com', 'old', 'scope_old_external', true)`)
	require.NoError(t, err)
	old, found, err := b.ResolveCollection(ctx, "scope.example.com", "old")
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, ScopeTenant, old.Scope)
	_, err = b.EnsureCollectionWithScope(ctx, "scope.example.com", "old", true, ScopeShared)
	require.ErrorIs(t, err, ErrCollectionScopeMismatch)

	c, err := b.EnsureCollectionWithScope(ctx, "scope.example.com", "scope-articles", true, ScopeShared)
	require.NoError(t, err)
	require.Equal(t, ScopeShared, c.Scope)
	_, err = b.EnsureCollection(ctx, "scope.example.com", "scope-articles", true)
	require.ErrorIs(t, err, ErrCollectionScopeMismatch)
	_, err = b.EnsureCollectionWithScope(ctx, "scope.example.com", "scope-articles", false, ScopeShared)
	require.Error(t, err)

	// A catalog row left by interrupted provisioning is repaired on retry.
	_, err = engine.DB().ExecContext(ctx, `DROP TABLE embeddings_scope_articles_external`)
	require.NoError(t, err)
	_, err = b.EnsureCollectionWithScope(ctx, "scope.example.com", "scope-articles", true, ScopeShared)
	require.NoError(t, err)

	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = b.EnsureCollectionWithScope(ctx, "scope.example.com", "scope-race", true, ScopeShared)
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		require.NoError(t, err)
	}
	require.Equal(t, 1, rawCount(t, engine, `SELECT count(*) FROM embedding_collections WHERE group_name = 'scope.example.com' AND resource = 'scope-race' AND scope = 'shared'`))
}

func TestIntegrationDeleteNamespacePreservesSharedPartition(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)
	b := backend.(*pgvectorBackend)
	t.Cleanup(func() {
		_, _ = engine.DB().ExecContext(context.Background(), `DELETE FROM vector_promoted WHERE namespace = $1 AND resource = 'scope_cleanup_external'`, SharedNamespace)
		_, _ = engine.DB().ExecContext(context.Background(), `DROP TABLE IF EXISTS embeddings_scope_cleanup_external`)
		_, _ = engine.DB().ExecContext(context.Background(), `DELETE FROM embedding_collections WHERE group_name = 'scope-cleanup.example.com'`)
	})
	c, err := b.EnsureCollectionWithScope(ctx, "scope-cleanup.example.com", "scope-cleanup", true, ScopeShared)
	require.NoError(t, err)
	for _, resource := range []string{testResource, c.PartitionKey} {
		require.NoError(t, backend.Upsert(ctx, []Vector{{Namespace: SharedNamespace, Resource: resource, UID: "same-uid", Title: "Title", Content: "content", Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.2, 0.2), Model: testModel}}))
		_, err = engine.DB().ExecContext(ctx, `INSERT INTO vector_promoted (namespace, resource) VALUES ($1, $2) ON CONFLICT DO NOTHING`, SharedNamespace, resource)
		require.NoError(t, err)
	}
	cache := backend.(QueryEmbeddingCache)
	require.NoError(t, cache.Put(ctx, SharedNamespace, testModel, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", makeEmbedding(0.2, 0.2)))
	limiter := backend.(RateLimiter)
	_, _, err = limiter.Allow(ctx, SharedNamespace, time.Minute, 100)
	require.NoError(t, err)

	deleted, err := backend.DeleteNamespace(ctx, SharedNamespace)
	require.NoError(t, err)
	require.Equal(t, int64(1), deleted)
	local, err := backend.Exists(ctx, SharedNamespace, testModel, testResource, "same-uid")
	require.NoError(t, err)
	require.False(t, local)
	shared, err := backend.Exists(ctx, SharedNamespace, testModel, c.PartitionKey, "same-uid")
	require.NoError(t, err)
	require.True(t, shared)
	require.Equal(t, 0, rawCount(t, engine, `SELECT count(*) FROM vector_promoted WHERE namespace = $1 AND resource = $2`, SharedNamespace, testResource))
	require.Equal(t, 1, rawCount(t, engine, `SELECT count(*) FROM vector_promoted WHERE namespace = $1 AND resource = $2`, SharedNamespace, c.PartitionKey))
	count, err := cache.Count(ctx, SharedNamespace)
	require.NoError(t, err)
	require.Zero(t, count)
	require.Zero(t, rawCount(t, engine, `SELECT count(*) FROM vector_search_rate_buckets WHERE namespace = $1`, SharedNamespace))
}
