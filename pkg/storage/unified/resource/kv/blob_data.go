package kv

import (
	"bytes"
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"slices"
	"strings"
	"time"
)

const (
	BlobDataSection   = "unified/blob-data"
	resourceBlobTable = "resource_blob"
)

type BlobKey struct {
	Group       string
	Resource    string
	Namespace   string
	Name        string
	UID         string
	ContentType string
}

func (k BlobKey) UIDPrefix() string {
	return strings.Join([]string{k.Group, k.Resource, k.Namespace, k.Name, k.UID}, "/") + "~"
}

func (k BlobKey) String() string {
	return k.UIDPrefix() + url.PathEscape(k.ContentType)
}

func ParseBlobKey(key string) (BlobKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 || parts[0] == "" || parts[1] == "" || parts[3] == "" {
		return BlobKey{}, fmt.Errorf("invalid blob key %q: expected group/resource/namespace/name/uid~contentType", key)
	}
	uid, escaped, found := strings.Cut(parts[4], "~")
	if !found || uid == "" {
		return BlobKey{}, fmt.Errorf("invalid blob key %q: expected group/resource/namespace/name/uid~contentType", key)
	}
	contentType, err := url.PathUnescape(escaped)
	if err != nil {
		return BlobKey{}, fmt.Errorf("invalid blob key %q: %w", key, err)
	}
	return BlobKey{Group: parts[0], Resource: parts[1], Namespace: parts[2], Name: parts[3], UID: uid, ContentType: contentType}, nil
}

func parseBlobUIDPrefix(prefix string) (BlobKey, bool) {
	if !strings.HasSuffix(prefix, "~") {
		return BlobKey{}, false
	}
	bk, err := ParseBlobKey(prefix)
	return bk, err == nil && bk.ContentType == ""
}

func (k *SqlKV) blobWhere(start int) string {
	cols := []string{"uuid", "namespace", "group", "resource", "name"}
	conds := make([]string, len(cols))
	for i, c := range cols {
		conds[i] = fmt.Sprintf("%s = %s", k.dialect.QuoteIdent(c), k.dialect.Placeholder(start+i))
	}
	return strings.Join(conds, " AND ")
}

func blobWhereArgs(key BlobKey) []any {
	return []any{key.UID, key.Namespace, key.Group, key.Resource, key.Name}
}

func (k *SqlKV) saveBlob(ctx context.Context, key string, value []byte) error {
	bk, err := ParseBlobKey(key)
	if err != nil {
		return err
	}
	hash := md5.Sum(value) // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	cols := []string{"uuid", "created", "group", "resource", "namespace", "name", "value", "hash", "content_type"}
	quoted := make([]string, len(cols))
	placeholders := make([]string, len(cols))
	for i, c := range cols {
		quoted[i] = k.dialect.QuoteIdent(c)
		placeholders[i] = k.dialect.Placeholder(i + 1)
	}
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		k.dialect.QuoteIdent(resourceBlobTable), strings.Join(quoted, ", "), strings.Join(placeholders, ", "))
	args := []any{bk.UID, time.Now().UTC(), bk.Group, bk.Resource, bk.Namespace, bk.Name, value, hex.EncodeToString(hash[:]), bk.ContentType}
	if _, err := k.conn(ctx).ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("failed to save blob: %w", err)
	}
	return nil
}

func (k *SqlKV) getBlob(ctx context.Context, key string) (io.ReadCloser, error) {
	bk, err := ParseBlobKey(key)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf("SELECT %s FROM %s WHERE %s",
		k.dialect.QuoteIdent("value"), k.dialect.QuoteIdent(resourceBlobTable), k.blobWhere(1))
	var value []byte
	if err := k.conn(ctx).QueryRowContext(ctx, query, blobWhereArgs(bk)...).Scan(&value); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get blob: %w", err)
	}
	return io.NopCloser(bytes.NewReader(value)), nil
}

func (k *SqlKV) deleteBlob(ctx context.Context, key string) error {
	bk, err := ParseBlobKey(key)
	if err != nil {
		return err
	}
	query := fmt.Sprintf("DELETE FROM %s WHERE %s", k.dialect.QuoteIdent(resourceBlobTable), k.blobWhere(1))
	if _, err := k.conn(ctx).ExecContext(ctx, query, blobWhereArgs(bk)...); err != nil {
		return fmt.Errorf("failed to delete blob: %w", err)
	}
	return nil
}

func (k *SqlKV) blobKeys(ctx context.Context, opt ListOptions, yield func(string, error) bool) {
	query := fmt.Sprintf("SELECT %s, %s, %s, %s, %s, %s FROM %s",
		k.dialect.QuoteIdent("group"), k.dialect.QuoteIdent("resource"), k.dialect.QuoteIdent("namespace"),
		k.dialect.QuoteIdent("name"), k.dialect.QuoteIdent("uuid"), k.dialect.QuoteIdent("content_type"),
		k.dialect.QuoteIdent(resourceBlobTable))
	var args []any
	if bk, ok := parseBlobUIDPrefix(opt.StartKey); ok && opt.EndKey == PrefixRangeEnd(opt.StartKey) {
		query += " WHERE " + k.blobWhere(1)
		args = blobWhereArgs(bk)
	}
	rows, err := k.conn(ctx).QueryContext(ctx, query, args...)
	if err != nil {
		yield("", err)
		return
	}
	shouldYield := true
	defer func() { closeRows(rows, yield, shouldYield) }()

	keys := make([]string, 0)
	for rows.Next() {
		var bk BlobKey
		if err := rows.Scan(&bk.Group, &bk.Resource, &bk.Namespace, &bk.Name, &bk.UID, &bk.ContentType); err != nil {
			shouldYield = yield("", fmt.Errorf("error reading row: %w", err))
			return
		}
		key := bk.String()
		if key < opt.StartKey || (opt.EndKey != "" && key >= opt.EndKey) {
			continue
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		shouldYield = yield("", fmt.Errorf("failed to read rows: %w", err))
		return
	}

	slices.Sort(keys)
	if opt.Sort == SortOrderDesc {
		slices.Reverse(keys)
	}
	if opt.Limit > 0 && int64(len(keys)) > opt.Limit {
		keys = keys[:opt.Limit]
	}
	for _, key := range keys {
		if shouldYield = yield(key, nil); !shouldYield {
			return
		}
	}
}
