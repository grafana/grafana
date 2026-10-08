package test

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationBlobStreamingUsesExistingSQLTable(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	// Include zero bytes to catch SQL dialects that coerce BLOB concatenation
	// to text. The value crosses the default remote unary request limit.
	value := bytes.Repeat([]byte{0, 0xff, 'x', 'y'}, (5<<20)/4)
	for _, writer := range env.stores() {
		for _, reader := range env.stores() {
			t.Run(writer.name+" to "+reader.name, func(t *testing.T) {
				key := env.newResource(t, "default")
				put, err := writer.store.(resource.StreamingBlobSupport).PutResourceBlobStream(env.ctx, &resourcepb.PutBlobRequest{
					Resource: key, ContentType: "application/octet-stream",
				}, bytes.NewReader(value))
				require.NoError(t, err)
				require.Equal(t, int64(len(value)), put.Size)
				require.NotEmpty(t, put.Uid)
				require.Equal(t, "application/octet-stream", put.MimeType)
				hash := md5.Sum(value)
				require.Equal(t, hex.EncodeToString(hash[:]), put.Hash)
				defer func() {
					require.NoError(t, env.kv.Delete(env.ctx, kv.BlobDataSection, blobKeyWithUID(key, put.Uid).String()))
				}()

				// Existing unary clients must still be able to read streamed blobs.
				unary := env.get(t, reader.store, key, put.Uid)
				require.Nil(t, unary.Error)
				require.Equal(t, value, unary.Value)

				var streamed bytes.Buffer
				err = reader.store.(resource.StreamingBlobSupport).GetResourceBlobStream(env.ctx, key, &utils.BlobInfo{UID: put.Uid}, func(contentType string) (io.Writer, error) {
					require.Equal(t, "application/octet-stream", contentType)
					return &streamed, nil
				})
				require.NoError(t, err)
				require.Equal(t, value, streamed.Bytes())
				require.Empty(t, stagedBlobChunks(t, env))
			})
		}
	}
}

func TestIntegrationBlobStreamingRollsBackOnError(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	key := env.newResource(t, "default")
	failure := errors.New("interrupted")
	for _, writer := range env.stores() {
		t.Run(writer.name, func(t *testing.T) {
			before := env.keys(t, resourcePrefix(key))
			_, err := writer.store.(resource.StreamingBlobSupport).PutResourceBlobStream(env.ctx, &resourcepb.PutBlobRequest{Resource: key}, &failingBlobReader{err: failure})
			require.ErrorIs(t, err, failure)
			require.Equal(t, before, env.keys(t, resourcePrefix(key)))
			require.Empty(t, stagedBlobChunks(t, env))
		})
	}
}

func TestIntegrationBlobStreamingMissingBlob(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	key := env.newResource(t, "default")
	for _, reader := range env.stores() {
		t.Run(reader.name, func(t *testing.T) {
			err := reader.store.(resource.StreamingBlobSupport).GetResourceBlobStream(env.ctx, key, &utils.BlobInfo{UID: newBlobKey(key).UID}, func(string) (io.Writer, error) {
				t.Fatal("opened missing blob")
				return nil, nil
			})
			require.Equal(t, codes.NotFound, status.Code(err), "unexpected error: %v", err)
		})
	}
}

func stagedBlobChunks(t *testing.T, env *kvBlobTestEnv) int {
	t.Helper()
	var count int
	require.NoError(t, env.db.QueryRowContext(env.ctx, "SELECT COUNT(*) FROM resource_blob_upload_chunk").Scan(&count))
	return count
}

func TestIntegrationBlobStreamingReclaimsAbandonedChunks(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	store := env.kv.(*kv.SqlKV)
	dialect, err := kv.DialectFromDriver(store.DriverName)
	require.NoError(t, err)
	query := fmt.Sprintf("INSERT INTO resource_blob_upload_chunk (upload_id, chunk_index, created, value) VALUES (%s, %s, %s, %s)",
		dialect.Placeholder(1), dialect.Placeholder(2), dialect.Placeholder(3), dialect.Placeholder(4))
	key := env.newResource(t, "default")
	for _, age := range []time.Duration{25 * time.Hour, time.Minute} {
		_, err := env.db.ExecContext(env.ctx, query, newBlobKey(key).UID, 0, time.Now().UTC().Add(-age), []byte("staged"))
		require.NoError(t, err)
	}
	_, err = env.kvBlobs.(resource.StreamingBlobSupport).PutResourceBlobStream(env.ctx, &resourcepb.PutBlobRequest{Resource: key}, strings.NewReader("complete"))
	require.NoError(t, err)
	require.Equal(t, 1, stagedBlobChunks(t, env))
}

func TestIntegrationBlobStreamingFailedPublicationCleansUp(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	key := newBlobKey(env.newResource(t, "default"))
	env.save(t, key, "text/plain", "existing")
	_, _, err := env.kv.(*kv.SqlKV).SaveBlobStream(env.ctx, key, "text/plain", strings.NewReader("replacement"))
	require.Error(t, err)
	require.Empty(t, stagedBlobChunks(t, env))
	_, body, err := env.read(t, key)
	require.NoError(t, err)
	require.Equal(t, "existing", body)
}

func TestIntegrationBlobStreamingCleanupAfterCancellation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	for _, writer := range env.stores() {
		t.Run(writer.name, func(t *testing.T) {
			key := env.newResource(t, "default")
			ctx, cancel := context.WithCancel(env.ctx)
			defer cancel()
			reader := &cancelingBlobReader{cancel: cancel}
			_, err := writer.store.(resource.StreamingBlobSupport).PutResourceBlobStream(ctx, &resourcepb.PutBlobRequest{Resource: key}, reader)
			require.ErrorIs(t, err, context.Canceled)
			require.Empty(t, stagedBlobChunks(t, env))
			require.Empty(t, env.keys(t, resourcePrefix(key)))
		})
	}
}

type cancelingBlobReader struct {
	cancel context.CancelFunc
	read   bool
}

func (r *cancelingBlobReader) Read(p []byte) (int, error) {
	if !r.read {
		r.read = true
		return copy(p, []byte("partial")), nil
	}
	r.cancel()
	return 0, context.Canceled
}

func TestIntegrationBlobStreamingDoesNotBlockWritesWhileReceiving(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	env := newKVBlobTestEnv(t)
	for _, partial := range []bool{false, true} {
		t.Run(fmt.Sprintf("partial=%v", partial), func(t *testing.T) {
			key := newBlobKey(env.newResource(t, "default"))
			reader := &pausedBlobReader{waiting: make(chan struct{}), resume: make(chan struct{})}
			resume := sync.OnceFunc(func() { close(reader.resume) })
			defer resume()
			if partial {
				reader.pending = []byte("partial")
			}
			result := make(chan error, 1)
			go func() {
				_, _, err := env.kv.(*kv.SqlKV).SaveBlobStream(env.ctx, key, "text/plain", reader)
				result <- err
			}()
			select {
			case <-reader.waiting:
			case err := <-result:
				t.Fatalf("upload ended before waiting for data: %v", err)
			case <-time.After(10 * time.Second):
				t.Fatal("upload did not reach the receive wait")
			}
			_, _, readErr := env.read(t, key)
			ctx, cancel := context.WithTimeout(env.ctx, 2*time.Second)
			response, writeErr := env.kvBlobs.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{
				Resource: env.newResource(t, "default"), Value: []byte("unrelated"),
			})
			cancel()
			resume()
			uploadErr := <-result
			require.ErrorIs(t, readErr, kv.ErrNotFound)
			require.NoError(t, writeErr)
			require.Nil(t, response.Error)
			if partial {
				require.NoError(t, uploadErr)
				_, body, err := env.read(t, key)
				require.NoError(t, err)
				require.Equal(t, "partial", body)
			} else {
				require.Error(t, uploadErr)
			}
			require.Empty(t, stagedBlobChunks(t, env))
		})
	}
}

type pausedBlobReader struct {
	pending []byte
	waiting chan struct{}
	resume  chan struct{}
}

func (r *pausedBlobReader) Read(p []byte) (int, error) {
	if len(r.pending) > 0 {
		n := copy(p, r.pending)
		r.pending = r.pending[n:]
		return n, nil
	}
	close(r.waiting)
	<-r.resume
	return 0, io.EOF
}

type failingBlobReader struct {
	err  error
	read bool
}

func (r *failingBlobReader) Read(p []byte) (int, error) {
	if r.read {
		return 0, r.err
	}
	r.read = true
	return copy(p, []byte("partial value")), nil
}
