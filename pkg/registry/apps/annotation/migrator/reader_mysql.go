package migrator

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
)

type MySQLReader struct {
	db *sql.DB
}

var _ LegacyReader = (*MySQLReader)(nil)

// NewMySQLReader returns a reader over an already-open legacy MySQL connection.
// The caller owns the connection lifecycle.
func NewMySQLReader(db *sql.DB) *MySQLReader {
	return &MySQLReader{db: db}
}

// Totals reads the count and the highest id in one aggregate
func (r *MySQLReader) Totals(ctx context.Context, orgID int64) (LegacyTotals, error) {
	const query = "SELECT COUNT(*), COALESCE(MAX(id), 0) FROM annotation " +
		"WHERE org_id = ? AND alert_id = 0"

	var totals LegacyTotals
	if err := r.db.QueryRowContext(ctx, query, orgID).Scan(&totals.Count, &totals.MaxID); err != nil {
		return LegacyTotals{}, fmt.Errorf("reading legacy annotation totals: %w", err)
	}
	return totals, nil
}

// LatestChange returns the newest point on the legacy `updated` timeline.
func (r *MySQLReader) LatestChange(ctx context.Context, orgID int64) (UpdateCursor, error) {
	const query = "SELECT COALESCE(a.updated, 0), a.id FROM annotation a " +
		"WHERE a.org_id = ? AND a.alert_id = 0 " +
		"ORDER BY a.updated DESC, a.id DESC " +
		"LIMIT 1"

	var cursor UpdateCursor
	err := r.db.QueryRowContext(ctx, query, orgID).Scan(&cursor.Updated, &cursor.ID)
	if errors.Is(err, sql.ErrNoRows) {
		// No user annotations: the zero cursor is the start of the timeline.
		return UpdateCursor{}, nil
	}
	if err != nil {
		return UpdateCursor{}, fmt.Errorf("reading latest legacy annotation change: %w", err)
	}
	return cursor, nil
}

// legacySelectFrom is the shared column list + source for reading legacy
// annotations. Column order must match the scan order in queryBatch.
const legacySelectFrom = "SELECT a.id, a.epoch, COALESCE(a.epoch_end, 0), " +
	"COALESCE(a.dashboard_uid, ''), COALESCE(a.panel_id, 0), a.text, " +
	"COALESCE(a.data, ''), COALESCE(a.created, 0), COALESCE(a.updated, 0), " +
	"COALESCE(u.uid, ''), COALESCE(u.is_service_account, 0) " +
	"FROM annotation a " +
	"LEFT JOIN `user` u ON u.id = a.user_id "

func (r *MySQLReader) ReadBatch(ctx context.Context, orgID, afterID int64, limit int) ([]LegacyAnnotation, error) {
	const query = legacySelectFrom +
		"WHERE a.org_id = ? AND a.alert_id = 0 AND a.id > ? " +
		"ORDER BY a.id ASC " +
		"LIMIT ?"

	return r.queryBatch(ctx, query, orgID, afterID, limit)
}

func (r *MySQLReader) ReadChangedBatch(ctx context.Context, orgID, sinceUpdated, afterID int64, limit int) ([]LegacyAnnotation, error) {
	// Keyset pagination over (updated, id). Because `updated` is a non-unique
	// millisecond timestamp, the (updated = ? AND id > ?) branch resumes within a
	// group of rows sharing the same updated value
	const query = legacySelectFrom +
		"WHERE a.org_id = ? AND a.alert_id = 0 " +
		"AND (a.updated > ? OR (a.updated = ? AND a.id > ?)) " +
		"ORDER BY a.updated ASC, a.id ASC " +
		"LIMIT ?"

	return r.queryBatch(ctx, query, orgID, sinceUpdated, sinceUpdated, afterID, limit)
}

func (r *MySQLReader) queryBatch(ctx context.Context, query string, args ...any) ([]LegacyAnnotation, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
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
		var isServiceAccount int64
		if err := rows.Scan(&a.ID, &a.Epoch, &a.EpochEnd, &a.DashboardUID,
			&a.PanelID, &a.Text, &a.Data, &a.Created, &a.Updated, &a.UserUID, &isServiceAccount); err != nil {
			return nil, fmt.Errorf("scanning legacy annotation: %w", err)
		}
		a.UserIsServiceAccount = isServiceAccount != 0
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

	for id := range result {
		slices.Sort(result[id])
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
