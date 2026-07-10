// Package migrator backfills user-created annotations from a legacy
// MySQL backend into a multi-tenant Postgres annotation store.
package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	annotation "github.com/grafana/grafana/pkg/registry/apps/annotation"
)

const defaultBatchSize = 1000

// BackfillWriter defines the destination side of the migration.
type BackfillWriter interface {
	// BulkInsert writes a batch idempotently and returns the number of rows
	// actually inserted (skips on conflicts)
	BulkInsert(ctx context.Context, recs []annotation.BackfillRecord) (int64, error)
	// UpsertBatch re-applies a batch of changed rows (delete-by-name then
	// insert), reconciling edits that may have moved the annotation's time
	UpsertBatch(ctx context.Context, recs []annotation.BackfillRecord) (int64, error)
	// CountMigrated counts backfilled rows in the namespace by the
	// legacy_migrated flag, used for the convergence check
	CountMigrated(ctx context.Context, namespace string) (int64, error)
}

type Request struct {
	OrgID     int64
	Namespace string
	BatchSize int
	DryRun    bool
}

type Result struct {
	Scanned  int64
	Inserted int64
	Skipped  int64
}

type Migrator struct {
	source LegacyReader
	dest   BackfillWriter
	logger log.Logger
}

// ProvideMigrator builds a Migrator over a legacy reader and a destination writer
func ProvideMigrator(source LegacyReader, dest BackfillWriter, logger log.Logger) *Migrator {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	return &Migrator{
		source: source,
		dest:   dest,
		logger: logger.New("logger", "annotation.migrator"),
	}
}

// Migrate copies all user-created annotations for the tenant in paginated batches.
// It is idempotent and resumable: progress is committed per batch, so a
// cancelled or failed run can be retried.
func (m *Migrator) Migrate(ctx context.Context, req Request) (Result, error) {
	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}

	logger := m.logger.New("namespace", req.Namespace, "org_id", req.OrgID, "dry_run", req.DryRun)
	logger.Info("starting annotation backfill", "batch_size", batchSize)

	var (
		result  Result
		afterID int64
	)
	for {
		if err := ctx.Err(); err != nil {
			logger.Info("backfill interrupted, will resume next cycle", "after_id", afterID, "scanned", result.Scanned, "inserted", result.Inserted)
			return result, err
		}

		batch, err := m.source.ReadBatch(ctx, req.OrgID, afterID, batchSize)
		if err != nil {
			return result, fmt.Errorf("reading batch after id %d: %w", afterID, err)
		}
		if len(batch) == 0 {
			break
		}
		result.Scanned += int64(len(batch))
		lastID := batch[len(batch)-1].ID

		if !req.DryRun {
			recs := make([]annotation.BackfillRecord, len(batch))
			for i, a := range batch {
				recs[i] = toBackfillRecord(req.Namespace, a)
			}
			inserted, err := m.dest.BulkInsert(ctx, recs)
			if err != nil {
				return result, fmt.Errorf("writing batch ending at id %d: %w", lastID, err)
			}
			result.Inserted += inserted
			result.Skipped += int64(len(recs)) - inserted
		}

		afterID = lastID
		logger.Debug("backfill progress", "after_id", afterID, "scanned", result.Scanned, "inserted", result.Inserted, "skipped", result.Skipped)

		// we have drained the table, return
		if len(batch) < batchSize {
			break
		}
	}

	logger.Info("annotation backfill complete", "scanned", result.Scanned, "inserted", result.Inserted, "skipped", result.Skipped)
	return result, nil
}

// UpdateCursor marks progress through the legacy `updated` timeline. It is a
// keyset over (updated, id). The caller persists it between cycles and passes
// it back to resume where the previous SyncUpdates left off.
type UpdateCursor struct {
	Updated int64
	ID      int64
}

// SyncUpdates re-applies legacy annotations changed since the given cursor, so
// edits made after the initial backfill converge in the destination. It scans forward by
// (updated, id), upserts each batch, and returns the advanced cursor.
func (m *Migrator) SyncUpdates(ctx context.Context, req Request, since UpdateCursor) (Result, UpdateCursor, error) {
	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}

	logger := m.logger.New("namespace", req.Namespace, "org_id", req.OrgID, "dry_run", req.DryRun)
	logger.Info("starting annotation update sync", "batch_size", batchSize, "since_updated", since.Updated, "since_id", since.ID)

	var result Result
	cursor := since
	for {
		if err := ctx.Err(); err != nil {
			logger.Info("update sync interrupted, will resume next cycle", "updated", cursor.Updated, "id", cursor.ID, "scanned", result.Scanned, "applied", result.Inserted)
			return result, cursor, err
		}

		batch, err := m.source.ReadChangedBatch(ctx, req.OrgID, cursor.Updated, cursor.ID, batchSize)
		if err != nil {
			return result, cursor, fmt.Errorf("reading changed batch after (updated %d, id %d): %w", cursor.Updated, cursor.ID, err)
		}
		if len(batch) == 0 {
			break
		}
		result.Scanned += int64(len(batch))
		last := batch[len(batch)-1]

		if !req.DryRun {
			recs := make([]annotation.BackfillRecord, len(batch))
			for i, a := range batch {
				recs[i] = toBackfillRecord(req.Namespace, a)
			}
			applied, err := m.dest.UpsertBatch(ctx, recs)
			if err != nil {
				return result, cursor, fmt.Errorf("upserting batch ending at (updated %d, id %d): %w", last.Updated, last.ID, err)
			}
			result.Inserted += applied
		}

		cursor = UpdateCursor{Updated: last.Updated, ID: last.ID}
		logger.Debug("update sync progress", "updated", cursor.Updated, "id", cursor.ID, "scanned", result.Scanned, "applied", result.Inserted)

		if len(batch) < batchSize {
			break
		}
	}

	logger.Info("annotation update sync complete", "scanned", result.Scanned, "applied", result.Inserted, "updated", cursor.Updated, "id", cursor.ID)
	return result, cursor, nil
}

// VerifyCounts reports the legacy user-annotation count and the number of those
// already migrated. It's fully backfilled when the two are equal.
func (m *Migrator) VerifyCounts(ctx context.Context, req Request) (legacy, migrated int64, err error) {
	legacy, err = m.source.CountUserAnnotations(ctx, req.OrgID)
	if err != nil {
		return 0, 0, err
	}

	migrated, err = m.dest.CountMigrated(ctx, req.Namespace)
	if err != nil {
		return 0, 0, err
	}
	return legacy, migrated, nil
}
