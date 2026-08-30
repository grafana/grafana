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

// QueryEmbeddingCache stores embeddings keyed by (namespace, model, queryHash)
// so callers can skip the embedder on repeat queries.
type QueryEmbeddingCache interface {
	// Get returns the cached embedding and true on hit, or (nil, false, nil) on miss.
	Get(ctx context.Context, namespace, model, queryHash string) ([]float32, bool, error)

	// Put stores embedding for (namespace, model, queryHash). Re-putting an
	// existing key is a no-op.
	Put(ctx context.Context, namespace, model, queryHash string, embedding []float32) error

	// Count returns how many entries the given namespace currently holds.
	Count(ctx context.Context, namespace string) (int64, error)

	// EvictOldest removes up to n of the namespace's oldest entries and
	// returns the number actually removed.
	EvictOldest(ctx context.Context, namespace string, n int) (int64, error)
}

// RateLimiter enforces a per-tenant request budget over a time window.
type RateLimiter interface {
	// Allow records one request against (namespace, current window) and
	// returns whether the caller is still under threshold, along with the
	// post-increment count for the active window.
	Allow(ctx context.Context, namespace string, window time.Duration, threshold int) (bool, int64, error)

	// SweepOlderThan deletes accounting state for windows that ended before
	// cutoff and returns the number of entries removed. Intended as periodic
	// housekeeping; never affects an active or future window.
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
		// Driver may not support RowsAffected.
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

	// All replicas observe the same bucket key under sub-second clock skew.
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
