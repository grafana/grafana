package annotation

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/grafana/grafana/pkg/infra/log"
)

// shardAssignmentResolver determines which shard a namespace belongs to.
//
// Assignments are persisted in a shard_assignments table in a dedicated metadata
// database. The resolution order is:
//
//  1. In-memory cache (populated from the database at startup)
//  2. Database lookup in the metadata database
//  3. Least-loaded assignment for new namespaces (written to database and cached)
type shardAssignmentResolver struct {
	pool       *pgxpool.Pool
	shardCount int
	mu         sync.RWMutex
	cache      map[string]int
	logger     log.Logger
}

func newShardAssignmentResolver(pool *pgxpool.Pool, shardCount int, logger log.Logger) *shardAssignmentResolver {
	return &shardAssignmentResolver{
		pool:       pool,
		shardCount: shardCount,
		cache:      make(map[string]int),
		logger:     logger,
	}
}

// resolve returns the shard index for a namespace. It is safe for concurrent use.
func (r *shardAssignmentResolver) resolve(ctx context.Context, namespace string) (int, error) {
	// 1. Check in-memory cache
	r.mu.RLock()
	if idx, ok := r.cache[namespace]; ok {
		r.mu.RUnlock()
		return idx, nil
	}
	r.mu.RUnlock()

	// 2. Check database
	idx, found, err := r.lookupAssignment(ctx, namespace)
	if err != nil {
		return 0, err
	}
	if found {
		r.cacheAssignment(namespace, idx)
		return idx, nil
	}

	// 3. New namespace — assign to least-loaded shard and persist
	idx = r.leastLoadedShard()
	if err := r.persistAssignment(ctx, namespace, idx); err != nil {
		return 0, err
	}
	return idx, nil
}

// leastLoadedShard returns the shard index with the fewest assigned tenants,
// computed from the in-memory cache. Ties are broken by lowest index.
func (r *shardAssignmentResolver) leastLoadedShard() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	counts := make([]int, r.shardCount)
	for _, idx := range r.cache {
		if idx >= 0 && idx < r.shardCount {
			counts[idx]++
		}
	}

	minCount := math.MaxInt
	minIdx := 0
	for i, c := range counts {
		if c < minCount {
			minCount = c
			minIdx = i
		}
	}
	return minIdx
}

func (r *shardAssignmentResolver) lookupAssignment(ctx context.Context, namespace string) (int, bool, error) {
	var idx int
	err := r.pool.QueryRow(ctx,
		"SELECT shard_index FROM shard_assignments WHERE namespace = $1",
		namespace,
	).Scan(&idx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("failed to lookup shard assignment for %q: %w", namespace, err)
	}
	return idx, true, nil
}

func (r *shardAssignmentResolver) persistAssignment(ctx context.Context, namespace string, shardIndex int) error {
	// Use ON CONFLICT to handle races. If two replicas try to assign the same
	// namespace concurrently, the first write wins and subsequent ones are no-ops.
	_, err := r.pool.Exec(ctx,
		`INSERT INTO shard_assignments (namespace, shard_index, created_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (namespace) DO NOTHING`,
		namespace, shardIndex, time.Now().UTC().UnixMilli(),
	)
	if err != nil {
		return fmt.Errorf("failed to persist shard assignment for %q: %w", namespace, err)
	}

	// Re-read to handle the race: if another replica inserted first, use their value.
	storedIdx, found, err := r.lookupAssignment(ctx, namespace)
	if err != nil {
		return err
	}
	if found {
		r.cacheAssignment(namespace, storedIdx)
	}
	return nil
}

func (r *shardAssignmentResolver) cacheAssignment(namespace string, shardIndex int) {
	r.mu.Lock()
	r.cache[namespace] = shardIndex
	r.mu.Unlock()
}

// preloadAssignments loads all existing assignments into the cache at startup.
// This avoids a database round-trip on the first request for each known tenant.
func (r *shardAssignmentResolver) preloadAssignments(ctx context.Context) error {
	rows, err := r.pool.Query(ctx, "SELECT namespace, shard_index FROM shard_assignments")
	if err != nil {
		return fmt.Errorf("failed to preload shard assignments: %w", err)
	}
	defer rows.Close()

	count := 0
	r.mu.Lock()
	defer r.mu.Unlock()
	for rows.Next() {
		var ns string
		var idx int
		if err := rows.Scan(&ns, &idx); err != nil {
			return fmt.Errorf("failed to scan shard assignment: %w", err)
		}
		r.cache[ns] = idx
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating shard assignments: %w", err)
	}

	r.logger.Info("Preloaded shard assignments", "count", count)
	return nil
}
