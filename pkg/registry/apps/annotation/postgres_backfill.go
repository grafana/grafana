package annotation

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
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

// UpsertBatch reconciles a batch of changed legacy annotations: for each record
// it removes any existing rows with the same name and re-inserts the current
// version, all in one transaction. Returns the number of rows written.
func (s *PostgreSQLStore) UpsertBatch(ctx context.Context, recs []migrator.BackfillRecord) (int64, error) {
	if len(recs) == 0 {
		return 0, nil
	}
	if err := s.ensureBatchPartitions(ctx, recs); err != nil {
		return 0, err
	}

	namesByNamespace := make(map[string][]string, 1)
	for _, rec := range recs {
		namesByNamespace[rec.Namespace] = append(namesByNamespace[rec.Namespace], rec.Name)
	}

	query, args := buildInsertSQL(recs)

	return s.execInTx(ctx, func(tx pgx.Tx) (int64, error) {
		for namespace, names := range namesByNamespace {
			if _, err := tx.Exec(ctx,
				`DELETE FROM annotations WHERE namespace = $1 AND name = ANY($2::text[])`,
				namespace, pq.Array(names),
			); err != nil {
				return 0, fmt.Errorf("failed to clear annotations for resync: %w", err)
			}
		}
		tag, err := tx.Exec(ctx, query, args...)
		if err != nil {
			return 0, fmt.Errorf("failed to upsert annotations: %w", err)
		}
		return tag.RowsAffected(), nil
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

// buildInsertSQL builds a multi-row INSERT
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

		var createdBy *string
		if rec.CreatedBy != "" {
			cb := rec.CreatedBy
			createdBy = &cb
		}
		var legacyID *int64
		if rec.LegacyID > 0 {
			id := rec.LegacyID
			legacyID = &id
		}

		args = append(args,
			rec.Namespace, rec.Name, rec.Time, rec.TimeEnd, rec.DashboardUID, rec.PanelID,
			rec.Text, pq.Array(rec.Tags), pq.Array(rec.Scopes), createdBy, rec.CreatedAt, legacyID, rec.LegacyData,
		)
	}
	return sb.String(), args
}

func (s *PostgreSQLStore) execInTx(ctx context.Context, fn func(tx pgx.Tx) (int64, error)) (int64, error) {
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
