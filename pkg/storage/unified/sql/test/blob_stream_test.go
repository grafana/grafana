package test

import (
	"bytes"
	"errors"
	"io"
	"testing"

	"github.com/stretchr/testify/require"

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
		})
	}
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
