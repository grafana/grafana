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
	blobUploadChunkSize = 64 << 10
	blobUploadMaxSize   = 64 << 20
	blobUploadOrphanAge = 24 * time.Hour
)

// blobStreamQueries holds fixed SQL text so streamed values are only ever bound parameters.
type blobStreamQueries struct {
	deleteExpiredChunks string
	deleteUploadChunks  string
	insertChunk         string
	insertBlob          string
	// prepareAssembly runs on the publishing connection before assembleBlob; empty when not needed.
	prepareAssembly string
	// assembleBlob concatenates the staged chunks inside the database, so the
	// complete value never has to fit in a client packet and is written once.
	assembleBlob   string
	blobLength     string
	truncationHint string
}

var (
	mysqlBlobStreamQueries = blobStreamQueries{
		deleteExpiredChunks: "DELETE FROM `resource_blob_upload_chunk` WHERE `created` < ?",
		deleteUploadChunks:  "DELETE FROM `resource_blob_upload_chunk` WHERE `upload_id` = ?",
		insertChunk:         "INSERT INTO `resource_blob_upload_chunk` (`upload_id`, `chunk_index`, `created`, `value`) VALUES (?, ?, ?, ?)",
		insertBlob:          "INSERT INTO `resource_blob` (`uuid`, `created`, `group`, `resource`, `namespace`, `name`, `value`, `hash`, `content_type`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		// GROUP_CONCAT truncates at 1 KiB by default; this must cover blobUploadMaxSize.
		prepareAssembly: "SET SESSION group_concat_max_len = 67108864",
		assembleBlob:    "UPDATE `resource_blob` SET `value` = (SELECT GROUP_CONCAT(`value` ORDER BY `chunk_index` SEPARATOR '') FROM `resource_blob_upload_chunk` WHERE `upload_id` = ?) WHERE `uuid` = ? AND `namespace` = ? AND `group` = ? AND `resource` = ? AND `name` = ?",
		blobLength:      "SELECT LENGTH(`value`) FROM `resource_blob` WHERE `uuid` = ? AND `namespace` = ? AND `group` = ? AND `resource` = ? AND `name` = ?",
		truncationHint:  "the database's max_allowed_packet is likely smaller than the blob",
	}
	postgresBlobStreamQueries = blobStreamQueries{
		deleteExpiredChunks: `DELETE FROM "resource_blob_upload_chunk" WHERE "created" < $1`,
		deleteUploadChunks:  `DELETE FROM "resource_blob_upload_chunk" WHERE "upload_id" = $1`,
		insertChunk:         `INSERT INTO "resource_blob_upload_chunk" ("upload_id", "chunk_index", "created", "value") VALUES ($1, $2, $3, $4)`,
		insertBlob:          `INSERT INTO "resource_blob" ("uuid", "created", "group", "resource", "namespace", "name", "value", "hash", "content_type") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		assembleBlob:        `UPDATE "resource_blob" SET "value" = (SELECT string_agg("value", ''::bytea ORDER BY "chunk_index") FROM "resource_blob_upload_chunk" WHERE "upload_id" = $1) WHERE "uuid" = $2 AND "namespace" = $3 AND "group" = $4 AND "resource" = $5 AND "name" = $6`,
		blobLength:          `SELECT LENGTH("value") FROM "resource_blob" WHERE "uuid" = $1 AND "namespace" = $2 AND "group" = $3 AND "resource" = $4 AND "name" = $5`,
	}
	sqliteBlobStreamQueries = blobStreamQueries{
		deleteExpiredChunks: `DELETE FROM "resource_blob_upload_chunk" WHERE "created" < ?`,
		deleteUploadChunks:  `DELETE FROM "resource_blob_upload_chunk" WHERE "upload_id" = ?`,
		insertChunk:         `INSERT INTO "resource_blob_upload_chunk" ("upload_id", "chunk_index", "created", "value") VALUES (?, ?, ?, ?)`,
		insertBlob:          `INSERT INTO "resource_blob" ("uuid", "created", "group", "resource", "namespace", "name", "value", "hash", "content_type") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		// group_concat yields TEXT, which would corrupt binary values without the cast.
		assembleBlob: `UPDATE "resource_blob" SET "value" = (SELECT CAST(group_concat("value", '' ORDER BY "chunk_index") AS BLOB) FROM "resource_blob_upload_chunk" WHERE "upload_id" = ?) WHERE "uuid" = ? AND "namespace" = ? AND "group" = ? AND "resource" = ? AND "name" = ?`,
		blobLength:   `SELECT LENGTH("value") FROM "resource_blob" WHERE "uuid" = ? AND "namespace" = ? AND "group" = ? AND "resource" = ? AND "name" = ?`,
	}
)

func blobStreamQueriesFor(dialect Dialect) (blobStreamQueries, error) {
	switch dialect.Name() {
	case "mysql":
		return mysqlBlobStreamQueries, nil
	case "postgres":
		return postgresBlobStreamQueries, nil
	case "sqlite":
		return sqliteBlobStreamQueries, nil
	default:
		return blobStreamQueries{}, fmt.Errorf("blob streaming is not supported for dialect %q", dialect.Name())
	}
}

// SaveBlobStream commits each staging chunk before receiving more data. Only
// publishing the complete legacy blob needs a write transaction, so old servers
// can still read the result without knowing about the staging table.
func (k *SqlKV) SaveBlobStream(ctx context.Context, key BlobKey, contentType string, value io.Reader) (size int64, digest string, err error) {
	queries, err := blobStreamQueriesFor(k.dialect)
	if err != nil {
		return 0, "", err
	}
	now := time.Now().UTC()
	// Upload RPCs expire after two minutes; this also reclaims chunks left by a crashed process.
	if _, err := k.db.ExecContext(ctx, queries.deleteExpiredChunks, now.Add(-blobUploadOrphanAge)); err != nil {
		return 0, "", err
	}
	uploadID := uuid.NewV4().String()
	published := false
	defer func() {
		if published {
			return
		}
		// Cancellation must not prevent cleanup of already committed staging chunks.
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if _, cleanupErr := k.db.ExecContext(cleanupCtx, queries.deleteUploadChunks, uploadID); cleanupErr != nil {
			err = errors.Join(err, fmt.Errorf("clean up blob upload: %w", cleanupErr))
		}
	}()
	buffer := make([]byte, blobUploadChunkSize)
	h := md5.New() // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	chunks := 0
	for {
		if err := ctx.Err(); err != nil {
			return 0, "", err
		}
		n, readErr := io.ReadFull(value, buffer)
		if n > 0 {
			if int64(n) > blobUploadMaxSize-size {
				return 0, "", fmt.Errorf("blob exceeds %d bytes", blobUploadMaxSize)
			}
			if _, err := k.db.ExecContext(ctx, queries.insertChunk, uploadID, chunks, now, buffer[:n]); err != nil {
				return 0, "", err
			}
			_, _ = h.Write(buffer[:n])
			size += int64(n)
			chunks++
		}
		if errors.Is(readErr, io.EOF) || errors.Is(readErr, io.ErrUnexpectedEOF) {
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
	tx, err := k.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, "", err
	}
	defer func() { _ = tx.Rollback() }()
	if queries.prepareAssembly != "" {
		if _, err := tx.ExecContext(ctx, queries.prepareAssembly); err != nil {
			return 0, "", err
		}
	}
	if _, err := tx.ExecContext(ctx, queries.insertBlob, key.UID, now, key.Group, key.Resource, key.Namespace, key.Name, []byte{}, digest, contentType); err != nil {
		return 0, "", err
	}
	if _, err := tx.ExecContext(ctx, queries.assembleBlob, append([]any{uploadID}, blobIdentityArgs(key)...)...); err != nil {
		return 0, "", err
	}
	// Aggregates can truncate silently, so the published length must match what was received.
	var stored int64
	if err := tx.QueryRowContext(ctx, queries.blobLength, blobIdentityArgs(key)...).Scan(&stored); err != nil {
		return 0, "", err
	}
	if stored != size {
		err := fmt.Errorf("incomplete staged blob: stored %d of %d bytes", stored, size)
		if queries.truncationHint != "" {
			err = fmt.Errorf("%w; %s", err, queries.truncationHint)
		}
		return 0, "", err
	}
	if _, err := tx.ExecContext(ctx, queries.deleteUploadChunks, uploadID); err != nil {
		return 0, "", err
	}
	if err := tx.Commit(); err != nil {
		return 0, "", err
	}
	published = true
	return size, digest, nil
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
		n := min(size-offset, int64(blobUploadChunkSize))
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
