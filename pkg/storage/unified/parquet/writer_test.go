package parquet

import (
	"bytes"
	"context"
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestParquetWriterProcessBulk(t *testing.T) {
	settings := resource.BulkSettings{Collection: []*resourcepb.ResourceKey{testBulkKey("")}}

	t.Run("writes all requests", func(t *testing.T) {
		file, err := os.CreateTemp(t.TempDir(), "bulk-*.parquet")
		require.NoError(t, err)
		writer, err := NewParquetWriter(file)
		require.NoError(t, err)

		rsp, err := writer.ProcessBulk(t.Context(), settings, &sliceBulkIterator{requests: []*resourcepb.BulkRequest{
			testBulkRequest("a", validBulkValue("a")),
			testBulkRequest("b", validBulkValue("b")),
		}})
		require.NoError(t, err)
		require.EqualValues(t, 2, rsp.Processed)

		reader, err := NewParquetReader(file.Name(), 10)
		require.NoError(t, err)
		count := 0
		for reader.Next() {
			count++
		}
		require.Equal(t, 2, count)
	})

	// A write failure stops the loop; closing the file afterwards must not
	// report the truncated output as a success.
	t.Run("returns write error", func(t *testing.T) {
		writer, err := NewParquetWriter(&bytes.Buffer{})
		require.NoError(t, err)

		rsp, err := writer.ProcessBulk(t.Context(), settings, &sliceBulkIterator{requests: []*resourcepb.BulkRequest{
			testBulkRequest("a", validBulkValue("a")),
			testBulkRequest("bad", []byte("{not json")),
			testBulkRequest("c", validBulkValue("c")),
		}})
		require.Error(t, err)
		require.Nil(t, rsp)
	})

	t.Run("returns flush and close error", func(t *testing.T) {
		out := &failAfterWriter{}
		writer, err := NewParquetWriter(out)
		require.NoError(t, err)
		out.fail = true

		rsp, err := writer.ProcessBulk(t.Context(), settings, &sliceBulkIterator{requests: []*resourcepb.BulkRequest{
			testBulkRequest("a", validBulkValue("a")),
		}})
		require.ErrorIs(t, err, errWriteFailed)
		require.Nil(t, rsp)
	})

	t.Run("returns close-only error after successful flush", func(t *testing.T) {
		closeErr := errors.New("close failed")
		out := &bulkErrorWriter{closeErr: closeErr}
		writer, err := NewParquetWriter(out)
		require.NoError(t, err)
		// Flush during Write so that closing has no buffered rows left.
		writer.buffer = 0

		rsp, err := writer.ProcessBulk(t.Context(), settings, &sliceBulkIterator{requests: []*resourcepb.BulkRequest{
			testBulkRequest("a", validBulkValue("a")),
		}})
		require.ErrorIs(t, err, closeErr)
		require.Nil(t, rsp)
	})

	t.Run("preserves distinct write and close errors", func(t *testing.T) {
		closeErr := errors.New("close failed")
		out := &bulkErrorWriter{closeErr: closeErr}
		writer, err := NewParquetWriter(out)
		require.NoError(t, err)

		rsp, err := writer.ProcessBulk(t.Context(), settings, &sliceBulkIterator{requests: []*resourcepb.BulkRequest{
			testBulkRequest("bad", []byte("{not json")),
		}})
		require.ErrorContains(t, err, "invalid character 'n'")
		require.ErrorIs(t, err, closeErr)
		require.Nil(t, rsp)
	})

	// The iterator reports the rollback cause itself; the writer only has to
	// prevent the caller from consuming a partial file.
	t.Run("returns error on rollback", func(t *testing.T) {
		writer, err := NewParquetWriter(&bytes.Buffer{})
		require.NoError(t, err)

		rsp, err := writer.ProcessBulk(t.Context(), settings, &sliceBulkIterator{
			requests:   []*resourcepb.BulkRequest{testBulkRequest("a", validBulkValue("a")), nil},
			rollbackAt: 1,
		})
		require.ErrorContains(t, err, "rollback requested")
		require.Nil(t, rsp)
	})
}

func TestParquetWriterProcessBulkReturnsCancellation(t *testing.T) {
	writer, err := NewParquetWriter(&bytes.Buffer{})
	require.NoError(t, err)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	// The iterator stops early on cancellation, as the stream-backed ones do.
	rsp, err := writer.ProcessBulk(ctx, resource.BulkSettings{}, &sliceBulkIterator{})
	require.ErrorIs(t, err, context.Canceled)
	require.Nil(t, rsp)
}

var errWriteFailed = errors.New("write failed")

type failAfterWriter struct {
	fail bool
}

func (w *failAfterWriter) Write(p []byte) (int, error) {
	if w.fail {
		return 0, errWriteFailed
	}
	return len(p), nil
}

type bulkErrorWriter struct {
	bytes.Buffer
	closeErr error
}

func (w *bulkErrorWriter) Close() error { return w.closeErr }

type sliceBulkIterator struct {
	requests   []*resourcepb.BulkRequest
	rollbackAt int
	idx        int
}

func (i *sliceBulkIterator) Next() bool {
	if i.idx >= len(i.requests) {
		return false
	}
	i.idx++
	return true
}

func (i *sliceBulkIterator) Request() *resourcepb.BulkRequest {
	return i.requests[i.idx-1]
}

func (i *sliceBulkIterator) RollbackRequested() bool {
	return i.rollbackAt > 0 && i.idx-1 == i.rollbackAt
}

func testBulkKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: "default", Group: "shorturl.grafana.app", Resource: "shorturls", Name: name}
}

func testBulkRequest(name string, value []byte) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{Key: testBulkKey(name), Action: resourcepb.BulkRequest_ADDED, Value: value}
}

func validBulkValue(name string) []byte {
	return []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"` + name + `","namespace":"default"},"spec":{"path":"d/test"}}`)
}
