package vector

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

// partitionedTables lists the partitioned parent tables the sweeper scans.
// Add more as new resource types get their own partitioned table.
var partitionedTables = []string{"dashboard_embeddings"}

var sanitizeRe = regexp.MustCompile(`[^a-zA-Z0-9]`)

func sanitizeIdentifier(s string) string {
	// Non-alphanumerics → underscore, lowercased so identifiers are
	// consistent regardless of Postgres's case-folding rules.
	return strings.ToLower(sanitizeRe.ReplaceAllString(s, "_"))
}

// partitionName for (parent, namespace). Postgres identifier limit is 63
// chars; with short namespaces this fits. Hash-suffix strategy would be the
// fallback if identifiers ever overflow.
func partitionName(parent, namespace string) string {
	return fmt.Sprintf("%s_%s", parent, sanitizeIdentifier(namespace))
}

// Promoter moves over-threshold tenants from the DEFAULT partition into
// dedicated partitions with their own HNSW + GIN indexes. Runs on a timer;
// does nothing on the write path.
type Promoter struct {
	db        db.DB
	threshold int
	interval  time.Duration
	log       log.Logger
}

func NewPromoter(database db.DB, threshold int, interval time.Duration) *Promoter {
	return &Promoter{
		db:        database,
		threshold: threshold,
		interval:  interval,
		log:       log.New("vector-promoter"),
	}
}

// Run blocks until ctx is cancelled. Ticks every s.interval and calls Promote.
// Promote errors are logged but don't stop the loop.
func (s *Promoter) Run(ctx context.Context) error {
	if s.interval <= 0 {
		s.log.Info("vector promoter disabled (interval <= 0)")
		<-ctx.Done()
		return nil
	}
	s.log.Info("vector promoter starting", "interval", s.interval, "threshold", s.threshold)
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			if err := s.Promote(ctx); err != nil {
				s.log.Warn("vector promoter iteration failed", "err", err)
			}
		}
	}
}

// Sweep runs one pass over every partitioned table. Exported so tests can
// trigger a pass inline.
func (s *Promoter) Promote(ctx context.Context) error {
	for _, parent := range partitionedTables {
		if err := s.promoteParent(ctx, parent); err != nil {
			return fmt.Errorf("promote %s: %w", parent, err)
		}
	}
	return nil
}

func (s *Promoter) promoteParent(ctx context.Context, parent string) error {
	defaultName := parent + "_default"

	// Drop INVALID HNSW indexes left behind by prior failed
	// CREATE INDEX CONCURRENTLY attempts. Safe to DROP even mid-build.
	if err := s.dropInvalidIndexes(ctx, parent); err != nil {
		return err
	}

	// Enumerate namespaces over threshold in the DEFAULT partition. Only
	// DEFAULT can contain small tenants; promoted tenants are already out.
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT namespace FROM %s GROUP BY namespace HAVING COUNT(*) > $1`, defaultName),
		s.threshold)
	if err != nil {
		return fmt.Errorf("enumerate tenants in %s: %w", defaultName, err)
	}
	var namespaces []string
	for rows.Next() {
		var ns string
		if err := rows.Scan(&ns); err != nil {
			_ = rows.Close()
			return err
		}
		namespaces = append(namespaces, ns)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	if err := rows.Close(); err != nil {
		return err
	}

	for _, ns := range namespaces {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := s.promote(ctx, parent, ns); err != nil {
			// Log and continue; one bad tenant shouldn't stop the pass.
			s.log.Warn("promote failed", "parent", parent, "namespace", ns, "err", err)
		}
	}
	return nil
}

// promote detaches a tenant's rows from the DEFAULT partition and attaches
// them as a new dedicated partition with its own HNSW index.
//
// Steps (the first 5 run in one tx under EXCLUSIVE lock on DEFAULT;
// HNSW build runs outside the tx because CREATE INDEX CONCURRENTLY
// can't be in a transaction):
//
//  1. LOCK the DEFAULT partition EXCLUSIVE. Writers targeting DEFAULT block
//     for the duration of the tx — which is only small-tenant writers, plus
//     any new writer for the tenant being promoted.
//     Writers for already-promoted tenants route to their own partitions
//     and are unaffected.
//  2. CREATE standalone staging table with the same schema as the parent.
//  3. INSERT rows matching `namespace` from DEFAULT → staging.
//  4. DELETE rows matching `namespace` from DEFAULT.
//  5. ATTACH the staging table as a partition FOR VALUES IN ('<ns>').
//  6. (outside tx) CREATE INDEX CONCURRENTLY HNSW on the new partition.
//  7. ANALYZE so the planner knows the partition's row count.
//
// Idempotent: if the partition already exists the function returns immediately.
//
// Known tradeoff — small-tenant writes block during steps 1-5:
//
// The EXCLUSIVE lock on DEFAULT pauses every writer whose namespace still
// lives there (all small tenants + the tenant being promoted). Duration is
// bounded by the INSERT + DELETE on matching rows — sub-second for a
// tenant with a few thousand rows on SSD. Accepted for MVP because
// promotions are infrequent (threshold-crossing events, not per-request).
//
// Optimization paths if this becomes painful:
//   - Rate-limit the sweeper (max N promotions per cycle) to cap
//     accumulated block time during initial backlog drain.
//   - Two-phase promote: bulk-copy outside the lock (unblocked), then
//     briefly lock to sync updates + ATTACH. Needs an updated_at column
//     and a way to detect rows modified during the copy window. Shrinks
//     the lock window to ~tens of ms regardless of tenant size.
//   - Postgres 17+ SPLIT PARTITION is cleaner to code but takes
//     ACCESS EXCLUSIVE on DEFAULT (blocks reads too) — worse than this.
func (s *Promoter) promote(ctx context.Context, parent, namespace string) error {
	newPart := partitionName(parent, namespace)

	// Already attached? Check pg_inherits.
	exists, err := s.partitionExists(ctx, parent, newPart)
	if err != nil {
		return err
	}
	if exists {
		// Partition exists; ensure its HNSW is valid.
		return s.ensureHNSW(ctx, newPart)
	}

	nsLit := "'" + strings.ReplaceAll(namespace, "'", "''") + "'"

	err = s.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		// Block only writers that would land in DEFAULT: small tenants plus
		// any new write for the tenant being promoted (which still routes
		// there until ATTACH runs). Writers for already-promoted tenants
		// target their own partitions and aren't affected. SELECTs proceed.
		defaultName := parent + "_default"
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`LOCK TABLE %s IN EXCLUSIVE MODE`, defaultName)); err != nil {
			return fmt.Errorf("lock %s: %w", defaultName, err)
		}

		// Standalone staging table with the same schema as the parent.
		// INCLUDING DEFAULTS preserves DEFAULTs; no INCLUDING INDEXES so we
		// don't inherit indexes from the parent (we build HNSW after attach).
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`CREATE TABLE %s (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
			newPart, parent,
		)); err != nil {
			return fmt.Errorf("create staging %s: %w", newPart, err)
		}

		// Move rows from DEFAULT → staging.
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`INSERT INTO %s SELECT * FROM %s_default WHERE namespace = $1`,
			newPart, parent,
		), namespace); err != nil {
			return fmt.Errorf("move rows into %s: %w", newPart, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`DELETE FROM %s_default WHERE namespace = $1`, parent,
		), namespace); err != nil {
			return fmt.Errorf("delete moved rows from %s_default: %w", parent, err)
		}

		// Attach. Postgres validates the constraint (all rows in staging
		// have namespace = <ns>) and ensures DEFAULT has no conflicting
		// rows — since we just moved them, it passes.
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`ALTER TABLE %s ATTACH PARTITION %s FOR VALUES IN (%s)`,
			parent, newPart, nsLit,
		)); err != nil {
			return fmt.Errorf("attach partition %s: %w", newPart, err)
		}
		return nil
	})
	if err != nil {
		return err
	}

	s.log.Info("promoted tenant", "parent", parent, "namespace", namespace, "partition", newPart)

	// HNSW + ANALYZE outside the tx.
	if err := s.ensureHNSW(ctx, newPart); err != nil {
		return err
	}

	// Best-effort observability.
	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO vector_promoted (namespace, resource, promoted_at)
		 VALUES ($1, $2, CURRENT_TIMESTAMP)
		 ON CONFLICT (namespace, resource) DO UPDATE SET promoted_at = EXCLUDED.promoted_at`,
		namespace, strings.TrimSuffix(parent, "_embeddings"),
	); err != nil {
		s.log.Warn("vector_promoted upsert failed", "err", err)
	}
	return nil
}

// ensureHNSW builds the HNSW index on a partition if it doesn't already exist
// as a valid index. CREATE INDEX CONCURRENTLY can't run in a transaction.
// Also ensures a GIN on metadata for JSONB containment filters.
func (s *Promoter) ensureHNSW(ctx context.Context, partition string) error {
	hnswName := partition + "_hnsw"
	if err := s.ensureIndex(ctx, hnswName, fmt.Sprintf(
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS %s
			ON %s USING hnsw (embedding halfvec_cosine_ops)
			WITH (m = 16, ef_construction = 64)`,
		hnswName, partition,
	)); err != nil {
		return err
	}

	// GIN on metadata — otherwise a restrictive JSONB containment filter has
	// to post-filter the HNSW's top-K results and can return fewer than N
	// matches.
	metadataName := partition + "_metadata"
	if err := s.ensureIndex(ctx, metadataName, fmt.Sprintf(
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS %s
			ON %s USING GIN (metadata)`,
		metadataName, partition,
	)); err != nil {
		return err
	}

	// ANALYZE so the planner's row estimate reflects reality (otherwise it
	// may default to ~1 row and prefer other indexes).
	if _, err := s.db.ExecContext(ctx, fmt.Sprintf(`ANALYZE %s`, partition)); err != nil {
		s.log.Warn("ANALYZE after promote failed", "partition", partition, "err", err)
	}
	return nil
}

// ensureIndex creates an index via the given DDL if it doesn't already exist
// as a valid index. DDL must be a CREATE INDEX [CONCURRENTLY] IF NOT EXISTS
// targeting `idxName`.
func (s *Promoter) ensureIndex(ctx context.Context, idxName, ddl string) error {
	exists, err := s.indexExistsValid(ctx, idxName)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	s.log.Info("creating index on partition", "index", idxName)
	if _, err := s.db.ExecContext(ctx, ddl); err != nil {
		return fmt.Errorf("create index %s: %w", idxName, err)
	}
	return nil
}

// partitionExists returns true if `partition` is currently attached to
// `parent`.
func (s *Promoter) partitionExists(ctx context.Context, parent, partition string) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_inherits i
			JOIN pg_class c ON c.oid = i.inhrelid
			JOIN pg_class p ON p.oid = i.inhparent
			WHERE p.relname = $1 AND c.relname = $2
		)`, parent, partition).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (s *Promoter) indexExistsValid(ctx context.Context, idxName string) (bool, error) {
	var valid bool
	err := s.db.QueryRowContext(ctx, `
		SELECT i.indisvalid FROM pg_class c
		JOIN pg_index i ON i.indexrelid = c.oid
		WHERE c.relname = $1 AND c.relkind = 'i'
	`, idxName).Scan(&valid)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return valid, nil
}

// dropInvalidIndexes cleans up any INVALID HNSW indexes left behind by prior
// failed CREATE INDEX CONCURRENTLY attempts. Looks across every partition of
// `parent`.
func (s *Promoter) dropInvalidIndexes(ctx context.Context, parent string) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_index i ON i.indexrelid = c.oid
		JOIN pg_class t ON t.oid = i.indrelid
		JOIN pg_inherits h ON h.inhrelid = t.oid
		JOIN pg_class p ON p.oid = h.inhparent
		WHERE p.relname = $1 AND c.relkind = 'i' AND NOT i.indisvalid
	`, parent)
	if err != nil {
		return fmt.Errorf("list invalid indexes under %s: %w", parent, err)
	}
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			_ = rows.Close()
			return err
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	_ = rows.Close()
	for _, n := range names {
		s.log.Warn("dropping invalid index from failed CREATE INDEX CONCURRENTLY", "index", n)
		if _, err := s.db.ExecContext(ctx, fmt.Sprintf(`DROP INDEX CONCURRENTLY IF EXISTS %s`, n)); err != nil {
			s.log.Warn("DROP INDEX failed", "index", n, "err", err)
		}
	}
	return nil
}
