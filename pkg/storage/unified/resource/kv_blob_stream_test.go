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
	"time"

	"github.com/fullstorydev/grpchan"
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// These SQLite migration transaction regressions belong in the normal suite, not
// the TestIntegration SQL database matrix.
func TestKVBlobStreamCallerTransaction(t *testing.T) {
	for _, commit := range []bool{false, true} {
		name := "rollback"
		if commit {
			name = "commit"
		}
		t.Run(name, func(t *testing.T) {
			backend, db := setupSqlKVWithDB(t)
			store := NewKVBlobSupport(backend).(*kvBlobSupport)
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			tx, err := db.BeginTx(ctx, nil)
			require.NoError(t, err)
			defer func() { _ = tx.Rollback() }()
			// Establish the caller's SQLite read snapshot before any upload writes.
			var count int
			require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM resource_blob").Scan(&count))
			body := bytes.Repeat([]byte("snapshot"), 16<<10)
			rsp, err := store.PutResourceBlobStream(ContextWithTransaction(ctx, tx), &resourcepb.PutBlobRequest{
				Resource: testBlobResourceKey, ContentType: "application/json",
			}, bytes.NewReader(body))
			require.NoError(t, err)
			require.NotEmpty(t, rsp.Uid)
			if commit {
				require.NoError(t, tx.Commit())
			} else {
				require.NoError(t, tx.Rollback())
			}
			var got bytes.Buffer
			err = store.GetResourceBlobStream(ctx, testBlobResourceKey, &utils.BlobInfo{UID: rsp.Uid}, func(string) (io.Writer, error) { return &got, nil })
			if commit {
				require.NoError(t, err)
				require.Equal(t, body, got.Bytes())
			} else {
				require.Equal(t, codes.NotFound, status.Code(err))
			}
		})
	}
}

func TestBulkBlobCallerTransactionInProcess(t *testing.T) {
	backend, db := setupSqlKVWithDB(t)
	blobs := NewKVBlobSupport(backend).(*kvBlobSupport)
	bulk := &bulkBlobValidationBackend{}
	srv := &server{backend: bulk, blob: blobs, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
	channel := &inprocgrpc.Channel{}
	channel.RegisterService(grpchan.InterceptServer(&resourcepb.BulkStore_ServiceDesc, nil,
		func(_ any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, next grpc.StreamHandler) error {
			ctx := authlib.WithAuthInfo(stream.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			return next(srv, contextStream{ServerStream: stream, ctx: ctx})
		}), srv)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()
	var count int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM resource_blob").Scan(&count))
	req := newBulkBlobNormalizationRequest()
	md := (&BulkSettings{Collection: []*resourcepb.ResourceKey{req.Key}}).ToMD()
	md.Set(resourcepb.InlineBlobMetadataKey, "1")
	ctx = metadata.NewOutgoingContext(ContextWithTransaction(ctx, tx), md)
	stream, err := resourcepb.NewBulkStoreClient(channel).BulkProcess(ctx)
	require.NoError(t, err)
	header, err := stream.Header()
	require.NoError(t, err)
	require.NoError(t, resourcepb.ValidateInlineBlobAcknowledgement(header))
	require.NoError(t, stream.Send(req))
	require.NoError(t, stream.Send(bulkTestChunk("dashboard", []byte("abc"), false)))
	require.NoError(t, stream.Send(bulkTestChunk("dashboard", nil, true)))
	rsp, err := stream.CloseAndRecv()
	require.NoError(t, err)
	require.NotNil(t, rsp)
	require.Len(t, bulk.forwarded, 1)
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM resource_blob").Scan(&count))
	require.Equal(t, 1, count)
	require.NoError(t, tx.Rollback())
	require.NoError(t, db.QueryRowContext(ctx, "SELECT COUNT(*) FROM resource_blob").Scan(&count))
	require.Zero(t, count)
}

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
