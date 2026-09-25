package kv

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	resourceLastImportTimeTable = "resource_last_import_time"
)

func (k *SqlKV) saveLastImportTime(ctx context.Context, key string) error {
	ns, group, resource, lastImportTime, err := ParseLastImportTimeKey(key)
	if err != nil {
		return err
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
		query = fmt.Sprintf("INSERT INTO %s (%s, %s, %s, %s) VALUES ($1, $2, $3, $4) ON CONFLICT (%s, %s, %s) DO UPDATE SET %s = $5",
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
		return fmt.Errorf("unknown dialect: %v", k.dialect.Name())
	}
	_, err = k.conn(ctx).ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to save last import time: %w", err)
	}
	return nil
}

func (k *SqlKV) lastImportTimeKeys(ctx context.Context, opt ListOptions, yield func(string, error) bool) {
	if opt.Sort != SortOrderAsc || opt.Limit != 0 {
		yield("", fmt.Errorf("unsupported options, only ascending unlimited list supported: %+v", opt))
		return
	}

	var query string
	var args []any
	if opt.StartKey == "" && opt.EndKey == "" {
		query = fmt.Sprintf(
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
	} else {
		if opt.EndKey != PrefixRangeEnd(opt.StartKey) {
			yield("", fmt.Errorf("unsupported last import time key range: %+v", opt))
			return
		}
		ns, group, resource, err := ParseLastImportTimeKeyPrefix(opt.StartKey)
		if err != nil {
			yield("", err)
			return
		}

		placeholders := []string{"?", "?", "?"}
		if k.dialect.Name() == "postgres" {
			placeholders = []string{"$1", "$2", "$3"}
		}
		query = fmt.Sprintf(
			"SELECT %s, %s, %s, %s FROM %s WHERE %s = %s AND %s = %s AND %s = %s",
			k.dialect.QuoteIdent("namespace"),
			k.dialect.QuoteIdent("group"),
			k.dialect.QuoteIdent("resource"),
			k.dialect.QuoteIdent("last_import_time"),
			k.dialect.QuoteIdent(resourceLastImportTimeTable),
			k.dialect.QuoteIdent("group"), placeholders[0],
			k.dialect.QuoteIdent("resource"), placeholders[1],
			k.dialect.QuoteIdent("namespace"), placeholders[2],
		)
		args = []any{group, resource, ns}
	}

	rows, err := k.conn(ctx).QueryContext(ctx, query, args...)
	if err != nil {
		yield("", err)
		return
	}
	shouldYield := true
	defer func() { closeRows(rows, yield, shouldYield) }()

	// Keys are composite strings (namespace~group~resource~unixTimestamp). The
	// SQL ORDER BY sorts by the separate columns, which is not the same as
	// byte-wise ordering of the assembled key: '~' (0x7E) sorts above letters
	// and digits, so e.g. "ns1~..." precedes "ns~...". Other KV backends return
	// keys in full-key byte order, so sort here to match that contract.
	keys := make([]string, 0)
	for rows.Next() {
		var ns, group, resource string
		var lastImportTime time.Time
		if err := rows.Scan(&ns, &group, &resource, &lastImportTime); err != nil {
			shouldYield = yield("", fmt.Errorf("error reading row: %w", err))
			return
		}
		keys = append(keys, LastImportTimeKey(ns, group, resource, lastImportTime))
	}

	if err := rows.Err(); err != nil {
		shouldYield = yield("", fmt.Errorf("failed to read rows: %w", err))
		return
	}

	sort.Strings(keys)
	for _, key := range keys {
		if shouldYield = yield(key, nil); !shouldYield {
			return
		}
	}
}

func (k *SqlKV) deleteLastImportTime(ctx context.Context, key string) error {
	ns, group, resource, lastImportTime, err := ParseLastImportTimeKey(key)
	if err != nil {
		return err
	}

	sql := "DELETE FROM %s WHERE %s = ? AND %s = ? AND %s = ? AND %s = ?"
	if k.dialect.Name() == "postgres" {
		sql = "DELETE FROM %s WHERE %s = $1 AND %s = $2 AND %s = $3 AND %s = $4"
	}

	query := fmt.Sprintf(sql,
		k.dialect.QuoteIdent(resourceLastImportTimeTable),
		k.dialect.QuoteIdent("group"),
		k.dialect.QuoteIdent("resource"),
		k.dialect.QuoteIdent("namespace"),
		k.dialect.QuoteIdent("last_import_time"),
	)
	args := []any{group, resource, ns, lastImportTime}
	_, err = k.conn(ctx).ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete last import time: %w", err)
	}
	return nil
}

func LastImportTimeKeyPrefix(ns, group, resource string) string {
	return fmt.Sprintf("%s~%s~%s~", ns, group, resource)
}

func ParseLastImportTimeKeyPrefix(prefix string) (ns, group, resource string, _ error) {
	parts := strings.Split(strings.TrimSuffix(prefix, "~"), "~")
	if len(parts) != 3 || !strings.HasSuffix(prefix, "~") {
		return "", "", "", fmt.Errorf("invalid key prefix %q", prefix)
	}
	return parts[0], parts[1], parts[2], nil
}

func LastImportTimeKey(ns, group, resource string, ts time.Time) string {
	// We use unix seconds, as SQL implementation uses DATETIME which has seconds precision.
	return fmt.Sprintf("%s%d", LastImportTimeKeyPrefix(ns, group, resource), ts.Unix())
}

func ParseLastImportTimeKey(key string) (ns, group, resource string, ts time.Time, _ error) {
	parts := strings.Split(key, "~")
	if len(parts) != 4 {
		return "", "", "", time.Time{}, fmt.Errorf("invalid key format %q: expected 4 parts, got %d", key, len(parts))
	}

	t, err := strconv.ParseUint(parts[3], 10, 64)
	if err != nil {
		return "", "", "", time.Time{}, fmt.Errorf("invalid timestamp: %w", err)
	}

	return parts[0], parts[1], parts[2], time.Unix(int64(t), 0).UTC(), nil
}
