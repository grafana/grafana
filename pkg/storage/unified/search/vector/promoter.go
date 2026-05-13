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

// subtreeName is the per-resource leaf table: `embeddings_<R>`.
func subtreeName(resource string) string {
	return fmt.Sprintf("%s_%s", unifiedParent, resource)
}

// partialHNSWName builds the per-tenant partial HNSW index name. Format is
// `<resource>_<sanitized_namespace>_hnsw`. Postgres caps identifiers at 63
// chars: with `stacks_<int64>` namespaces (max 26 chars), resource names up
// to ~31 chars are safe.
func partialHNSWName(resource, namespace string) string {
	return fmt.Sprintf("%s_%s_hnsw", resource, sanitizeIdentifier(namespace))
}

// Promoter creates per-tenant partial HNSW indexes on each resource sub-tree
// for namespaces over the row-count threshold. Timer-driven; off the write
// path.
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

// discoverResources returns resource names from leaf tables attached to the
// unified parent. Filters relkind='r' (regular leaf tables).
func (s *Promoter) discoverResources(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.relname FROM pg_inherits i
		JOIN pg_class c ON c.oid = i.inhrelid
		JOIN pg_class p ON p.oid = i.inhparent
		WHERE p.relname = $1 AND c.relkind = 'r'
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

	if err := s.dropInvalidIndexes(ctx, subtree); err != nil {
		return err
	}

	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT namespace FROM %s GROUP BY namespace HAVING COUNT(*) > $1`, subtree),
		s.threshold)
	if err != nil {
		return fmt.Errorf("enumerate tenants in %s: %w", subtree, err)
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

// promote builds a partial HNSW index scoped to (resource, namespace).
// CREATE INDEX CONCURRENTLY can't run in a transaction. Idempotent — skips
// when a valid index already exists.
//
// Concurrency: CREATE INDEX CONCURRENTLY takes only SHARE UPDATE EXCLUSIVE
// on the table, so reads and writes proceed during the build. Build cost
// scales with rows matching the predicate, not the whole table.
func (s *Promoter) promote(ctx context.Context, resource, namespace string) error {
	subtree := subtreeName(resource)
	idxName := partialHNSWName(resource, namespace)

	valid, err := s.indexExistsValid(ctx, idxName)
	if err != nil {
		return err
	}
	if valid {
		return nil
	}

	nsLit := "'" + strings.ReplaceAll(namespace, "'", "''") + "'"
	ddl := fmt.Sprintf(
		`CREATE INDEX CONCURRENTLY IF NOT EXISTS %s
			ON %s USING hnsw (embedding halfvec_cosine_ops)
			WITH (m = 16, ef_construction = 64)
			WHERE namespace = %s`,
		idxName, subtree, nsLit,
	)

	s.log.Info("promoting tenant", "resource", resource, "namespace", namespace, "index", idxName)
	if _, err := s.db.ExecContext(ctx, ddl); err != nil {
		return fmt.Errorf("create partial index %s: %w", idxName, err)
	}

	// ANALYZE so the planner's row estimate for the partial index reflects
	// reality.
	if _, err := s.db.ExecContext(ctx, fmt.Sprintf(`ANALYZE %s`, subtree)); err != nil {
		s.log.Warn("ANALYZE after promote failed", "subtree", subtree, "err", err)
	}

	// Best-effort observability — pg_indexes is the source of truth.
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

// dropInvalidIndexes drops INVALID indexes on the resource sub-tree —
// leftovers from a prior CREATE INDEX CONCURRENTLY that failed mid-build.
func (s *Promoter) dropInvalidIndexes(ctx context.Context, subtree string) error {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_index i ON i.indexrelid = c.oid
		JOIN pg_class t ON t.oid = i.indrelid
		WHERE t.relname = $1 AND c.relkind = 'i' AND NOT i.indisvalid
	`, subtree)
	if err != nil {
		return fmt.Errorf("list invalid indexes on %s: %w", subtree, err)
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
