package resource

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKVBlobSupportGenericStreamRoundTrip(t *testing.T) {
	store := NewKVBlobSupport(setupBadgerKV(t)).(*kvBlobSupport)
	body := bytes.Repeat([]byte("snapshot"), (256<<10)/8)
	rsp, err := store.PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{
		Resource: testBlobResourceKey, ContentType: "application/json; charset=utf-8",
	}, bytes.NewReader(body))
	require.NoError(t, err)
	require.EqualValues(t, len(body), rsp.Size)
	digest := md5.Sum(body) // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5
	require.Equal(t, hex.EncodeToString(digest[:]), rsp.Hash)
	var got bytes.Buffer
	err = store.GetResourceBlobStream(t.Context(), testBlobResourceKey, &utils.BlobInfo{UID: rsp.Uid}, func(contentType string) (io.Writer, error) {
		require.Equal(t, "application/json; charset=utf-8", contentType)
		return &got, nil
	})
	require.NoError(t, err)
	require.Equal(t, body, got.Bytes())
	// The new adapter must read values from the existing unary format too.
	uid := writeTestBlob(t, store, "text/plain", "legacy")
	got.Reset()
	require.NoError(t, store.GetResourceBlobStream(t.Context(), testBlobResourceKey, &utils.BlobInfo{UID: uid}, func(contentType string) (io.Writer, error) {
		require.Equal(t, "text/plain", contentType)
		return &got, nil
	}))
	require.Equal(t, "legacy", got.String())
}

type failedBlobSource struct{ err error }

func (r failedBlobSource) Read([]byte) (int, error) { return 0, r.err }

func TestKVBlobSupportGenericStreamAbortsSourceFailure(t *testing.T) {
	backend := setupBadgerKV(t)
	store := NewKVBlobSupport(backend).(*kvBlobSupport)
	failure := errors.New("source failed")
	for _, source := range []io.Reader{
		io.MultiReader(strings.NewReader("partial"), failedBlobSource{failure}),
		strings.NewReader(""),
	} {
		_, err := store.PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{Resource: testBlobResourceKey}, source)
		require.Error(t, err)
		for key, err := range backend.Keys(t.Context(), kv.BlobDataSection, kv.ListOptions{}) {
			require.NoError(t, err)
			t.Fatalf("failed upload published %q", key)
		}
	}
}

func TestKVBlobSupportGenericStreamRejectsMalformedHeaders(t *testing.T) {
	backend := setupBadgerKV(t)
	store := NewKVBlobSupport(backend).(*kvBlobSupport)
	for _, value := range [][]byte{
		{2, 0},
		{1, 0x80},
		kv.EncodeBlobValueHeader(strings.Repeat("x", maxKVBlobContentTypeBytes+1)),
		{1, 3, 'x'},
	} {
		w, err := backend.Save(t.Context(), kv.BlobDataSection, kvBlobKey(testBlobResourceKey, "malformed").String())
		require.NoError(t, err)
		_, err = w.Write(value)
		require.NoError(t, err)
		require.NoError(t, w.Close())
		err = store.GetResourceBlobStream(t.Context(), testBlobResourceKey, &utils.BlobInfo{UID: "malformed"}, func(string) (io.Writer, error) {
			t.Fatal("opened destination for malformed header")
			return nil, nil
		})
		require.Error(t, err)
	}
	require.Equal(t, codes.InvalidArgument, status.Code(store.GetResourceBlobStream(t.Context(), testBlobResourceKey, nil, nil)))
	require.Equal(t, codes.NotFound, status.Code(store.GetResourceBlobStream(t.Context(), testBlobResourceKey, &utils.BlobInfo{UID: "missing"}, nil)))
}

type boundedBlobKV struct {
	kv.KV
	t      *testing.T
	bytes  int64
	closed bool
	ctx    context.Context
}

func (s *boundedBlobKV) Save(ctx context.Context, _, _ string) (io.WriteCloser, error) {
	s.ctx = ctx
	return s, nil
}

func (s *boundedBlobKV) Write(p []byte) (int, error) {
	require.LessOrEqual(s.t, len(p), blobStreamChunkSize)
	s.bytes += int64(len(p))
	return len(p), nil
}

func (s *boundedBlobKV) Close() error {
	s.closed = true
	return s.ctx.Err()
}

type repeatedBlobSource struct{}

func (repeatedBlobSource) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}

func TestKVBlobSupportGenericStreamBoundsWritesAndSize(t *testing.T) {
	for _, size := range []int64{blobStreamMaxSize, blobStreamMaxSize + 1} {
		backend := &boundedBlobKV{t: t}
		store := NewKVBlobSupport(backend).(*kvBlobSupport)
		rsp, err := store.PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{Resource: testBlobResourceKey}, io.LimitReader(repeatedBlobSource{}, size))
		require.True(t, backend.closed)
		if size == blobStreamMaxSize {
			require.NoError(t, err)
			require.Equal(t, size, rsp.Size)
		} else {
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.ErrorIs(t, backend.ctx.Err(), context.Canceled)
		}
	}
	backend := &boundedBlobKV{t: t}
	_, err := NewKVBlobSupport(backend).(*kvBlobSupport).PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{
		Resource: testBlobResourceKey, ContentType: strings.Repeat("x", maxKVBlobContentTypeBytes+1),
	}, strings.NewReader("payload"))
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	require.False(t, backend.closed)
}
