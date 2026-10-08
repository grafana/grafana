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
	"uuid"
)

const (
	blobUploadChunkTable = "resource_blob_upload_chunk"
	blobUploadMaxSize    = 64 << 20
	blobUploadOrphanAge  = 24 * time.Hour
)

// SaveBlobStream commits each staging chunk before receiving more data. Only
// publishing the complete legacy blob needs a write transaction, so old servers
// can still read the result without knowing about the staging table.
func (k *SqlKV) SaveBlobStream(ctx context.Context, key BlobKey, contentType string, value io.Reader) (size int64, digest string, err error) {
	p, q := k.dialect.Placeholder, k.dialect.QuoteIdent
	now := time.Now().UTC()
	// Upload RPCs expire after two minutes; this also reclaims chunks left by a crashed process.
	if _, err := k.db.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s WHERE %s < %s", q(blobUploadChunkTable), q("created"), p(1)), now.Add(-blobUploadOrphanAge)); err != nil {
		return 0, "", err
	}
	uploadID := uuid.NewV4().String()
	deleteChunks := fmt.Sprintf("DELETE FROM %s WHERE %s = %s", q(blobUploadChunkTable), q("upload_id"), p(1))
	published := false
	defer func() {
		if published {
			return
		}
		// Cancellation must not prevent cleanup of already committed staging chunks.
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if _, cleanupErr := k.db.ExecContext(cleanupCtx, deleteChunks, uploadID); cleanupErr != nil {
			err = errors.Join(err, fmt.Errorf("clean up blob upload: %w", cleanupErr))
		}
	}()
	insertChunk := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", q(blobUploadChunkTable),
		joinQuoted(q, []string{"upload_id", "chunk_index", "created", "value"}), placeholders(p, 4))
	buffer := make([]byte, 64<<10)
	h := md5.New() // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	chunks := 0
	for {
		if err := ctx.Err(); err != nil {
			return 0, "", err
		}
		n, readErr := value.Read(buffer)
		if n > 0 {
			if int64(n) > blobUploadMaxSize-size {
				return 0, "", fmt.Errorf("blob exceeds %d bytes", blobUploadMaxSize)
			}
			if _, err := k.db.ExecContext(ctx, insertChunk, uploadID, chunks, now, buffer[:n]); err != nil {
				return 0, "", err
			}
			_, _ = h.Write(buffer[:n])
			size += int64(n)
			chunks++
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
	body, err := k.assembleBlobUpload(ctx, uploadID, size, chunks)
	if err != nil {
		return 0, "", err
	}
	digest = hex.EncodeToString(h.Sum(nil))
	tx, err := k.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, "", err
	}
	defer func() { _ = tx.Rollback() }()
	cols := []string{"uuid", "created", "group", "resource", "namespace", "name", "value", "hash", "content_type"}
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", q(resourceBlobTable), joinQuoted(q, cols), placeholders(p, len(cols)))
	if _, err := tx.ExecContext(ctx, query, key.UID, now, key.Group, key.Resource, key.Namespace, key.Name, body, digest, contentType); err != nil {
		return 0, "", err
	}
	if _, err := tx.ExecContext(ctx, deleteChunks, uploadID); err != nil {
		return 0, "", err
	}
	if err := tx.Commit(); err != nil {
		return 0, "", err
	}
	published = true
	return size, digest, nil
}

func (k *SqlKV) assembleBlobUpload(ctx context.Context, uploadID string, size int64, chunks int) ([]byte, error) {
	p, q := k.dialect.Placeholder, k.dialect.QuoteIdent
	query := fmt.Sprintf("SELECT %s, %s FROM %s WHERE %s = %s ORDER BY %s", q("chunk_index"), q("value"), q(blobUploadChunkTable), q("upload_id"), p(1), q("chunk_index"))
	rows, err := k.db.QueryContext(ctx, query, uploadID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	// One bounded allocation avoids growing-blob UPDATEs while retaining the old on-disk format.
	body := make([]byte, int(size))
	offset, count := 0, 0
	for rows.Next() {
		var index int
		var chunk []byte
		if err := rows.Scan(&index, &chunk); err != nil {
			return nil, err
		}
		if index != count || len(chunk) == 0 || len(chunk) > len(body)-offset {
			return nil, fmt.Errorf("invalid staged blob chunk")
		}
		offset += copy(body[offset:], chunk)
		count++
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if offset != len(body) || count != chunks {
		return nil, fmt.Errorf("incomplete staged blob")
	}
	return body, nil
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
