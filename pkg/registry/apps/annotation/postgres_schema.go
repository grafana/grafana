package annotation

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

//go:embed metadata_migrations/*.sql
var embedMetadataMigrations embed.FS

// PartitionInfo contains metadata about a partition
type PartitionInfo struct {
	Name       string
	StartTime  int64
	EndTime    int64
	ParentName string
}

const (
	createPartitionSQL = `
CREATE TABLE IF NOT EXISTS %s
PARTITION OF annotations
FOR VALUES FROM (%d) TO (%d);
`

	// Index templates for partitions
	createBRINIndexSQL      = `CREATE INDEX IF NOT EXISTS %s ON %s USING BRIN (time);`
	createTimeIndexSQL      = `CREATE INDEX IF NOT EXISTS %s ON %s (namespace, time);`
	createDashboardIndexSQL = `CREATE INDEX IF NOT EXISTS %s ON %s (namespace, dashboard_uid, panel_id, time);`
	createTimeEndIndexSQL   = `CREATE INDEX IF NOT EXISTS %s ON %s (namespace, time_end) WHERE time_end IS NOT NULL;`
	createTagsIndexSQL      = `CREATE INDEX IF NOT EXISTS %s ON %s USING GIN (namespace, tags);`
	createScopesIndexSQL    = `CREATE INDEX IF NOT EXISTS %s ON %s USING GIN (namespace, scopes);`

	listPartitionsSQL = `
SELECT
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_bounds
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'annotations'
ORDER BY child.relname;
`
)

// getPartitionName calculates the partition name for a given timestamp
// Returns partition name in format: annotations_YYYYwWW (e.g., annotations_2025w10)
func getPartitionName(ts int64) string {
	t := time.UnixMilli(ts).UTC()
	year, week := t.ISOWeek()
	return fmt.Sprintf("annotations_%dw%02d", year, week)
}

// getPartitionBounds calculates the start and end timestamps for the week containing ts
// Uses ISO 8601 week definition (Monday is first day of week)
func getPartitionBounds(ts int64) (start, end int64) {
	t := time.UnixMilli(ts).UTC()

	// Get the weekday (0=Sunday, 1=Monday, etc.)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday is 7 in ISO
	}

	// Start of week is Monday (subtract days since Monday)
	weekStart := t.AddDate(0, 0, -weekday+1).Truncate(24 * time.Hour)
	weekEnd := weekStart.AddDate(0, 0, 7)

	return weekStart.UnixMilli(), weekEnd.UnixMilli()
}

// ensurePartition creates a partition for the given timestamp if it doesn't exist
// TODO: should we pre-create partitions for the next N weeks in a background job instead of creating on-demand during inserts?
func ensurePartition(ctx context.Context, pool *pgxpool.Pool, logger log.Logger, ts int64) error {
	partitionName := getPartitionName(ts)
	start, end := getPartitionBounds(ts)

	// Begin transaction for partition creation
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil {
			logger.Error("failed to rollback transaction", "error", err)
		}
	}()

	// Create partition
	createPartition := fmt.Sprintf(createPartitionSQL, partitionName, start, end)
	if _, err := tx.Exec(ctx, createPartition); err != nil {
		// Check if error is "already exists", which is fine since we just want to ensure it exists
		if !isAlreadyExistsError(err) {
			return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
		}
	}

	// Create indices on the new partition
	indices := []string{
		fmt.Sprintf(createBRINIndexSQL, fmt.Sprintf("idx_time_%s", partitionName), partitionName),
		fmt.Sprintf(createTimeIndexSQL, fmt.Sprintf("idx_ns_time_%s", partitionName), partitionName),
		fmt.Sprintf(createDashboardIndexSQL, fmt.Sprintf("idx_dashboard_%s", partitionName), partitionName),
		fmt.Sprintf(createTimeEndIndexSQL, fmt.Sprintf("idx_time_end_%s", partitionName), partitionName),
		fmt.Sprintf(createTagsIndexSQL, fmt.Sprintf("idx_tags_%s", partitionName), partitionName),
		fmt.Sprintf(createScopesIndexSQL, fmt.Sprintf("idx_scopes_%s", partitionName), partitionName),
	}

	for _, indexSQL := range indices {
		if _, err := tx.Exec(ctx, indexSQL); err != nil {
			// Index creation errors are OK if they already exist
			if !isAlreadyExistsError(err) {
				return fmt.Errorf("failed to create index: %w", err)
			}
		}
	}

	return tx.Commit(ctx)
}

// listPartitions returns all existing partitions with their metadata
func listPartitions(ctx context.Context, pool *pgxpool.Pool) ([]PartitionInfo, error) {
	rows, err := pool.Query(ctx, listPartitionsSQL)
	if err != nil {
		return nil, fmt.Errorf("failed to query partitions: %w", err)
	}
	defer rows.Close()

	var partitions []PartitionInfo
	for rows.Next() {
		var name, bounds string
		if err := rows.Scan(&name, &bounds); err != nil {
			return nil, fmt.Errorf("failed to scan partition row: %w", err)
		}

		var start, end int64
		if _, err := fmt.Sscanf(bounds, "FOR VALUES FROM (%d) TO (%d)", &start, &end); err != nil {
			return nil, fmt.Errorf("failed to parse partition bounds %q: %w", bounds, err)
		}

		partitions = append(partitions, PartitionInfo{
			Name:       name,
			StartTime:  start,
			EndTime:    end,
			ParentName: "annotations",
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating partition rows: %w", err)
	}

	return partitions, nil
}

// runMigrations executes data shard migrations using goose
func runMigrations(ctx context.Context, pool *pgxpool.Pool, logger log.Logger) error {
	return runMigrationsFrom(ctx, pool, logger, embedMigrations, "migrations")
}

// runMetadataMigrations executes metadata database migrations using goose
func runMetadataMigrations(ctx context.Context, pool *pgxpool.Pool, logger log.Logger) error {
	return runMigrationsFrom(ctx, pool, logger, embedMetadataMigrations, "metadata_migrations")
}

func runMigrationsFrom(ctx context.Context, pool *pgxpool.Pool, logger log.Logger, fs embed.FS, dir string) error {
	db := stdlib.OpenDBFromPool(pool)
	defer func() {
		if err := db.Close(); err != nil {
			logger.Error("failed to close database connection", "error", err)
		}
	}()

	// Configure goose to use embedded migrations
	goose.SetBaseFS(fs)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	// Run all pending migrations
	if err := goose.UpContext(ctx, db, dir); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// isAlreadyExistsError checks if the error is a "relation already exists" error
func isAlreadyExistsError(err error) bool {
	if err == nil {
		return false
	}
	// Check for pgx error code "42P07" (duplicate_table)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "42P07"
	}
	return false
}
