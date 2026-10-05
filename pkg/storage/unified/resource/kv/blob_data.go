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

var (
	blobKeyColumns      = []string{"group", "resource", "namespace", "name", "uuid"}
	blobIdentityColumns = []string{"uuid", "namespace", "group", "resource", "name", "content_type"}
)

func blobIdentityArgs(key BlobKey) []any {
	return []any{key.UID, key.Namespace, key.Group, key.Resource, key.Name, key.ContentType}
}

func blobKeyFilter(opt ListOptions) ([]string, []any) {
	prefix := opt.StartKey
	if opt.EndKey != PrefixRangeEnd(opt.StartKey) {
		prefix = commonPrefix(opt.StartKey, opt.EndKey)
	}
	parts := strings.Split(prefix, "/")
	complete := parts[:min(len(parts)-1, len(blobKeyColumns)-1)]
	args := make([]any, 0, len(blobKeyColumns))
	for _, part := range complete {
		args = append(args, part)
	}
	if len(complete) == len(blobKeyColumns)-1 && len(parts) == len(blobKeyColumns) {
		if uid, _, found := strings.Cut(parts[len(parts)-1], "~"); found {
			args = append(args, uid)
		}
	}
	if len(args) == 0 {
		return nil, nil
	}
	return blobKeyColumns[:len(args)], args
}

func commonPrefix(a, b string) string {
	n := min(len(a), len(b))
	for i := 0; i < n; i++ {
		if a[i] != b[i] {
			return a[:i]
		}
	}
	return a[:n]
}

func (k *SqlKV) blobWhere(cols []string) string {
	conds := make([]string, len(cols))
	for i, c := range cols {
		conds[i] = fmt.Sprintf("%s = %s", k.dialect.QuoteIdent(c), k.dialect.Placeholder(i+1))
	}
	return strings.Join(conds, " AND ")
}

func (k *SqlKV) saveBlob(ctx context.Context, key string, value []byte) error {
	bk, err := ParseBlobKey(key)
	if err != nil {
		return err
	}
	if conn, ok := dbtxFromCtx(ctx); ok {
		return k.replaceBlob(ctx, conn, bk, value)
	}
	tx, err := k.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin blob save transaction: %w", err)
	}
	if err := k.replaceBlob(ctx, tx, bk, value); err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit blob save: %w", err)
	}
	return nil
}

func (k *SqlKV) replaceBlob(ctx context.Context, conn dbtx, bk BlobKey, value []byte) error {
	deleteQuery := fmt.Sprintf("DELETE FROM %s WHERE %s", k.dialect.QuoteIdent(resourceBlobTable), k.blobWhere(blobIdentityColumns))
	if _, err := conn.ExecContext(ctx, deleteQuery, blobIdentityArgs(bk)...); err != nil {
		return fmt.Errorf("failed to replace blob: %w", err)
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
	if _, err := conn.ExecContext(ctx, query, args...); err != nil {
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
		k.dialect.QuoteIdent("value"), k.dialect.QuoteIdent(resourceBlobTable), k.blobWhere(blobIdentityColumns))
	var value []byte
	if err := k.conn(ctx).QueryRowContext(ctx, query, blobIdentityArgs(bk)...).Scan(&value); err != nil {
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
	query := fmt.Sprintf("DELETE FROM %s WHERE %s", k.dialect.QuoteIdent(resourceBlobTable), k.blobWhere(blobIdentityColumns))
	if _, err := k.conn(ctx).ExecContext(ctx, query, blobIdentityArgs(bk)...); err != nil {
		return fmt.Errorf("failed to delete blob: %w", err)
	}
	return nil
}

func (k *SqlKV) blobKeys(ctx context.Context, opt ListOptions, yield func(string, error) bool) {
	query := fmt.Sprintf("SELECT %s, %s, %s, %s, %s, %s FROM %s",
		k.dialect.QuoteIdent("group"), k.dialect.QuoteIdent("resource"), k.dialect.QuoteIdent("namespace"),
		k.dialect.QuoteIdent("name"), k.dialect.QuoteIdent("uuid"), k.dialect.QuoteIdent("content_type"),
		k.dialect.QuoteIdent(resourceBlobTable))
	cols, args := blobKeyFilter(opt)
	if len(cols) > 0 {
		query += " WHERE " + k.blobWhere(cols)
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
