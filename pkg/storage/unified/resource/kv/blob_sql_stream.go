package kv

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"
)

// SaveBlobStream uses the existing resource_blob row. A transaction makes the
// incomplete value invisible; rollback on any error (including cancellation).
func (k *SqlKV) SaveBlobStream(ctx context.Context, key BlobKey, contentType string, value io.Reader) (size int64, digest string, err error) {
	tx, err := k.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, "", err
	}
	defer func() { _ = tx.Rollback() }()
	p := k.dialect.Placeholder
	q := k.dialect.QuoteIdent
	cols := []string{"uuid", "created", "group", "resource", "namespace", "name", "value", "hash", "content_type"}
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", q(resourceBlobTable), joinQuoted(q, cols), placeholders(p, len(cols)))
	_, err = tx.ExecContext(ctx, query, key.UID, time.Now().UTC(), key.Group, key.Resource, key.Namespace, key.Name, []byte{}, "", contentType)
	if err != nil {
		return 0, "", err
	}
	appendValue := fmt.Sprintf("%s || %s", q("value"), p(1))
	switch k.dialect.Name() {
	case "sqlite":
		appendValue = fmt.Sprintf("CAST(%s || CAST(%s AS BLOB) AS BLOB)", q("value"), p(1))
	case "mysql":
		appendValue = fmt.Sprintf("CONCAT(%s, %s)", q("value"), p(1))
	}
	update := fmt.Sprintf("UPDATE %s SET %s = %s WHERE %s", q(resourceBlobTable), q("value"), appendValue, k.blobWhereOffset(blobIdentityColumns, 2))
	buffer := make([]byte, 64<<10)
	h := md5.New() // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	for {
		n, readErr := value.Read(buffer)
		if n > 0 {
			args := append([]any{buffer[:n]}, blobIdentityArgs(key)...)
			if _, err := tx.ExecContext(ctx, update, args...); err != nil {
				return 0, "", err
			}
			_, _ = h.Write(buffer[:n])
			size += int64(n)
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return 0, "", readErr
		}
	}
	if size == 0 {
		return 0, "", fmt.Errorf("empty blob")
	}
	digest = hex.EncodeToString(h.Sum(nil))
	query = fmt.Sprintf("UPDATE %s SET %s = %s WHERE %s", q(resourceBlobTable), q("hash"), p(1), k.blobWhereOffset(blobIdentityColumns, 2))
	if _, err := tx.ExecContext(ctx, query, append([]any{digest}, blobIdentityArgs(key)...)...); err != nil {
		return 0, "", err
	}
	if err := tx.Commit(); err != nil {
		return 0, "", err
	}
	return size, digest, nil
}

func joinQuoted(quote func(string) string, cols []string) string {
	out := ""
	for i, col := range cols {
		if i > 0 {
			out += ", "
		}
		out += quote(col)
	}
	return out
}

func placeholders(placeholder func(int) string, count int) string {
	out := ""
	for i := 1; i <= count; i++ {
		if i > 1 {
			out += ", "
		}
		out += placeholder(i)
	}
	return out
}

func (k *SqlKV) blobWhereOffset(cols []string, offset int) string {
	out := ""
	for i, col := range cols {
		if i > 0 {
			out += " AND "
		}
		out += k.dialect.QuoteIdent(col) + " = " + k.dialect.Placeholder(offset+i)
	}
	return out
}

// ReadBlobStream retrieves bounded slices of the same value that unary reads use.
func (k *SqlKV) ReadBlobStream(ctx context.Context, key BlobKey, open func(string) (io.Writer, error)) error {
	q := k.dialect.QuoteIdent
	base := fmt.Sprintf(" FROM %s WHERE %s", q(resourceBlobTable), k.blobWhere(blobIdentityColumns))
	var contentType string
	var size int64
	if err := k.db.QueryRowContext(ctx, "SELECT "+q("content_type")+", LENGTH("+q("value")+")"+base, blobIdentityArgs(key)...).Scan(&contentType, &size); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	w, err := open(contentType)
	if err != nil {
		return err
	}
	for offset := int64(0); offset < size; {
		if err := ctx.Err(); err != nil {
			return err
		}
		n := min(size-offset, int64(64<<10))
		var slice string
		switch k.dialect.Name() {
		case "postgres":
			slice = fmt.Sprintf("substring(%s from %d for %d)", q("value"), offset+1, n)
		default:
			slice = fmt.Sprintf("SUBSTR(%s, %d, %d)", q("value"), offset+1, n)
		}
		var part []byte
		if err := k.db.QueryRowContext(ctx, "SELECT "+slice+base, blobIdentityArgs(key)...).Scan(&part); err != nil {
			return err
		}
		if int64(len(part)) != n {
			return fmt.Errorf("incomplete blob read")
		}
		written, err := w.Write(part)
		if err != nil {
			return err
		}
		if written != len(part) {
			return io.ErrShortWrite
		}
		offset += n
	}
	return nil
}
