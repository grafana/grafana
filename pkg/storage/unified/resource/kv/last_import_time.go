package kv

import (
	"context"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

const (
	resourceLastImportTimeTable = "resource_last_import_time"
)

func (k *SqlKV) saveLastImportTime(ctx context.Context, key string) (io.WriteCloser, error) {
	ns, group, resource, lastImportTime, err := ParseLastImportTimeKey(key)
	if err != nil {
		return nil, err
	}

	var query string
	var args []any

	lastImportTime = lastImportTime.UTC()

	switch k.dialect.Name() {
	case "mysql":
		query = fmt.Sprintf("INSERT INTO %s (%s, %s, %s, %s) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE %s = ?",
			k.dialect.QuoteIdent(resourceLastImportTimeTable),
			k.dialect.QuoteIdent("group"),
			k.dialect.QuoteIdent("namespace"),
			k.dialect.QuoteIdent("resource"),
			k.dialect.QuoteIdent("last_import_time"),
			k.dialect.QuoteIdent("last_import_time"),
		)
		args = []any{group, ns, resource, lastImportTime, lastImportTime}
	case "postgres":
		query = fmt.Sprintf("INSERT INTO %s (%s, %s, %s, %s) VALUES (?, ?, ?, ?) ON CONFLICT (%s, %s, %s) DO UPDATE SET %s = ?)",
			k.dialect.QuoteIdent(resourceLastImportTimeTable),
			k.dialect.QuoteIdent("group"),
			k.dialect.QuoteIdent("resource"),
			k.dialect.QuoteIdent("namespace"),
			k.dialect.QuoteIdent("last_import_time"),
			k.dialect.QuoteIdent("group"),
			k.dialect.QuoteIdent("resource"),
			k.dialect.QuoteIdent("namespace"),
			k.dialect.QuoteIdent("last_import_time"),
		)
		args = []any{group, resource, ns, lastImportTime, lastImportTime}
	case "sqlite":
		query = fmt.Sprintf("INSERT OR REPLACE INTO %s (%s, %s, %s, %s) VALUES (?, ?, ?, ?)",
			k.dialect.QuoteIdent(resourceLastImportTimeTable),
			k.dialect.QuoteIdent("group"),
			k.dialect.QuoteIdent("namespace"),
			k.dialect.QuoteIdent("resource"),
			k.dialect.QuoteIdent("last_import_time"),
		)
		args = []any{group, ns, resource, lastImportTime}
	default:
		return nil, fmt.Errorf("unknown dialect: %v", k.dialect.Name())
	}
	_, err = k.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to save last import time: %w", err)
	}
	return &noDataWriteCloser{}, nil
}

type noDataWriteCloser struct{}

func (n *noDataWriteCloser) Write([]byte) (int, error) {
	return 0, fmt.Errorf("can't write any data to last import time")
}

func (n noDataWriteCloser) Close() error {
	return nil
}

func (k *SqlKV) lastImportTimeKeys(ctx context.Context, opt ListOptions, yield func(string, error) bool) {
	// This table doesn't have key_path column, and it is always read fully from the beginning.
	if opt.StartKey != "" || opt.EndKey != "" || opt.Sort != SortOrderAsc || opt.Limit != 0 {
		yield("", fmt.Errorf("unsupported options, only ascending all-keys list supported: %+v", opt))
		return
	}

	query := fmt.Sprintf(
		"SELECT %s, %s, %s, %s FROM %s ORDER BY %s ASC, %s ASC, %s ASC",
		k.dialect.QuoteIdent("namespace"),
		k.dialect.QuoteIdent("group"),
		k.dialect.QuoteIdent("resource"),
		k.dialect.QuoteIdent("last_import_time"),
		k.dialect.QuoteIdent(resourceLastImportTimeTable),
		k.dialect.QuoteIdent("namespace"),
		k.dialect.QuoteIdent("group"),
		k.dialect.QuoteIdent("resource"),
	)

	rows, err := k.db.QueryContext(ctx, query)
	if err != nil {
		yield("", err)
		return
	}
	defer closeRows(rows, yield)

	for rows.Next() {
		var ns, group, resource string
		var lastImportTime time.Time
		if err := rows.Scan(&ns, &group, &resource, &lastImportTime); err != nil {
			yield("", fmt.Errorf("error reading row: %w", err))
			return
		}

		if !yield(LastImportTimeKey(ns, group, resource, lastImportTime), nil) {
			return
		}
	}

	if err := rows.Err(); err != nil {
		yield("", fmt.Errorf("failed to read rows: %w", err))
	}
}

func (k *SqlKV) deleteLastImportTime(ctx context.Context, key string) error {
	ns, group, resource, lastImportTime, err := ParseLastImportTimeKey(key)
	if err != nil {
		return err
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE %s = ? AND %s = ? AND %s = ? AND %s = ?",
		k.dialect.QuoteIdent(resourceLastImportTimeTable),
		k.dialect.QuoteIdent("group"),
		k.dialect.QuoteIdent("resource"),
		k.dialect.QuoteIdent("namespace"),
		k.dialect.QuoteIdent("last_import_time"),
	)
	args := []any{group, resource, ns, lastImportTime}
	_, err = k.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete last import time: %w", err)
	}
	return nil
}

func LastImportTimeKey(ns, group, resource string, ts time.Time) string {
	return fmt.Sprintf("%s~%s~%s~%d", ns, group, resource, ts.UnixMilli())
}

func ParseLastImportTimeKey(key string) (ns, group, resource string, ts time.Time, _ error) {
	parts := strings.Split(key, "~")
	if len(parts) != 4 {
		return "", "", "", time.Time{}, fmt.Errorf("invalid key format: expected 4 parts, got %d", len(parts))
	}

	t, err := strconv.ParseUint(parts[3], 10, 64)
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("invalid timestamp: %w", err)
	}

	return parts[0], parts[1], parts[2], time.UnixMilli(int64(t)).UTC(), nil
}
