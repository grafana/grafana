package annotation

import (
	"context"
	"fmt"
)

// ListTags implements the TagProvider interface
// Returns tags with counts from materialized view, filtered by prefix and limited
// The counts reflect tags from annotations in the last 90 days
func (s *postgresStore) ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	// Query the materialized view for fast tag listing with counts
	var query string
	var args []any

	if opts.Prefix == "" {
		// No prefix filter
		query = `
			SELECT tag, count
			FROM annotation_tags_mv
			WHERE namespace = $1
			ORDER BY tag
			LIMIT $2
		`
		args = []any{namespace, opts.Limit}
	} else {
		// With prefix filter
		query = `
			SELECT tag, count
			FROM annotation_tags_mv
			WHERE namespace = $1 AND tag LIKE $2
			ORDER BY tag
			LIMIT $3
		`
		args = []any{namespace, opts.Prefix + "%", opts.Limit}
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.Name, &tag.Count); err != nil {
			return nil, fmt.Errorf("failed to scan tag row: %w", err)
		}
		tags = append(tags, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tag rows: %w", err)
	}

	return tags, nil
}

// refreshTagsMaterializedView refreshes the materialized view with current tag counts
// This should be called periodically (e.g., in the cleanup job or on a schedule)
// Uses CONCURRENTLY to avoid blocking queries
func (s *postgresStore) refreshTagsMaterializedView(ctx context.Context) error {
	query := `REFRESH MATERIALIZED VIEW CONCURRENTLY annotation_tags_mv`

	_, err := s.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to refresh materialized view: %w", err)
	}

	return nil
}
