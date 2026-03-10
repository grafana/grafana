package annotation

import (
	"context"
	"fmt"
	"time"
)

// Cleanup implements the LifecycleManager interface
// Removes partitions older than the retention TTL
// Returns the total number of annotations deleted
func (s *postgresStore) Cleanup(ctx context.Context) (int64, error) {
	// Calculate cutoff time
	cutoff := time.Now().Add(-s.retentionTTL)
	cutoffMs := cutoff.UnixMilli()

	// Get all existing partitions
	partitions, err := listPartitions(ctx, s.db)
	if err != nil {
		return 0, fmt.Errorf("failed to list partitions: %w", err)
	}

	var totalDeleted int64

	// Drop partitions older than cutoff
	for _, partition := range partitions {
		// Check if partition end time is before cutoff
		if partition.EndTime < cutoffMs {
			// Count rows in partition before dropping
			countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", partition.Name)
			var count int64
			if err := s.db.QueryRowContext(ctx, countQuery).Scan(&count); err != nil {
				// Log error but continue with other partitions
				fmt.Printf("warning: failed to count rows in partition %s: %v\n", partition.Name, err)
				count = 0
			}

			// Detach partition (makes it an independent table)
			detachSQL := fmt.Sprintf("ALTER TABLE annotations DETACH PARTITION %s", partition.Name)
			if _, err := s.db.ExecContext(ctx, detachSQL); err != nil {
				return totalDeleted, fmt.Errorf("failed to detach partition %s: %w", partition.Name, err)
			}

			// Drop the table
			dropSQL := fmt.Sprintf("DROP TABLE %s", partition.Name)
			if _, err := s.db.ExecContext(ctx, dropSQL); err != nil {
				return totalDeleted, fmt.Errorf("failed to drop partition %s: %w", partition.Name, err)
			}

			totalDeleted += count
		}
	}

	// Refresh materialized view to update tag counts
	// This computes fresh tag counts from the last 90 days of annotations
	if err := s.refreshTagsMaterializedView(ctx); err != nil {
		// Log but don't fail - tag view refresh is non-critical
		fmt.Printf("warning: failed to refresh tags materialized view: %v\n", err)
	} else {
		fmt.Printf("refreshed tags materialized view\n")
	}

	return totalDeleted, nil
}
