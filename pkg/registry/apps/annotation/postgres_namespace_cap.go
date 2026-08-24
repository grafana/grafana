package annotation

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

var _ NamespaceCapEnforcer = (*PostgreSQLStore)(nil)

// EnforceNamespaceCap implements the NamespaceCapEnforcer interface.
// For every namespace whose live-row counter exceeds maxPerNamespace, it
// deletes the oldest live annotations (by time) until the namespace is back
// at the cap, and decrements the counter by the number of rows removed.
func (s *PostgreSQLStore) EnforceNamespaceCap(ctx context.Context, maxPerNamespace int64) (int64, error) {
	if maxPerNamespace <= 0 {
		return 0, nil
	}

	rows, err := s.pool.Query(ctx, namespacesOverCapSQL, maxPerNamespace)
	if err != nil {
		return 0, fmt.Errorf("failed to list namespaces over cap: %w", err)
	}

	type overCap struct {
		namespace string
		excess    int64
	}
	var toPrune []overCap
	for rows.Next() {
		var oc overCap
		if err := rows.Scan(&oc.namespace, &oc.excess); err != nil {
			rows.Close()
			return 0, fmt.Errorf("failed to scan namespace count row: %w", err)
		}
		toPrune = append(toPrune, oc)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, fmt.Errorf("error iterating namespace count rows: %w", err)
	}
	rows.Close()

	var totalDeleted int64
	for _, oc := range toPrune {
		deleted, err := s.pruneOldestInNamespace(ctx, oc.namespace, oc.excess)
		if err != nil {
			return totalDeleted, fmt.Errorf("failed to prune namespace %s: %w", oc.namespace, err)
		}
		totalDeleted += deleted
	}

	return totalDeleted, nil
}

// pruneOldestInNamespace hard-deletes the oldest `limit` live annotations in
// namespace and decrements its counter by the number actually removed, all
// in one transaction so the counter never falls out of sync with the table.
func (s *PostgreSQLStore) pruneOldestInNamespace(ctx context.Context, namespace string, limit int64) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
			s.logger.Error("failed to rollback transaction", "error", err)
		}
	}()

	// Oldest-first over the (namespace, time) index, which every partition
	// carries; this is a hard delete (unlike the soft-delete Delete path)
	// since these rows are being pruned purely to bound storage.
	tag, err := tx.Exec(ctx, `
		DELETE FROM annotations
		WHERE (namespace, name) IN (
			SELECT namespace, name FROM annotations
			WHERE namespace = $1
			ORDER BY time ASC
			LIMIT $2
		)
	`, namespace, limit)
	if err != nil {
		return 0, fmt.Errorf("failed to delete oldest annotations: %w", err)
	}

	deleted := tag.RowsAffected()
	if deleted > 0 {
		if _, err := tx.Exec(ctx, `
			UPDATE annotation_namespace_counts
			SET count = count - $1
			WHERE namespace = $2
		`, deleted, namespace); err != nil {
			return 0, fmt.Errorf("failed to update namespace count: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return deleted, nil
}
