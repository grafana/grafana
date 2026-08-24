package annotation

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Cleanup implements the LifecycleManager interface
// It removes old partitions that are beyond the retention TTL
func (s *PostgreSQLStore) Cleanup(ctx context.Context, before time.Time) (int64, error) {
	// Calculate cutoff timestamp and corresponding partition name
	cutoffMs := before.UnixMilli()
	cutoffPartition := getPartitionName(cutoffMs)
	// Don't drop partitions less than 24 hours old even if they're past TTL
	minKeepPartition := getPartitionName(time.Now().UTC().Add(-24 * time.Hour).UnixMilli())

	// Get all existing partitions
	partitions, err := listPartitions(ctx, s.pool)
	if err != nil {
		return 0, fmt.Errorf("failed to list partitions: %w", err)
	}

	var totalDeleted int64

	// Iterate through partitions and drop those older than cutoff
	for _, partition := range partitions {
		if partition.Name >= cutoffPartition || partition.Name >= minKeepPartition {
			continue
		}

		partitionIdent := pgx.Identifier{partition.Name}.Sanitize()

		// Count rows per namespace so the namespace counters can be
		// decremented once the partition is dropped; also gives us the
		// total for metrics.
		perNamespace, count, err := countPartitionRowsByNamespace(ctx, s.pool, partitionIdent)
		if err != nil {
			// Log error but continue with other partitions since this is just for metrics
			// and counter accuracy; the partition drop below still proceeds.
			s.logger.Warn("Failed to count rows in partition", "partition", partition.Name, "err", err)
		}

		// Detach partition first to avoid locking the main table during deletion
		detachQuery := fmt.Sprintf("ALTER TABLE annotations DETACH PARTITION %s", partitionIdent)
		if _, err := s.pool.Exec(ctx, detachQuery); err != nil {
			return totalDeleted, fmt.Errorf("failed to detach partition %s: %w", partition.Name, err)
		}

		// Drop the detached partition
		dropQuery := fmt.Sprintf("DROP TABLE %s", partitionIdent)
		if _, err := s.pool.Exec(ctx, dropQuery); err != nil {
			return totalDeleted, fmt.Errorf("failed to drop partition %s: %w", partition.Name, err)
		}

		if err := decrementNamespaceCounts(ctx, s.pool, perNamespace); err != nil {
			// The partition is already gone; log rather than fail the whole
			// cleanup run since counter drift is self-correcting (it only
			// ever over-counts, making the cap conservative, never permissive).
			s.logger.Warn("Failed to decrement namespace counts after partition drop", "partition", partition.Name, "err", err)
		}

		totalDeleted += count
	}

	return totalDeleted, nil
}

// countPartitionRowsByNamespace returns the row count for a detaching
// partition, both broken down per namespace (to keep annotation_namespace_counts
// in sync) and as a total (for the caller's deleted-rows metric).
func countPartitionRowsByNamespace(ctx context.Context, pool *pgxpool.Pool, partitionIdent string) (map[string]int64, int64, error) {
	query := fmt.Sprintf("SELECT namespace, COUNT(*) FROM %s GROUP BY namespace", partitionIdent)
	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count partition rows by namespace: %w", err)
	}
	defer rows.Close()

	perNamespace := make(map[string]int64)
	var total int64
	for rows.Next() {
		var ns string
		var count int64
		if err := rows.Scan(&ns, &count); err != nil {
			return nil, 0, fmt.Errorf("failed to scan namespace count row: %w", err)
		}
		perNamespace[ns] = count
		total += count
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating namespace count rows: %w", err)
	}

	return perNamespace, total, nil
}

// decrementNamespaceCounts subtracts each namespace's row count (as
// removed from a dropped partition) from annotation_namespace_counts.
func decrementNamespaceCounts(ctx context.Context, pool *pgxpool.Pool, perNamespace map[string]int64) error {
	for namespace, count := range perNamespace {
		if _, err := pool.Exec(ctx, `
			UPDATE annotation_namespace_counts
			SET count = count - $1
			WHERE namespace = $2
		`, count, namespace); err != nil {
			return fmt.Errorf("failed to decrement count for namespace %s: %w", namespace, err)
		}
	}
	return nil
}
