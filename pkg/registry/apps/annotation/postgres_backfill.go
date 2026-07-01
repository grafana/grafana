package annotation

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/lib/pq"
)

// BackfillRecord is a fully-resolved annotation ready to be written into the
// multi-tenant store during migration from the legacy backend.
type BackfillRecord struct {
	Namespace    string
	Name         string
	Time         int64
	TimeEnd      *int64
	DashboardUID *string
	PanelID      *int64
	Text         string
	Tags         []string
	Scopes       []string
	CreatedBy    string
	CreatedAt    int64
	LegacyID     int64
	LegacyData   *string
}

// BulkInsert writes a batch of backfilled annotations in a single transaction.
//
// It is idempotent: rows are inserted with ON CONFLICT DO NOTHING against the
// (namespace, name, time) primary key.
func (s *PostgreSQLStore) BulkInsert(ctx context.Context, recs []BackfillRecord) (int64, error) {
	if len(recs) == 0 {
		return 0, nil
	}

	// Ensure a partition exists for every distinct week spanned by the batch
	// before inserting. ensurePartition is idempotent (CREATE ... IF NOT EXISTS)
	// and commits its own transaction, so it is safe to call up-front.
	seenPartitions := make(map[string]struct{}, len(recs))
	for _, rec := range recs {
		key := getPartitionName(rec.Time)
		if _, ok := seenPartitions[key]; ok {
			continue
		}
		seenPartitions[key] = struct{}{}
		if err := ensurePartition(ctx, s.pool, s.logger, rec.Time); err != nil {
			return 0, fmt.Errorf("failed to ensure partition for time %d: %w", rec.Time, err)
		}
	}

	var sb strings.Builder
	sb.WriteString("INSERT INTO annotations (")
	sb.WriteString(annotationColumnsSQL)
	sb.WriteString(") VALUES ")

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
		sb.WriteString(")")

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
	sb.WriteString(" ON CONFLICT DO NOTHING")

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to begin backfill transaction: %w", err)
	}
	defer func() {
		// Rollback is a no-op once the tx has been committed.
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			s.logger.Error("failed to rollback backfill transaction", "error", rbErr)
		}
	}()

	tag, err := tx.Exec(ctx, sb.String(), args...)
	if err != nil {
		return 0, fmt.Errorf("failed to bulk insert annotations: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit backfill transaction: %w", err)
	}

	return tag.RowsAffected(), nil
}

// CountBackfilled returns the number of rows in the namespace that carry any
// legacy ID.
func (s *PostgreSQLStore) CountBackfilled(ctx context.Context, namespace string) (int64, error) {
	var count int64
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM annotations WHERE namespace = $1 AND legacy_id IS NOT NULL`,
		namespace,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count backfilled annotations: %w", err)
	}
	return count, nil
}

// CountMigratedUpTo returns the number of migrated annotations in the namespace
// whose legacy ID is within the legacy ID space (legacy_id <= maxLegacyID).
func (s *PostgreSQLStore) CountMigratedUpTo(ctx context.Context, namespace string, maxLegacyID int64) (int64, error) {
	var count int64
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM annotations WHERE namespace = $1 AND legacy_id IS NOT NULL AND legacy_id <= $2`,
		namespace, maxLegacyID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count migrated annotations: %w", err)
	}
	return count, nil
}
