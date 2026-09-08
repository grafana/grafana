// Package migrator backfills user-created annotations from a legacy
// MySQL backend into a multi-tenant Postgres annotation store.
package migrator

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

const defaultBatchSize = 1000

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
	CreatedAt    time.Time
	LegacyID     int64
	LegacyData   *string
}

// Cursors is a tenant's migration progress. The caller persists it between
// cycles and passes it back.
type Cursors struct {
	// Backfill is the highest legacy id Migrate has copied.
	Backfill int64
	// Updates is the position on the legacy `updated` timeline SyncUpdates
	// resumes from.
	Updates UpdateCursor
}

// UpdateCursor marks progress through the legacy `updated` timeline.
type UpdateCursor struct {
	Updated int64
	ID      int64
}

// Before reports whether c sits earlier on the timeline than other.
func (c UpdateCursor) Before(other UpdateCursor) bool {
	if c.Updated != other.Updated {
		return c.Updated < other.Updated
	}
	return c.ID < other.ID
}

// later returns whichever of the two cursors sits further along the timeline.
func (c UpdateCursor) later(other UpdateCursor) UpdateCursor {
	if c.Before(other) {
		return other
	}
	return c
}

// atMost caps c at limit, so a scan cannot report a position past a bound read
// before it started.
func (c UpdateCursor) atMost(limit UpdateCursor) UpdateCursor {
	if limit.Before(c) {
		return limit
	}
	return c
}

// rewind moves c back by duration, so the scan resumes at every row
// whose `updated` is at or after the rewound millisecond.
func (c UpdateCursor) rewind(d time.Duration) UpdateCursor {
	if d <= 0 {
		return c
	}
	updated := c.Updated - d.Milliseconds()
	if updated < 0 {
		updated = 0
	}
	return UpdateCursor{Updated: updated}
}

// LegacyTotals summarises a tenant's legacy annotations.
type LegacyTotals struct {
	Count int64
	MaxID int64
}

// LegacyReader reads user-created annotations from a legacy backend in
// paginated batches. It is implemented by MySQLReader.
type LegacyReader interface {
	// Totals returns the number of user-created annotations for the org and the
	// highest id among them.
	Totals(ctx context.Context, orgID int64) (LegacyTotals, error)
	// ReadBatch returns up to limit user-created annotations for the org with
	// id > afterID, ordered by id ascending. Tags are resolved from the
	// normalized annotation_tag/tag tables.
	ReadBatch(ctx context.Context, orgID, afterID int64, limit int) ([]LegacyAnnotation, error)
	// ReadChangedBatch returns up to limit user-created annotations changed
	// since the (sinceUpdated, afterID) cursor, ordered by (updated, id).
	// Used for incremental resync of edits made after the initial backfill.
	ReadChangedBatch(ctx context.Context, orgID, sinceUpdated, afterID int64, limit int) ([]LegacyAnnotation, error)
	// LatestChange returns the newest point on the legacy `updated` timeline.
	// It bounds what SyncUpdates can find, and seeds Cursors.Updates.
	LatestChange(ctx context.Context, orgID int64) (UpdateCursor, error)
}

// BackfillWriter defines the destination side of the migration.
type BackfillWriter interface {
	// InsertBatch writes a batch idempotently and returns the number of rows
	// actually inserted. It is the only writer of new rows.
	InsertBatch(ctx context.Context, recs []BackfillRecord) (int64, error)
	// UpsertBatch re-applies a batch of changed rows in place, reconciling edits
	// that may have moved the annotation's time, and returns how many it
	// refreshed.
	UpsertBatch(ctx context.Context, recs []BackfillRecord) (int64, error)
	// CountMigrated counts backfilled rows in the namespace by the
	// legacy_migrated flag
	CountMigrated(ctx context.Context, namespace string) (int64, error)
}

type Request struct {
	OrgID     int64
	Namespace string
	BatchSize int
	// DryRun scans and reports without writing.
	DryRun bool
	// Lookback rewinds the resync cursor before each SyncUpdates scan, so a row that
	// surfaces behind the cursor is still replayed.
	Lookback time.Duration
}

type Result struct {
	Scanned  int64
	Inserted int64
	Updated  int64
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

func (r Request) batchSize() int {
	if r.BatchSize <= 0 {
		return defaultBatchSize
	}
	return r.BatchSize
}

// records converts a legacy batch into destination records.
func (r Request) records(batch []LegacyAnnotation) []BackfillRecord {
	recs := make([]BackfillRecord, len(batch))
	for i, a := range batch {
		recs[i] = toBackfillRecord(r.Namespace, a)
	}
	return recs
}

// backfilled splits a resync batch into the records to re-apply and the number
// held back because the backfill has not reached their id yet.
func (r Request) backfilled(batch []LegacyAnnotation, upToID int64) (recs []BackfillRecord, held int64) {
	recs = make([]BackfillRecord, 0, len(batch))
	for _, a := range batch {
		if a.ID > upToID {
			held++
			continue
		}
		recs = append(recs, toBackfillRecord(r.Namespace, a))
	}
	return recs, held
}

// Migrate copies user-created annotations for the tenant in paginated batches,
// resuming strictly above cursors.Backfill and returning the cursor advanced to
// the last id it copied. It is idempotent and resumable.
func (m *Migrator) Migrate(ctx context.Context, req Request, cursors Cursors) (Result, Cursors, error) {
	batchSize := req.batchSize()
	logger := m.logger.New("namespace", req.Namespace, "org_id", req.OrgID, "dry_run", req.DryRun)
	logger.Info("starting annotation backfill", "batch_size", batchSize, "after_id", cursors.Backfill)

	var (
		result  Result
		afterID = cursors.Backfill
	)
	// progress returns the cursors as they stand, so every exit path persists
	// the batches that did commit.
	progress := func() Cursors { return Cursors{Backfill: afterID, Updates: cursors.Updates} }

	for {
		if err := ctx.Err(); err != nil {
			logger.Info("backfill interrupted, will resume next cycle", "after_id", afterID, "scanned", result.Scanned, "inserted", result.Inserted)
			return result, progress(), err
		}

		batch, err := m.source.ReadBatch(ctx, req.OrgID, afterID, batchSize)
		if err != nil {
			return result, progress(), fmt.Errorf("reading batch after id %d: %w", afterID, err)
		}
		if len(batch) == 0 {
			break
		}
		result.Scanned += int64(len(batch))
		lastID := batch[len(batch)-1].ID

		if !req.DryRun {
			recs := req.records(batch)
			inserted, err := m.dest.InsertBatch(ctx, recs)
			if err != nil {
				return result, progress(), fmt.Errorf("writing batch ending at id %d: %w", lastID, err)
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

	logger.Info("annotation backfill complete", "scanned", result.Scanned, "inserted", result.Inserted, "skipped", result.Skipped, "after_id", afterID)
	return result, progress(), nil
}

// SyncUpdates re-applies legacy annotations changed since cursors.Updates, so
// edits made after the initial backfill converge in the destination.
func (m *Migrator) SyncUpdates(ctx context.Context, req Request, cursors Cursors) (Result, Cursors, error) {
	batchSize := req.batchSize()
	logger := m.logger.New("namespace", req.Namespace, "org_id", req.OrgID, "dry_run", req.DryRun)

	since := cursors.Updates
	head, err := m.source.LatestChange(ctx, req.OrgID)
	if err != nil {
		return Result{}, cursors, fmt.Errorf("reading latest legacy change: %w", err)
	}

	logger.Info("starting annotation update sync", "batch_size", batchSize,
		"since_updated", since.Updated, "since_id", since.ID, "lookback", req.Lookback)

	var result Result
	cursor := since.rewind(req.Lookback)

	progress := func() Cursors {
		return Cursors{Backfill: cursors.Backfill, Updates: cursor.atMost(head).later(since)}
	}

	for {
		if err := ctx.Err(); err != nil {
			logger.Info("update sync interrupted, will resume next cycle", "updated", cursor.Updated, "id", cursor.ID, "scanned", result.Scanned, "refreshed", result.Updated)
			return result, progress(), err
		}

		batch, err := m.source.ReadChangedBatch(ctx, req.OrgID, cursor.Updated, cursor.ID, batchSize)
		if err != nil {
			return result, progress(), fmt.Errorf("reading changed batch after (updated %d, id %d): %w", cursor.Updated, cursor.ID, err)
		}
		if len(batch) == 0 {
			break
		}
		result.Scanned += int64(len(batch))
		last := batch[len(batch)-1]

		recs, held := req.backfilled(batch, cursors.Backfill)
		result.Skipped += held

		if !req.DryRun {
			updated, err := m.dest.UpsertBatch(ctx, recs)
			if err != nil {
				return result, progress(), fmt.Errorf("upserting batch ending at (updated %d, id %d): %w", last.Updated, last.ID, err)
			}
			result.Updated += updated
		}

		cursor = UpdateCursor{Updated: last.Updated, ID: last.ID}
		logger.Debug("update sync progress", "updated", cursor.Updated, "id", cursor.ID, "scanned", result.Scanned, "refreshed", result.Updated, "held", result.Skipped)

		if len(batch) < batchSize {
			break
		}
	}

	next := progress()
	logger.Info("annotation update sync complete", "scanned", result.Scanned, "refreshed", result.Updated,
		"held_for_backfill", result.Skipped, "updated", next.Updates.Updated, "id", next.Updates.ID)
	return result, next, nil
}

// Status describes how much migration work a tenant has outstanding.
type Status struct {
	// LegacyCount is the number of user-created annotations in the legacy backend.
	LegacyCount int64
	// MigratedCount is how many of the destination's rows came from a backfill
	MigratedCount int64
	// UpdatesHead is the newest point on the legacy `updated` timeline. Compare a
	// tenant's cursor against it for how far behind it is.
	UpdatesHead UpdateCursor
	// BackfillPending is true while legacy holds an id above the backfill cursor.
	BackfillPending bool
}

// Behind reports whether the tenant's cursor trails the legacy head, meaning
// SyncUpdates has changes left to replay. It compares the persisted cursor as
// it stands. The Lookback rewind belongs to the scan in SyncUpdates, and
// rewinding here would report every caught-up tenant as behind forever.
func (s Status) Behind(c Cursors) bool {
	return c.Updates.Before(s.UpdatesHead)
}

// Status reports where a tenant sits in the migration, given the cursors the
// caller has persisted for it.
func (m *Migrator) Status(ctx context.Context, req Request, cursors Cursors) (Status, error) {
	totals, err := m.source.Totals(ctx, req.OrgID)
	if err != nil {
		return Status{}, fmt.Errorf("reading legacy totals: %w", err)
	}

	migrated, err := m.dest.CountMigrated(ctx, req.Namespace)
	if err != nil {
		return Status{}, fmt.Errorf("counting migrated annotations: %w", err)
	}

	head, err := m.source.LatestChange(ctx, req.OrgID)
	if err != nil {
		return Status{}, fmt.Errorf("reading latest legacy change: %w", err)
	}

	return Status{
		LegacyCount:     totals.Count,
		MigratedCount:   migrated,
		UpdatesHead:     head,
		BackfillPending: cursors.Backfill < totals.MaxID,
	}, nil
}
