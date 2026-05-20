package vector

import (
	"context"
	"errors"
	"fmt"
	"time"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// QueryEmbeddingCache stores (namespace, model, query_hash) → embedding so
// the embedder isn't called for repeat queries. Eviction is FIFO by
// insertion time: callers bound per-tenant size via Count + EvictOldest.
// True LRU is intentionally not tracked — Get is a pure SELECT so hot
// rows don't contend on a per-hit UPDATE.
type QueryEmbeddingCache interface {
	// Get returns (embedding, true) on hit; (nil, false) on miss. Read-only.
	Get(ctx context.Context, namespace, model, queryHash string) ([]float32, bool, error)

	// Put inserts a new entry. Concurrent inserts of the same key are
	// idempotent (ON CONFLICT DO NOTHING).
	Put(ctx context.Context, namespace, model, queryHash string, embedding []float32) error

	// Count returns the number of cached entries for one tenant.
	Count(ctx context.Context, namespace string) (int64, error)

	// EvictOldest removes the n oldest-by-created_at entries for a tenant.
	// Returns the number of rows actually deleted.
	EvictOldest(ctx context.Context, namespace string, n int) (int64, error)
}

// RateLimiter enforces a per-tenant request budget over a fixed (tumbling)
// window. State lives in the DB (`vector_search_rate_buckets`) so multiple
// pods share one view without a distributor in front. Because the window
// is tumbling, a tenant can fit up to ~2× threshold requests across a
// boundary; callers that need stricter pacing should use a smaller window.
type RateLimiter interface {
	// Allow atomically increments the current window bucket and reports
	// whether the request is under the threshold. Returns (allowed,
	// currentCount, error). allowed=false when currentCount > threshold.
	Allow(ctx context.Context, namespace string, window time.Duration, threshold int) (bool, int64, error)

	// SweepOlderThan deletes buckets with window_start < cutoff. Called
	// periodically by a background goroutine to keep the table bounded.
	SweepOlderThan(ctx context.Context, cutoff time.Time) (int64, error)
}

var (
	_ QueryEmbeddingCache = (*pgvectorBackend)(nil)
	_ RateLimiter         = (*pgvectorBackend)(nil)
)

func (b *pgvectorBackend) Get(ctx context.Context, namespace, model, queryHash string) ([]float32, bool, error) {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.QueryCache.Get")
	defer span.End()

	req := &sqlQueryCacheGetRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Model:       model,
		QueryHash:   queryHash,
		Response:    &sqlQueryCacheGetResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlQueryCacheGet, req)
	if err != nil {
		return nil, false, fmt.Errorf("query cache get: %w", err)
	}
	if len(rows) == 0 {
		return nil, false, nil
	}
	return rows[0].Embedding.Slice(), true, nil
}

func (b *pgvectorBackend) Put(ctx context.Context, namespace, model, queryHash string, embedding []float32) error {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.QueryCache.Put")
	defer span.End()

	emb, err := fitEmbedding(embedding, EmbeddingDim)
	if err != nil {
		return fmt.Errorf("query cache put: %w", err)
	}
	req := &sqlQueryCacheInsertRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Model:       model,
		QueryHash:   queryHash,
		Embedding:   pgvector.NewHalfVector(emb),
	}
	if _, err := dbutil.Exec(ctx, b.db, sqlQueryCacheInsert, req); err != nil {
		return fmt.Errorf("query cache put: %w", err)
	}
	return nil
}

func (b *pgvectorBackend) Count(ctx context.Context, namespace string) (int64, error) {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.QueryCache.Count")
	defer span.End()

	req := &sqlQueryCacheCountRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Response:    &sqlQueryCacheCountResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlQueryCacheCount, req)
	if err != nil {
		return 0, fmt.Errorf("query cache count: %w", err)
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Count, nil
}

func (b *pgvectorBackend) EvictOldest(ctx context.Context, namespace string, n int) (int64, error) {
	if n <= 0 {
		return 0, nil
	}
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.QueryCache.EvictOldest")
	defer span.End()

	req := &sqlQueryCacheEvictOldestRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		Limit:       int64(n),
	}
	res, err := dbutil.Exec(ctx, b.db, sqlQueryCacheEvictOldest, req)
	if err != nil {
		return 0, fmt.Errorf("query cache evict oldest: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		// Driver may not support RowsAffected; not fatal.
		return 0, nil
	}
	return affected, nil
}

func (b *pgvectorBackend) Allow(ctx context.Context, namespace string, window time.Duration, threshold int) (bool, int64, error) {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.RateLimiter.Allow")
	defer span.End()

	if window <= 0 {
		return false, 0, errors.New("rate limit window must be positive")
	}
	if threshold <= 0 {
		return false, 0, errors.New("rate limit threshold must be positive")
	}

	// Truncate to the active window boundary so all replicas observe the
	// same bucket key even with clock skew under a second. This is a fixed
	// (tumbling) window — see RateLimiter doc for boundary behavior.
	windowStart := time.Now().UTC().Truncate(window)

	req := &sqlRateBucketIncrementRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Namespace:   namespace,
		WindowStart: windowStart,
		Response:    &sqlRateBucketIncrementResponse{},
	}
	rows, err := dbutil.Query(ctx, b.db, sqlRateBucketIncrement, req)
	if err != nil {
		return false, 0, fmt.Errorf("rate-bucket increment: %w", err)
	}
	if len(rows) == 0 {
		return false, 0, errors.New("rate-bucket increment returned no rows")
	}
	count := rows[0].Count
	return count <= int64(threshold), count, nil
}

func (b *pgvectorBackend) SweepOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	ctx, span := tracer.Start(ctx, "unified.vector.pgvector.RateLimiter.SweepOlderThan")
	defer span.End()

	req := &sqlRateBucketSweepRequest{
		SQLTemplate: sqltemplate.New(b.dialect),
		Cutoff:      cutoff.UTC(),
	}
	res, err := dbutil.Exec(ctx, b.db, sqlRateBucketSweep, req)
	if err != nil {
		return 0, fmt.Errorf("rate-bucket sweep: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return 0, nil
	}
	return affected, nil
}
