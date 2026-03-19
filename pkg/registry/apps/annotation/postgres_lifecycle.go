package annotation

import (
	"context"
	"fmt"
	"time"
)

// Cleanup implements the LifecycleManager interface
// It removes old partitions that are beyond the retention TTL
// TODO: figure out where this needs to be called from (e.g., background goroutine in the store, or an external cron job)
func (s *PostgreSQLStore) Cleanup(ctx context.Context) (int64, error) {
	// Calculate cutoff timestamp
	cutoff := time.Now().Add(-s.config.RetentionTTL)
	cutoffMs := cutoff.UnixMilli()

	// Calculate the cutoff partition name
	cutoffPartition := getPartitionName(cutoffMs)

	// Get all existing partitions
	partitions, err := listPartitions(ctx, s.pool)
	if err != nil {
		return 0, fmt.Errorf("failed to list partitions: %w", err)
	}

	var totalDeleted int64

	// Iterate through partitions and drop those older than cutoff
	for _, partition := range partitions {
		// Skip if partition is newer than or equal to cutoff
		if partition.Name >= cutoffPartition {
			continue
		}

		// Don't drop partitions less than 24 hours old even if they're past TTL
		if partition.EndTime > time.Now().Add(-24*time.Hour).UnixMilli() {
			continue
		}

		// Count rows to be deleted
		var count int64
		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", partition.Name)
		if err := s.pool.QueryRow(ctx, countQuery).Scan(&count); err != nil {
			// Log error but continue with other partitions since this is just for metrics
			s.logger.Warn("Failed to count rows in partition", "partition", partition.Name, "err", err)
			count = 0
		}

		// Detach partition first to avoid locking the main table during deletion
		detachQuery := fmt.Sprintf("ALTER TABLE annotations DETACH PARTITION %s", partition.Name)
		if _, err := s.pool.Exec(ctx, detachQuery); err != nil {
			return totalDeleted, fmt.Errorf("failed to detach partition %s: %w", partition.Name, err)
		}

		// Drop the detached partition
		dropQuery := fmt.Sprintf("DROP TABLE %s", partition.Name)
		if _, err := s.pool.Exec(ctx, dropQuery); err != nil {
			return totalDeleted, fmt.Errorf("failed to drop partition %s: %w", partition.Name, err)
		}

		totalDeleted += count
	}

	return totalDeleted, nil
}
