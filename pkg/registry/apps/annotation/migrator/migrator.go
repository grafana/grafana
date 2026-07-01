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
	// CountMigratedUpTo counts migrated rows whose legacy ID is within the legacy
	// ID space (<= maxLegacyID), used for the convergence check
	CountMigratedUpTo(ctx context.Context, namespace string, maxLegacyID int64) (int64, error)
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

// VerifyCounts reports the legacy user-annotation count and the number of those
// already migrated. It's fully backfilled when the two are equal.
func (m *Migrator) VerifyCounts(ctx context.Context, req Request) (legacy, migrated int64, err error) {
	legacy, err = m.source.CountUserAnnotations(ctx, req.OrgID)
	if err != nil {
		return 0, 0, err
	}

	maxID, err := m.source.MaxID(ctx, req.OrgID)
	if err != nil {
		return 0, 0, err
	}
	if maxID == 0 {
		return legacy, 0, nil
	}

	migrated, err = m.dest.CountMigratedUpTo(ctx, req.Namespace, maxID)
	if err != nil {
		return 0, 0, err
	}
	return legacy, migrated, nil
}
