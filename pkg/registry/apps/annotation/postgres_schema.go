package annotation

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// PartitionInfo contains metadata about a partition
type PartitionInfo struct {
	Name       string
	StartTime  int64
	EndTime    int64
	WeekNumber int
	Year       int
}

// getPartitionName calculates the ISO week-based partition name from a timestamp
// Example: annotations_2025w10 for time in week 10 of 2025
func getPartitionName(timeMs int64) string {
	t := time.UnixMilli(timeMs)
	year, week := t.ISOWeek()
	return fmt.Sprintf("annotations_%dw%02d", year, week)
}

// getPartitionBounds calculates the week start/end timestamps in milliseconds
// Uses ISO 8601 week definition (Monday start, week containing first Thursday)
func getPartitionBounds(timeMs int64) (start, end int64) {
	t := time.UnixMilli(timeMs)

	// Get ISO week and year
	year, week := t.ISOWeek()

	// Calculate the start of the ISO week
	// ISO week 1 is the week containing the first Thursday of the year
	// Find January 4th (always in week 1)
	jan4 := time.Date(year, time.January, 4, 0, 0, 0, 0, time.UTC)

	// Find the Monday of week 1
	daysToMonday := int(time.Monday - jan4.Weekday())
	if daysToMonday > 0 {
		daysToMonday -= 7
	}
	week1Monday := jan4.AddDate(0, 0, daysToMonday)

	// Add weeks to get to the target week
	weekStart := week1Monday.AddDate(0, 0, (week-1)*7)
	weekEnd := weekStart.AddDate(0, 0, 7)

	start = weekStart.UnixMilli()
	end = weekEnd.UnixMilli()

	return start, end
}

// ensurePartition creates a partition for the given timestamp if it doesn't exist
// This is called before inserts to ensure the target partition exists
func ensurePartition(ctx context.Context, db *sql.DB, timeMs int64) error {
	partitionName := getPartitionName(timeMs)
	start, end := getPartitionBounds(timeMs)

	// Create the partition table
	createPartitionSQL := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s
		PARTITION OF annotations
		FOR VALUES FROM (%d) TO (%d)
	`, partitionName, start, end)

	if _, err := db.ExecContext(ctx, createPartitionSQL); err != nil {
		return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
	}

	// Create indices on the new partition
	// Note: These are created with IF NOT EXISTS to be idempotent

	// BRIN index on time for efficient time-range queries
	if _, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS idx_time_%s ON %s USING BRIN (time)`,
		partitionName, partitionName,
	)); err != nil {
		return fmt.Errorf("failed to create BRIN index on %s: %w", partitionName, err)
	}

	// B-tree index on (namespace, time) for time-only queries
	if _, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS idx_ns_time_%s ON %s (namespace, time)`,
		partitionName, partitionName,
	)); err != nil {
		return fmt.Errorf("failed to create namespace/time index on %s: %w", partitionName, err)
	}

	// B-tree index on (namespace, dashboard_uid, panel_id, time) for dashboard queries
	if _, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS idx_dashboard_%s ON %s (namespace, dashboard_uid, panel_id, time)`,
		partitionName, partitionName,
	)); err != nil {
		return fmt.Errorf("failed to create dashboard index on %s: %w", partitionName, err)
	}

	// B-tree index on (namespace, time_end) for range filtering
	if _, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS idx_time_end_%s ON %s (namespace, time_end)`,
		partitionName, partitionName,
	)); err != nil {
		return fmt.Errorf("failed to create time_end index on %s: %w", partitionName, err)
	}

	// GIN index on tags for tag filtering
	if _, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS idx_tags_%s ON %s USING GIN (tags)`,
		partitionName, partitionName,
	)); err != nil {
		return fmt.Errorf("failed to create tags GIN index on %s: %w", partitionName, err)
	}

	// GIN index on scopes for scope filtering
	if _, err := db.ExecContext(ctx, fmt.Sprintf(
		`CREATE INDEX IF NOT EXISTS idx_scopes_%s ON %s USING GIN (scopes)`,
		partitionName, partitionName,
	)); err != nil {
		return fmt.Errorf("failed to create scopes GIN index on %s: %w", partitionName, err)
	}

	return nil
}

// listPartitions queries pg_inherits and pg_class to list existing partitions
func listPartitions(ctx context.Context, db *sql.DB) ([]PartitionInfo, error) {
	query := `
		SELECT
			child.relname AS partition_name
		FROM pg_inherits
		JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
		JOIN pg_class child ON pg_inherits.inhrelid = child.oid
		WHERE parent.relname = 'annotations'
		ORDER BY child.relname
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query partitions: %w", err)
	}
	defer rows.Close()

	var partitions []PartitionInfo
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan partition row: %w", err)
		}

		// Parse partition name to extract year and week
		var year, week int
		if _, err := fmt.Sscanf(name, "annotations_%dw%d", &year, &week); err != nil {
			// Skip partitions that don't match our naming convention
			continue
		}

		// Calculate bounds from year and week
		// Find January 4th of that year (always in week 1)
		jan4 := time.Date(year, time.January, 4, 0, 0, 0, 0, time.UTC)
		daysToMonday := int(time.Monday - jan4.Weekday())
		if daysToMonday > 0 {
			daysToMonday -= 7
		}
		week1Monday := jan4.AddDate(0, 0, daysToMonday)
		weekStart := week1Monday.AddDate(0, 0, (week-1)*7)
		weekEnd := weekStart.AddDate(0, 0, 7)

		partitions = append(partitions, PartitionInfo{
			Name:       name,
			StartTime:  weekStart.UnixMilli(),
			EndTime:    weekEnd.UnixMilli(),
			WeekNumber: week,
			Year:       year,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating partition rows: %w", err)
	}

	return partitions, nil
}

// createParentTable creates the parent partitioned table if it doesn't exist
func createParentTable(ctx context.Context, db *sql.DB) error {
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS annotations (
			namespace VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			time BIGINT NOT NULL,
			time_end BIGINT,
			dashboard_uid VARCHAR(40),
			panel_id BIGINT,
			text TEXT NOT NULL,
			tags TEXT[],
			scopes TEXT[],
			created_by VARCHAR(255),
			created_at BIGINT NOT NULL,
			PRIMARY KEY (namespace, name, time),
			CHECK (time_end IS NULL OR time_end >= time)
		) PARTITION BY RANGE (time)
	`

	if _, err := db.ExecContext(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create parent table: %w", err)
	}

	return nil
}

// createTagsMaterializedView creates a materialized view for fast tag counting
// The view aggregates tags from annotations in the last 90 days
// This avoids scanning millions of records while keeping counts accurate for recent tags
func createTagsMaterializedView(ctx context.Context, db *sql.DB) error {
	// Check if materialized view already exists
	var exists bool
	checkSQL := `
		SELECT EXISTS (
			SELECT 1 FROM pg_matviews
			WHERE schemaname = 'public'
			AND matviewname = 'annotation_tags_mv'
		)
	`
	if err := db.QueryRowContext(ctx, checkSQL).Scan(&exists); err != nil {
		return fmt.Errorf("failed to check if materialized view exists: %w", err)
	}

	if exists {
		// Materialized view already exists, skip creation
		return nil
	}

	// Create materialized view with tags from last 90 days
	createViewSQL := `
		CREATE MATERIALIZED VIEW annotation_tags_mv AS
		SELECT
			namespace,
			tag,
			COUNT(*) as count
		FROM annotations, unnest(tags) as tag
		WHERE time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days') * 1000
		GROUP BY namespace, tag
	`

	if _, err := db.ExecContext(ctx, createViewSQL); err != nil {
		return fmt.Errorf("failed to create materialized view: %w", err)
	}

	// Create unique index for fast lookups and to enable CONCURRENTLY refresh
	createIndexSQL := `
		CREATE UNIQUE INDEX idx_annotation_tags_mv_pk
		ON annotation_tags_mv (namespace, tag)
	`

	if _, err := db.ExecContext(ctx, createIndexSQL); err != nil {
		return fmt.Errorf("failed to create materialized view index: %w", err)
	}

	return nil
}
