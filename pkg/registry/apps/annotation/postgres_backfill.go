package annotation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"

	"github.com/grafana/grafana/pkg/registry/apps/annotation/migrator"
)

var _ migrator.BackfillWriter = (*PostgreSQLStore)(nil)

// InsertBatch writes a batch of backfilled annotations in a single transaction.
//
// It is idempotent: rows are inserted with ON CONFLICT DO NOTHING against the
// (namespace, name, time) primary key.
func (s *PostgreSQLStore) InsertBatch(ctx context.Context, recs []migrator.BackfillRecord) (int64, error) {
	if len(recs) == 0 {
		return 0, nil
	}
	if err := s.ensureBatchPartitions(ctx, recs); err != nil {
		return 0, err
	}

	query, args := buildInsertSQL(recs)
	query += " ON CONFLICT DO NOTHING"

	return s.execInTx(ctx, func(tx pgx.Tx) (int64, error) {
		tag, err := tx.Exec(ctx, query, args...)
		if err != nil {
			return 0, fmt.Errorf("failed to bulk insert annotations: %w", err)
		}
		return tag.RowsAffected(), nil
	})
}

// UpsertBatch re-applies a batch of changed legacy annotations, updating each in
// place and returning how many rows it refreshed. A record identical to the stored
// row is not written and does not count. Postgres moves a row across
// weekly partitions when the annotation's time changed.
func (s *PostgreSQLStore) UpsertBatch(ctx context.Context, recs []migrator.BackfillRecord) (int64, error) {
	if len(recs) == 0 {
		return 0, nil
	}
	if err := s.ensureBatchPartitions(ctx, recs); err != nil {
		return 0, err
	}

	return s.execInTx(ctx, func(tx pgx.Tx) (int64, error) {
		var updated int64
		for _, rec := range recs {
			tag, err := tx.Exec(ctx, updateMigratedSQL, annotationArgs(rec))
			if err != nil {
				return 0, fmt.Errorf("failed to update annotation during resync: %w", err)
			}
			updated += tag.RowsAffected()
		}
		return updated, nil
	})
}

// ensureBatchPartitions creates the partition for every distinct week spanned
// by the batch. ensurePartition is idempotent (CREATE ... IF NOT EXISTS) and
// commits its own transaction, so it is safe to call up-front.
func (s *PostgreSQLStore) ensureBatchPartitions(ctx context.Context, recs []migrator.BackfillRecord) error {
	seen := make(map[string]struct{}, len(recs))
	for _, rec := range recs {
		key := getPartitionName(rec.Time)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		if err := ensurePartition(ctx, s.pool, s.logger, rec.Time); err != nil {
			return fmt.Errorf("failed to ensure partition for time %d: %w", rec.Time, err)
		}
	}
	return nil
}

var annotationMatchColumns = map[string]struct{}{"namespace": {}, "name": {}}

// updateMigratedSQL re-applies a record to the row already under its name. It
// matches on name with no time predicate, which is what lets Postgres move the
// row when the annotation's time changed, across weekly partitions if need be.
//
// The IS DISTINCT FROM guard makes re-applying an unchanged row a no-op.
var updateMigratedSQL = fmt.Sprintf(
	"UPDATE annotations SET %s WHERE namespace = @namespace AND name = @name AND legacy_migrated AND %s",
	namedAssignments(updatableColumns()), namedRowDiffers(updatableColumns()))

// updatableColumns is annotationColumns minus the match columns.
func updatableColumns() []string {
	cols := make([]string, 0, len(annotationColumns))
	for _, col := range annotationColumns {
		if _, isKey := annotationMatchColumns[col]; !isKey {
			cols = append(cols, col)
		}
	}
	return cols
}

// namedAssignments renders cols as "col1 = @col1, col2 = @col2, ...".
func namedAssignments(cols []string) string {
	assignments := make([]string, len(cols))
	for i, col := range cols {
		assignments[i] = col + " = @" + col
	}
	return strings.Join(assignments, ", ")
}

// namedRowDiffers renders cols as "(col1, col2) IS DISTINCT FROM (@col1, @col2)".
func namedRowDiffers(cols []string) string {
	names := make([]string, len(cols))
	for i, col := range cols {
		names[i] = "@" + col
	}
	return "(" + strings.Join(cols, ", ") + ") IS DISTINCT FROM (" + strings.Join(names, ", ") + ")"
}

// annotationArgs binds rec's values to their column names.
func annotationArgs(rec migrator.BackfillRecord) pgx.NamedArgs {
	var createdBy *string
	if rec.CreatedBy != "" {
		createdBy = &rec.CreatedBy
	}
	var legacyID *int64
	if rec.LegacyID > 0 {
		legacyID = &rec.LegacyID
	}
	return pgx.NamedArgs{
		"namespace":     rec.Namespace,
		"name":          rec.Name,
		"time":          rec.Time,
		"time_end":      rec.TimeEnd,
		"dashboard_uid": rec.DashboardUID,
		"panel_id":      rec.PanelID,
		"text":          rec.Text,
		"tags":          pq.Array(rec.Tags),
		"scopes":        pq.Array(rec.Scopes),
		"created_by":    createdBy,
		"created_at":    rec.CreatedAt,
		"legacy_id":     legacyID,
		"legacy_data":   rec.LegacyData,
	}
}

// buildInsertSQL builds the multi-row INSERT for the bulk backfill path.
func buildInsertSQL(recs []migrator.BackfillRecord) (string, []any) {
	var sb strings.Builder
	sb.WriteString("INSERT INTO annotations (")
	sb.WriteString(annotationColumnsSQL)
	sb.WriteString(", legacy_migrated) VALUES ")

	args := make([]any, 0, len(recs)*annotationColumnCount)
	for i, rec := range recs {
		if i > 0 {
			sb.WriteString(", ")
		}
		base := i * annotationColumnCount
		sb.WriteString("(")
		for c := 0; c < annotationColumnCount; c++ {
			if c > 0 {
				sb.WriteString(", ")
			}
			fmt.Fprintf(&sb, "$%d", base+c+1)
		}
		// legacy_migrated is always true on the backfill path
		sb.WriteString(", true)")

		named := annotationArgs(rec)
		for _, col := range annotationColumns {
			args = append(args, named[col])
		}
	}
	return sb.String(), args
}

// Two retries, so three attempts in all. Waiting long is not needed, a
// serialization failure means the conflicting transaction has already committed.
var txRetryBackoff = backoff.Config{
	MinBackoff: 20 * time.Millisecond,
	MaxBackoff: 100 * time.Millisecond,
	MaxRetries: 2,
}

// execInTx runs fn in a transaction, replaying it if Postgres rejects it with a
// serialization failure. Both backfill write paths are idempotent, so a replay is
// safe; fn must reset any accumulator it writes to.
func (s *PostgreSQLStore) execInTx(ctx context.Context, fn func(tx pgx.Tx) (int64, error)) (int64, error) {
	boff := backoff.New(ctx, txRetryBackoff)
	for {
		n, err := s.execOnceInTx(ctx, fn)
		if err == nil {
			return n, nil
		}
		if !isRetryableTxError(err) || !boff.Ongoing() {
			return 0, err
		}
		s.logger.Warn("retrying annotation transaction after a serialization failure",
			"attempt", boff.NumRetries()+1, "error", err)
		boff.Wait()
	}
}

func (s *PostgreSQLStore) execOnceInTx(ctx context.Context, fn func(tx pgx.Tx) (int64, error)) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		// Rollback is a no-op once the tx has been committed.
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			s.logger.Error("failed to rollback transaction", "error", rbErr)
		}
	}()

	n, err := fn(tx)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}
	return n, nil
}

// isRetryableTxError reports whether Postgres aborted the transaction for a
// reason that a replay resolves.
func isRetryableTxError(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	switch pgErr.Code {
	case "40001": // serialization_failure
		return true
	case "40P01": // deadlock_detected
		return true
	default:
		return false
	}
}

// CountMigrated returns the number of backfilled annotations in the namespace,
// identified by the legacy_migrated flag
func (s *PostgreSQLStore) CountMigrated(ctx context.Context, namespace string) (int64, error) {
	var count int64
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM annotations WHERE namespace = $1 AND legacy_migrated`,
		namespace,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count migrated annotations: %w", err)
	}
	return count, nil
}
