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

const unifiedParent = "embeddings"

var sanitizeRe = regexp.MustCompile(`[^a-zA-Z0-9]`)

// sanitizeIdentifier folds non-alphanumerics to underscore and lowercases —
// stable across Postgres's case-folding.
func sanitizeIdentifier(s string) string {
	return strings.ToLower(sanitizeRe.ReplaceAllString(s, "_"))
}

func subtreeName(resource string) string {
	return fmt.Sprintf("%s_%s", unifiedParent, resource)
}

func subtreeDefaultName(resource string) string {
	return fmt.Sprintf("%s_%s_default", unifiedParent, resource)
}

// leafName builds `embeddings_<R>_<ns>`. Postgres caps identifiers at 63
// chars; long namespaces need a hash-suffix fallback (not yet implemented).
func leafName(resource, namespace string) string {
	return fmt.Sprintf("%s_%s_%s", unifiedParent, resource, sanitizeIdentifier(namespace))
}

// Promoter moves over-threshold tenants from each sub-tree's DEFAULT into
// dedicated leaves with HNSW + GIN. Timer-driven; off the write path.
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

// Run ticks every s.interval until ctx is cancelled. Per-iteration errors
// are logged; the loop keeps running.
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

// Promote runs one pass over every resource sub-tree. Exported for tests.
func (s *Promoter) Promote(ctx context.Context) error {
	resources, err := s.discoverResources(ctx)
	if err != nil {
		return fmt.Errorf("discover resource sub-trees: %w", err)
	}
	for _, resource := range resources {
		if err := s.promoteResource(ctx, resource); err != nil {
			return fmt.Errorf("promote %s: %w", resource, err)
		}
	}
	return nil
}

// discoverResources returns resource names from sub-trees attached to the
// unified parent. Filters relkind='p' to skip the top-level DEFAULT.
func (s *Promoter) discoverResources(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.relname FROM pg_inherits i
		JOIN pg_class c ON c.oid = i.inhrelid
		JOIN pg_class p ON p.oid = i.inhparent
		WHERE p.relname = $1 AND c.relkind = 'p'
	`, unifiedParent)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	prefix := unifiedParent + "_"
	var resources []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		resources = append(resources, strings.TrimPrefix(name, prefix))
	}
	return resources, rows.Err()
}

func (s *Promoter) promoteResource(ctx context.Context, resource string) error {
	subtree := subtreeName(resource)
	defaultName := subtreeDefaultName(resource)

	if err := s.dropInvalidIndexes(ctx, subtree); err != nil {
		return err
	}

	// Promoted tenants live in their own leaves, so DEFAULT is the only
	// place over-threshold tenants can be hiding.
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
		if err := s.promote(ctx, resource, ns); err != nil {
			// One bad tenant shouldn't stop the pass.
			s.log.Warn("promote failed", "resource", resource, "namespace", ns, "err", err)
		}
	}
	return nil
}

// promote moves a tenant's rows from the sub-tree's DEFAULT into a new
// dedicated leaf with its own HNSW.
//
// In-tx under EXCLUSIVE on DEFAULT: create staging, INSERT, DELETE, ATTACH.
// Outside tx (CREATE INDEX CONCURRENTLY can't run in one): build HNSW + GIN,
// ANALYZE. Idempotent via the partitionExists check.
//
// The EXCLUSIVE lock blocks only writers still landing in this sub-tree's
// DEFAULT — small tenants of this resource plus the tenant being promoted.
// Already-promoted tenants and other resources are unaffected. Duration
// tracks the INSERT+DELETE, usually sub-second. Optimizations if this hurts:
// rate-limit the sweeper, or two-phase promote with an updated_at column.
func (s *Promoter) promote(ctx context.Context, resource, namespace string) error {
	subtree := subtreeName(resource)
	defaultName := subtreeDefaultName(resource)
	newLeaf := leafName(resource, namespace)

	exists, err := s.partitionExists(ctx, subtree, newLeaf)
	if err != nil {
		return err
	}
	if exists {
		// Leaf exists from a prior run; HNSW may still be INVALID.
		return s.ensureHNSW(ctx, newLeaf)
	}

	nsLit := "'" + strings.ReplaceAll(namespace, "'", "''") + "'"

	err = s.db.WithTx(ctx, nil, func(ctx context.Context, tx db.Tx) error {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`LOCK TABLE %s IN EXCLUSIVE MODE`, defaultName)); err != nil {
			return fmt.Errorf("lock %s: %w", defaultName, err)
		}

		// Standalone staging (no INCLUDING INDEXES — we build HNSW after ATTACH).
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`CREATE TABLE %s (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
			newLeaf, subtree,
		)); err != nil {
			return fmt.Errorf("create staging %s: %w", newLeaf, err)
		}

		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`INSERT INTO %s SELECT * FROM %s WHERE namespace = $1`,
			newLeaf, defaultName,
		), namespace); err != nil {
			return fmt.Errorf("move rows into %s: %w", newLeaf, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`DELETE FROM %s WHERE namespace = $1`, defaultName,
		), namespace); err != nil {
			return fmt.Errorf("delete moved rows from %s: %w", defaultName, err)
		}

		// ATTACH to the sub-tree. DEFAULT must be empty of conflicting rows
		// — the DELETE above guarantees that.
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(
			`ALTER TABLE %s ATTACH PARTITION %s FOR VALUES IN (%s)`,
			subtree, newLeaf, nsLit,
		)); err != nil {
			return fmt.Errorf("attach partition %s: %w", newLeaf, err)
		}
		return nil
	})
	if err != nil {
		return err
	}

	s.log.Info("promoted tenant", "resource", resource, "namespace", namespace, "partition", newLeaf)

	if err := s.ensureHNSW(ctx, newLeaf); err != nil {
		return err
	}

	// Best-effort observability — pg_inherits is the source of truth.
	if _, err := s.db.ExecContext(ctx,
		`INSERT INTO vector_promoted (namespace, resource, promoted_at)
		 VALUES ($1, $2, CURRENT_TIMESTAMP)
		 ON CONFLICT (namespace, resource) DO UPDATE SET promoted_at = EXCLUDED.promoted_at`,
		namespace, resource,
	); err != nil {
		s.log.Warn("vector_promoted upsert failed", "err", err)
	}
	return nil
}

// ensureHNSW builds HNSW + GIN indexes on a leaf. Must run outside a tx.
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

	// Without GIN, a restrictive JSONB filter post-filters HNSW's top-K and
	// can return fewer than N matches.
	metadataName := partition + "_metadata"
	if err := s.ensureIndex(ctx, metadataName, fmt.Sprintf(
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS %s
			ON %s USING GIN (metadata)`,
		metadataName, partition,
	)); err != nil {
		return err
	}

	// Without ANALYZE the planner estimates ~1 row and may skip the HNSW.
	if _, err := s.db.ExecContext(ctx, fmt.Sprintf(`ANALYZE %s`, partition)); err != nil {
		s.log.Warn("ANALYZE after promote failed", "partition", partition, "err", err)
	}
	return nil
}

// ensureIndex runs `ddl` unless `idxName` already exists as a valid index.
// `ddl` must target `idxName`.
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

// dropInvalidIndexes drops any INVALID indexes on the sub-tree's leaves —
// leftovers from a prior CREATE INDEX CONCURRENTLY that failed mid-build.
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
		s.log.Warn("dropping invalid index", "index", n)
		if _, err := s.db.ExecContext(ctx, fmt.Sprintf(`DROP INDEX CONCURRENTLY IF EXISTS %s`, n)); err != nil {
			s.log.Warn("DROP INDEX failed", "index", n, "err", err)
		}
	}
	return nil
}
