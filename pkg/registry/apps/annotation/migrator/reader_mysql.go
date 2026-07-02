package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// LegacyReader reads user-created annotations from a legacy backend in
// paginated batches.
type LegacyReader interface {
	// CountUserAnnotations returns the number of user-created annotations
	CountUserAnnotations(ctx context.Context, orgID int64) (int64, error)
	// MaxID returns the largest annotation ID in the org
	MaxID(ctx context.Context, orgID int64) (int64, error)
	// ReadBatch returns up to limit user-created annotations for the org with
	// id > afterID, ordered by id ascending. Tags are resolved from the
	// normalized annotation_tag/tag tables.
	ReadBatch(ctx context.Context, orgID, afterID int64, limit int) ([]LegacyAnnotation, error)
}

type MySQLReader struct {
	db *sql.DB
}

var _ LegacyReader = (*MySQLReader)(nil)

// NewMySQLReader returns a reader over an already-open legacy MySQL connection.
// The caller owns the connection lifecycle.
func NewMySQLReader(db *sql.DB) *MySQLReader {
	return &MySQLReader{db: db}
}

func (r *MySQLReader) CountUserAnnotations(ctx context.Context, orgID int64) (int64, error) {
	var count int64
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM annotation WHERE org_id = ? AND alert_id = 0",
		orgID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting legacy user annotations: %w", err)
	}
	return count, nil
}

func (r *MySQLReader) MaxID(ctx context.Context, orgID int64) (int64, error) {
	var maxID sql.NullInt64
	err := r.db.QueryRowContext(ctx,
		"SELECT MAX(id) FROM annotation WHERE org_id = ?",
		orgID,
	).Scan(&maxID)
	if err != nil {
		return 0, fmt.Errorf("reading max legacy annotation id: %w", err)
	}
	if !maxID.Valid {
		return 0, nil
	}
	return maxID.Int64, nil
}

func (r *MySQLReader) ReadBatch(ctx context.Context, orgID, afterID int64, limit int) ([]LegacyAnnotation, error) {
	const query = "SELECT a.id, a.epoch, COALESCE(a.epoch_end, 0), " +
		"COALESCE(a.dashboard_uid, ''), COALESCE(a.panel_id, 0), a.text, " +
		"COALESCE(a.data, ''), COALESCE(a.created, 0), COALESCE(u.uid, '') " +
		"FROM annotation a " +
		"LEFT JOIN `user` u ON u.id = a.user_id " +
		"WHERE a.org_id = ? AND a.alert_id = 0 AND a.id > ? " +
		"ORDER BY a.id ASC " +
		"LIMIT ?"

	rows, err := r.db.QueryContext(ctx, query, orgID, afterID, limit)
	if err != nil {
		return nil, fmt.Errorf("reading legacy annotation batch: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var (
		batch []LegacyAnnotation
		ids   []int64
	)
	for rows.Next() {
		var a LegacyAnnotation
		if err := rows.Scan(&a.ID, &a.Epoch, &a.EpochEnd, &a.DashboardUID,
			&a.PanelID, &a.Text, &a.Data, &a.Created, &a.UserUID); err != nil {
			return nil, fmt.Errorf("scanning legacy annotation: %w", err)
		}
		batch = append(batch, a)
		ids = append(ids, a.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating legacy annotations: %w", err)
	}

	if len(batch) == 0 {
		return batch, nil
	}

	tagsByID, err := r.readTags(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range batch {
		batch[i].Tags = tagsByID[batch[i].ID]
	}

	return batch, nil
}

// readTags resolves tags for the given annotation IDs from the normalized
// annotation_tag table, formatting each as the legacy API does
// ("key:value", or just "key" when value is empty)
func (r *MySQLReader) readTags(ctx context.Context, ids []int64) (map[int64][]string, error) {
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	query := "SELECT at.annotation_id, t.`key`, t.value " +
		"FROM annotation_tag at " +
		"JOIN tag t ON t.id = at.tag_id " +
		"WHERE at.annotation_id IN (" + strings.Join(placeholders, ", ") + ")"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("reading legacy annotation tags: %w", err)
	}
	defer func() { _ = rows.Close() }()

	result := make(map[int64][]string, len(ids))
	for rows.Next() {
		var (
			annotationID int64
			key, value   string
		)
		if err := rows.Scan(&annotationID, &key, &value); err != nil {
			return nil, fmt.Errorf("scanning legacy tag: %w", err)
		}
		result[annotationID] = append(result[annotationID], formatTag(key, value))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating legacy tags: %w", err)
	}

	return result, nil
}

// formatTag renders a (key, value) tag pair the same way the legacy API does
// ("key:value", or just "key" when the value is empty), so migrated tags are
// identical to what the legacy API produced.
func formatTag(key, value string) string {
	if value != "" {
		return key + ":" + value
	}
	return key
}
