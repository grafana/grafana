package kv

import (
	"bytes"
	"context"
	"database/sql/driver"
	"strconv"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

// sameUploadID matches the upload id bound by the first staged chunk, so the
// assembly is proven to read exactly the chunks this upload wrote.
type sameUploadID struct{ id *string }

func (m sameUploadID) Match(v driver.Value) bool {
	s, ok := v.(string)
	if !ok || s == "" {
		return false
	}
	if *m.id == "" {
		*m.id = s
	}
	return s == *m.id
}

func expectStagedUpload(mock sqlmock.Sqlmock, dialect string, uploadID sameUploadID, key BlobKey, body []byte, storedLength int) {
	mock.ExpectExec("DELETE FROM .*resource_blob_upload_chunk.* WHERE .*created").WithArgs(sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 0))
	for i, offset := 0, 0; offset < len(body); i, offset = i+1, offset+blobUploadChunkSize {
		mock.ExpectExec("INSERT INTO .*resource_blob_upload_chunk").
			WithArgs(uploadID, i, sqlmock.AnyArg(), body[offset:min(offset+blobUploadChunkSize, len(body))]).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}
	mock.ExpectBegin()
	if dialect == "mysql" {
		mock.ExpectExec("SET SESSION group_concat_max_len").WillReturnResult(sqlmock.NewResult(0, 0))
	}
	// The row starts empty and every statement binds at most one chunk, so no
	// request carries the complete value.
	mock.ExpectExec("INSERT INTO .*resource_blob.* VALUES").
		WithArgs(key.UID, sqlmock.AnyArg(), key.Group, key.Resource, key.Namespace, key.Name, []byte{}, sqlmock.AnyArg(), "application/octet-stream").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE .*resource_blob.* SET .*value.* = \\(SELECT").
		WithArgs(uploadID, key.UID, key.Namespace, key.Group, key.Resource, key.Name).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT LENGTH").
		WithArgs(key.UID, key.Namespace, key.Group, key.Resource, key.Name).
		WillReturnRows(sqlmock.NewRows([]string{"length"}).AddRow(storedLength))
}

func TestBlobPublicationAssemblesInDatabase(t *testing.T) {
	for _, dialect := range []string{"mysql", "postgres", "sqlite"} {
		t.Run(dialect, func(t *testing.T) {
			store, _, mock := setupSQLKVMock(t, dialect)
			key := BlobKey{UID: "uid", Group: "group", Resource: "resource", Namespace: "ns", Name: "name"}
			body := bytes.Repeat([]byte{0xff}, 2*blobUploadChunkSize+1)
			uploadID := sameUploadID{id: new(string)}
			expectStagedUpload(mock, dialect, uploadID, key, body, len(body))
			mock.ExpectExec("DELETE FROM .*resource_blob_upload_chunk.* WHERE .*upload_id").WithArgs(uploadID).WillReturnResult(sqlmock.NewResult(0, 3))
			mock.ExpectCommit()

			size, _, err := store.SaveBlobStream(context.Background(), key, "application/octet-stream", bytes.NewReader(body))
			require.NoError(t, err)
			require.Equal(t, int64(len(body)), size)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestBlobPublicationRejectsTruncatedAssembly(t *testing.T) {
	store, _, mock := setupSQLKVMock(t, "mysql")
	key := BlobKey{UID: "uid", Group: "group", Resource: "resource", Namespace: "ns", Name: "name"}
	body := bytes.Repeat([]byte{0xff}, blobUploadChunkSize+1)
	uploadID := sameUploadID{id: new(string)}
	expectStagedUpload(mock, "mysql", uploadID, key, body, blobUploadChunkSize)
	mock.ExpectRollback()
	mock.ExpectExec("DELETE FROM .*resource_blob_upload_chunk.* WHERE .*upload_id").WithArgs(uploadID).WillReturnResult(sqlmock.NewResult(0, 2))

	_, _, err := store.SaveBlobStream(context.Background(), key, "application/octet-stream", bytes.NewReader(body))
	require.ErrorContains(t, err, "incomplete staged blob: stored 65536 of 65537 bytes")
	require.ErrorContains(t, err, "max_allowed_packet")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestMySQLAssemblyCoversMaxBlobSize(t *testing.T) {
	require.Equal(t, "SET SESSION group_concat_max_len = "+strconv.Itoa(blobUploadMaxSize), mysqlBlobStreamQueries.prepareAssembly)
}

// The fixed statements are hand-written per dialect; this guards them against
// drifting from each dialect's quoting and placeholder rules.
func TestBlobStreamQueriesMatchDialect(t *testing.T) {
	for _, driver := range []string{"mysql", "postgres", "sqlite"} {
		t.Run(driver, func(t *testing.T) {
			d, err := DialectFromDriver(driver)
			require.NoError(t, err)
			queries, err := blobStreamQueriesFor(d)
			require.NoError(t, err)
			q, p := d.QuoteIdent, d.Placeholder
			chunkTable, blobTable := q("resource_blob_upload_chunk"), q(resourceBlobTable)
			identity := func(first int) string {
				conds := make([]string, len(blobIdentityColumns))
				for i, col := range blobIdentityColumns {
					conds[i] = q(col) + " = " + p(first+i)
				}
				return strings.Join(conds, " AND ")
			}
			aggregate := map[string]string{
				"mysql":    "GROUP_CONCAT(" + q("value") + " ORDER BY " + q("chunk_index") + " SEPARATOR '')",
				"postgres": "string_agg(" + q("value") + ", ''::bytea ORDER BY " + q("chunk_index") + ")",
				"sqlite":   "CAST(group_concat(" + q("value") + ", '' ORDER BY " + q("chunk_index") + ") AS BLOB)",
			}[d.Name()]

			require.Equal(t, "DELETE FROM "+chunkTable+" WHERE "+q("created")+" < "+p(1), queries.deleteExpiredChunks)
			require.Equal(t, "DELETE FROM "+chunkTable+" WHERE "+q("upload_id")+" = "+p(1), queries.deleteUploadChunks)
			require.Equal(t, "INSERT INTO "+chunkTable+" ("+quoteAll(q, "upload_id", "chunk_index", "created", "value")+") VALUES ("+placeholderList(p, 4)+")", queries.insertChunk)
			require.Equal(t, "INSERT INTO "+blobTable+" ("+quoteAll(q, "uuid", "created", "group", "resource", "namespace", "name", "value", "hash", "content_type")+") VALUES ("+placeholderList(p, 9)+")", queries.insertBlob)
			require.Equal(t, "UPDATE "+blobTable+" SET "+q("value")+" = (SELECT "+aggregate+" FROM "+chunkTable+" WHERE "+q("upload_id")+" = "+p(1)+") WHERE "+identity(2), queries.assembleBlob)
			require.Equal(t, "SELECT LENGTH("+q("value")+") FROM "+blobTable+" WHERE "+identity(1), queries.blobLength)
		})
	}
}

func quoteAll(quote func(string) string, cols ...string) string {
	out := make([]string, len(cols))
	for i, col := range cols {
		out[i] = quote(col)
	}
	return strings.Join(out, ", ")
}

func placeholderList(placeholder func(int) string, count int) string {
	out := make([]string, count)
	for i := range out {
		out[i] = placeholder(i + 1)
	}
	return strings.Join(out, ", ")
}
