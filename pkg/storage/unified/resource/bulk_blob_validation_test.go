package resource

import (
	"context"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBulkProcessRejectsUnsafeBlobInput(t *testing.T) {
	cases := []struct {
		name string
		req  func() *resourcepb.BulkRequest
		code int32
	}{
		{"inline data", bulkBlobBody(`{"blobs":{"dashboard":{"contentType":"application/json","data":"e30="}}}`), http.StatusBadRequest},
		{"empty data", bulkBlobBody(`{"blobs":{"dashboard":{"data":""}}}`), http.StatusBadRequest},
		{"null data", bulkBlobBody(`{"blobs":{"dashboard":{"data":null}}}`), http.StatusBadRequest},
		{"ambiguous data and uid", bulkBlobBody(`{"blobs":{"dashboard":{"uid":"blob","data":"e30="}}}`), http.StatusBadRequest},
		{"hidden inline entry", bulkBlobBody(`{"blobs":{"dashboard":{"data":"e30="},"dashboard":{"uid":"blob"}}}`), http.StatusBadRequest},
		{"hidden inline blobs", bulkBlobBody(`{"blobs":{"dashboard":{"data":"e30="}},"blobs":{"dashboard":{"uid":"blob"}}}`), http.StatusBadRequest},
		{"malformed body", bulkBlobBody(`{"blobs":`), http.StatusBadRequest},
		{"non-object body", bulkBlobBody(`[]`), http.StatusBadRequest},
		{"trailing body", bulkBlobBody(`{} {}`), http.StatusBadRequest},
		{"non-object blobs", bulkBlobBody(`{"blobs":[]}`), http.StatusBadRequest},
		{"non-object entry", bulkBlobBody(`{"blobs":{"dashboard":"e30="}}`), http.StatusBadRequest},
		{"declarations", func() *resourcepb.BulkRequest {
			req := newTestBulkRequest("item")
			req.BlobUploads = []*resourcepb.BulkBlobUpload{{Name: "dashboard", ContentType: "application/json", Size: 2}}
			return req
		}, http.StatusNotImplemented},
		{"chunk without key", func() *resourcepb.BulkRequest {
			return bulkTestChunk("dashboard", []byte("{}"), false)
		}, http.StatusNotImplemented},
		{"EOF without key", func() *resourcepb.BulkRequest {
			return bulkTestChunk("dashboard", nil, true)
		}, http.StatusNotImplemented},
		{"invalid chunk", func() *resourcepb.BulkRequest {
			return bulkTestChunk("dashboard", nil, false)
		}, http.StatusBadRequest},
		{"delete with declarations", func() *resourcepb.BulkRequest {
			req := newTestBulkRequest("item")
			req.Action = resourcepb.BulkRequest_DELETED
			req.BlobUploads = []*resourcepb.BulkBlobUpload{{Name: "dashboard", ContentType: "application/json", Size: 2}}
			return req
		}, http.StatusBadRequest},
		{"delete with inline body", func() *resourcepb.BulkRequest {
			req := bulkBlobBody(`{"blobs":{"dashboard":{"data":"e30="}}}`)()
			req.Action = resourcepb.BulkRequest_DELETED
			return req
		}, http.StatusBadRequest},
		{"missing key", func() *resourcepb.BulkRequest {
			req := newTestBulkRequest("item")
			req.Key = nil
			return req
		}, http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, skip := range []bool{false, true} {
				backend, stream, err := runBulkBlobValidationTest(t, tc.req(), skip)
				require.Empty(t, backend.forwarded)
				require.True(t, backend.rollback)
				require.Nil(t, stream.response, "a failure must not also be sent as a response")
				require.Error(t, err)
				require.Equal(t, tc.code, AsErrorResult(err).Code)
				require.Empty(t, stream.headers.Get(resourcepb.InlineBlobMetadataKey))
			}
		})
	}
}

func TestBulkProcessPreservesReferenceOnlyInput(t *testing.T) {
	cases := []struct {
		name string
		req  func() *resourcepb.BulkRequest
	}{
		{"absent blobs", func() *resourcepb.BulkRequest { return newTestBulkRequest("item") }},
		{"empty blobs", bulkBlobBody(`{"blobs":{}}`)},
		{"null blobs", bulkBlobBody(`{"blobs":null}`)},
		{"reference extension fields", bulkBlobBody(`{"blobs":{"dashboard":{"uid":"blob","custom":{"data":"not inline"}}},"unknown":[1,2]}`)},
		{"multiple references", bulkBlobBody(`{"blobs":{"dashboard":{"uid":"a"},"image":{"uid":"b","size":12}}}`)},
		{"resource-specific data untouched", bulkBlobBody(`{"spec":{"dashboard":{"data":"not a generic blob"}}}`)},
		{"delete without body", func() *resourcepb.BulkRequest {
			req := newTestBulkRequest("item")
			req.Action = resourcepb.BulkRequest_DELETED
			req.Value = nil
			return req
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, skip := range []bool{false, true} {
				req := tc.req()
				original := append([]byte(nil), req.Value...)
				backend, stream, err := runBulkBlobValidationTest(t, req, skip)
				require.NoError(t, err)
				require.False(t, backend.rollback)
				require.Equal(t, skip, backend.settings.SkipValidation)
				require.Len(t, backend.forwarded, 1)
				require.Same(t, req, backend.forwarded[0])
				require.Equal(t, original, req.Value)
				require.Nil(t, stream.response.Error)
				require.EqualValues(t, 1, stream.response.Processed)
			}
		})
	}
}

func TestBulkProcessNegotiatedBlobUploads(t *testing.T) {
	for _, skip := range []bool{false, true} {
		t.Run(map[bool]string{false: "validate", true: "skip validation"}[skip], func(t *testing.T) {
			backend := &bulkBlobValidationBackend{}
			blob := bulkBlobEndpointSupport{StreamingBlobSupport: bulkBlobUploadFunc{put: func(_ context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
				require.Equal(t, "application/json", req.ContentType)
				return completedBulkBlobUpload(reader)
			}}}
			srv := &server{backend: backend, blob: blob, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
			req := newBulkBlobNormalizationRequest()
			settings := BulkSettings{Collection: []*resourcepb.ResourceKey{req.Key}, SkipValidation: skip}
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			ctx = metadata.NewIncomingContext(ctx, metadata.Join(settings.ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1")))
			stream := &negotiatedBulkBlobStream{bulkBlobValidationStream: bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: []*resourcepb.BulkRequest{
				req, bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true), newTestBulkRequest("next"),
			}}}}
			require.NoError(t, srv.BulkProcess(stream))
			require.True(t, stream.headerBeforeRecv)
			require.NoError(t, resourcepb.ValidateInlineBlobAcknowledgement(stream.headers))
			require.Nil(t, stream.response.Error)
			require.EqualValues(t, 2, stream.response.Processed)
			require.Len(t, backend.forwarded, 2)
			require.NotSame(t, req, backend.forwarded[0])
			require.Empty(t, backend.forwarded[0].BlobUploads)
			body, err := resourcepb.DecodeBlobObject(backend.forwarded[0].Value)
			require.NoError(t, err)
			blobs, err := resourcepb.DecodeBlobEntries(body["blobs"])
			require.NoError(t, err)
			require.Equal(t, "uploaded", blobs["dashboard"].UID)
			require.True(t, proto.Equal(stream.requests[3], backend.forwarded[1]))
		})
	}
}

func TestBulkProcessBlobValidationBeforeUpload(t *testing.T) {
	for _, tc := range []struct {
		name string
		edit func(*resourcepb.BulkRequest)
	}{
		{"mismatched identity", func(req *resourcepb.BulkRequest) { req.Key.Name = "other" }},
		{"inline body data", func(req *resourcepb.BulkRequest) { req.Value = []byte(`{"blobs":{"dashboard":{"data":"e30="}}}`) }},
		{"reference collision", func(req *resourcepb.BulkRequest) { req.Value = []byte(`{"blobs":{"dashboard":{"uid":"old"}}}`) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &bulkBlobValidationBackend{}
			uploads := 0
			blob := bulkBlobEndpointSupport{StreamingBlobSupport: bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
				uploads++
				return completedBulkBlobUpload(reader)
			}}}
			srv := &server{backend: backend, blob: blob, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
			req := newBulkBlobNormalizationRequest()
			collection := &resourcepb.ResourceKey{
				Namespace: req.Key.Namespace,
				Group:     req.Key.Group,
				Resource:  req.Key.Resource,
			}
			tc.edit(req)
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			md := metadata.Join((&BulkSettings{Collection: []*resourcepb.ResourceKey{collection}, SkipValidation: true}).ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1"))
			ctx = metadata.NewIncomingContext(ctx, md)
			stream := &negotiatedBulkBlobStream{bulkBlobValidationStream: bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: []*resourcepb.BulkRequest{req}}}}
			err := srv.BulkProcess(stream)
			require.Zero(t, uploads)
			require.Empty(t, backend.forwarded)
			require.False(t, backend.called)
			require.False(t, backend.rollback)
			require.Nil(t, stream.response)
			require.Error(t, err)
			require.EqualValues(t, http.StatusBadRequest, AsErrorResult(err).Code)
		})
	}
}

func TestBulkProcessRemoteBlobHandshake(t *testing.T) {
	backend := &bulkBlobValidationBackend{}
	blob := bulkBlobEndpointSupport{StreamingBlobSupport: bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
		return completedBulkBlobUpload(reader)
	}}}
	srv := &server{backend: backend, blob: blob, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
	listener := bufconn.Listen(1 << 20)
	grpcServer := grpc.NewServer(grpc.StreamInterceptor(func(_ any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, next grpc.StreamHandler) error {
		ctx := authlib.WithAuthInfo(stream.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
		return next(srv, contextStream{ServerStream: stream, ctx: ctx})
	}))
	resourcepb.RegisterBulkStoreServer(grpcServer, srv)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(func() { grpcServer.Stop(); _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///bulk-blobs", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	req := newBulkBlobNormalizationRequest()
	md := metadata.Join((&BulkSettings{Collection: []*resourcepb.ResourceKey{req.Key}}).ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1"))
	ctx, cancel := context.WithTimeout(metadata.NewOutgoingContext(t.Context(), md), 10*time.Second)
	defer cancel()
	stream, err := resourcepb.NewBulkStoreClient(conn).BulkProcess(ctx)
	require.NoError(t, err)
	header, err := stream.Header()
	require.NoError(t, err)
	require.NoError(t, resourcepb.ValidateInlineBlobAcknowledgement(header))
	require.NoError(t, stream.Send(req))
	require.NoError(t, stream.Send(bulkTestChunk("dashboard", []byte("abc"), false)))
	require.NoError(t, stream.Send(bulkTestChunk("dashboard", nil, true)))
	rsp, err := stream.CloseAndRecv()
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.EqualValues(t, 1, rsp.Processed)
	require.Len(t, backend.forwarded, 1)
	require.Empty(t, backend.forwarded[0].BlobUploads)
}

func TestBulkProcessNegotiatedInputUsesBoundedDiskSpool(t *testing.T) {
	requestBytes := len(newTestBulkRequest("item-1").Value)
	for _, tc := range []struct {
		name string
		opts BulkBatchOptions
	}{
		{name: "max items", opts: testBulkBatchOptions(2, 1<<20, 0)},
		{name: "max bytes", opts: testBulkBatchOptions(100, requestBytes+1, 0)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &bulkBlobValidationBackend{}
			blob := bulkBlobEndpointSupport{StreamingBlobSupport: bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
				return completedBulkBlobUpload(reader)
			}}}
			srv := &server{backend: backend, blob: blob, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: tc.opts}
			reqs := []*resourcepb.BulkRequest{
				newTestBulkRequest("item-1"),
				newTestBulkRequest("item-2"),
				newTestBulkRequest("item-3"),
				newTestBulkRequest("item-4"),
				newTestBulkRequest("item-5"),
			}
			settings := BulkSettings{Collection: []*resourcepb.ResourceKey{reqs[0].Key}}
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			ctx = metadata.NewIncomingContext(ctx, metadata.Join(settings.ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1")))
			stream := &negotiatedBulkBlobStream{bulkBlobValidationStream: bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: reqs}}}

			require.NoError(t, srv.BulkProcess(stream))
			require.Nil(t, stream.response.Error)
			require.True(t, backend.diskBacked)
			require.Equal(t, []int{2, 2, 1}, backend.batchSizes)
			require.Len(t, backend.forwarded, len(reqs))
		})
	}
}

func TestBulkProcessReturnsDiskSpoolReplayErrors(t *testing.T) {
	for _, tc := range []struct {
		name       string
		corruption []byte
		message    string
	}{
		{name: "truncated record", corruption: []byte{3}, message: "truncated"},
		{name: "invalid record", corruption: []byte{1, 0xff}, message: "unmarshal"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &corruptBulkSpoolBackend{corruption: tc.corruption}
			blob := bulkBlobEndpointSupport{StreamingBlobSupport: bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
				return completedBulkBlobUpload(reader)
			}}}
			srv := &server{backend: backend, blob: blob, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
			req := newTestBulkRequest("item")
			settings := BulkSettings{Collection: []*resourcepb.ResourceKey{req.Key}}
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			ctx = metadata.NewIncomingContext(ctx, metadata.Join(settings.ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1")))
			stream := &negotiatedBulkBlobStream{bulkBlobValidationStream: bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: []*resourcepb.BulkRequest{req}}}}

			err := srv.BulkProcess(stream)
			require.NoError(t, backend.err)
			require.True(t, backend.rollback)
			require.Nil(t, stream.response)
			require.Contains(t, rpcErrorResult(t, err).Message, tc.message)
		})
	}
}

func TestBulkProcessBlobUploadFailureDoesNotPublish(t *testing.T) {
	for _, tc := range []struct {
		name   string
		put    func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error)
		frames []*resourcepb.BulkRequest
	}{
		{"transport error", func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
			return nil, status.Error(codes.Unavailable, "upload unavailable")
		}, []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true)}},
		{"response error", func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
			_, err := io.Copy(io.Discard, reader)
			if err != nil {
				return nil, err
			}
			return &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "upload rejected"}}, nil
		}, []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true)}},
		{"invalid chunk", func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
			return completedBulkBlobUpload(reader)
		}, []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abcd"), false)}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &bulkBlobValidationBackend{}
			blob := bulkBlobEndpointSupport{StreamingBlobSupport: bulkBlobUploadFunc{put: tc.put}}
			srv := &server{backend: backend, blob: blob, blobTransfers: newBlobTransfers(), access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
			req := newBulkBlobNormalizationRequest()
			md := metadata.Join((&BulkSettings{Collection: []*resourcepb.ResourceKey{req.Key}, SkipValidation: true}).ToMD(), metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1"))
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			ctx = metadata.NewIncomingContext(ctx, md)
			stream := &negotiatedBulkBlobStream{bulkBlobValidationStream: bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: append([]*resourcepb.BulkRequest{req}, tc.frames...)}}}
			err := srv.BulkProcess(stream)
			require.NoError(t, resourcepb.ValidateInlineBlobAcknowledgement(stream.headers))
			require.Empty(t, backend.forwarded)
			require.False(t, backend.called)
			require.False(t, backend.rollback)
			require.Nil(t, stream.response)
			require.Error(t, err)
		})
	}
}

func TestBulkProcessBlobHandshakeFailsClosed(t *testing.T) {
	for _, tc := range []struct {
		name    string
		version []string
		blob    BlobSupport
		code    int32
	}{
		{"unsupported version", []string{"2"}, bulkBlobEndpointSupport{}, http.StatusPreconditionFailed},
		{"duplicate version", []string{"1", "1"}, bulkBlobEndpointSupport{}, http.StatusPreconditionFailed},
		{"no streaming backend", []string{"1"}, nil, http.StatusNotImplemented},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &bulkBlobValidationBackend{}
			srv := &server{backend: backend, blob: tc.blob, access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
			req := newBulkBlobNormalizationRequest()
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin})
			md := BulkSettings{Collection: []*resourcepb.ResourceKey{req.Key}}
			header := md.ToMD()
			header[resourcepb.InlineBlobMetadataKey] = tc.version
			ctx = metadata.NewIncomingContext(ctx, header)
			stream := &negotiatedBulkBlobStream{bulkBlobValidationStream: bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: []*resourcepb.BulkRequest{req}}}}
			err := srv.BulkProcess(stream)
			require.Empty(t, stream.headers.Get(resourcepb.InlineBlobMetadataKey))
			require.Zero(t, stream.idx)
			require.Nil(t, stream.response)
			require.Equal(t, tc.code, rpcErrorResult(t, err).Code)
			require.Empty(t, backend.forwarded)
		})
	}
}

type bulkBlobEndpointSupport struct {
	BlobSupport
	StreamingBlobSupport
}

type negotiatedBulkBlobStream struct {
	bulkBlobValidationStream
	headerBeforeRecv bool
}

func (s *negotiatedBulkBlobStream) Recv() (*resourcepb.BulkRequest, error) {
	if !s.headerBeforeRecv {
		return nil, status.Error(codes.FailedPrecondition, "received before acknowledgement")
	}
	return s.testBulkProcessServer.Recv()
}

func (s *negotiatedBulkBlobStream) SendHeader(md metadata.MD) error {
	s.headerBeforeRecv = true
	return s.bulkBlobValidationStream.SendHeader(md)
}

func bulkBlobBody(body string) func() *resourcepb.BulkRequest {
	return func() *resourcepb.BulkRequest {
		req := newTestBulkRequest("item")
		req.Value = []byte(body)
		return req
	}
}

func runBulkBlobValidationTest(t *testing.T, req *resourcepb.BulkRequest, skip bool) (*bulkBlobValidationBackend, *bulkBlobValidationStream, error) {
	t.Helper()
	backend := &bulkBlobValidationBackend{}
	srv := &server{backend: backend, access: authlib.FixedAccessClient(true), bulkBatchOptions: DefaultBulkBatchOptions()}
	settings := BulkSettings{
		Collection:     []*resourcepb.ResourceKey{newTestBulkRequest("item").Key},
		SkipValidation: skip,
	}
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{
		Type: authlib.TypeUser, UserUID: "u1", OrgRole: identity.RoleAdmin,
	})
	ctx = metadata.NewIncomingContext(ctx, settings.ToMD())
	stream := &bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: ctx, requests: []*resourcepb.BulkRequest{req}}}
	err := srv.BulkProcess(stream)
	return backend, stream, err
}

type bulkBlobValidationBackend struct {
	UnimplementedStorageBackend
	settings   BulkSettings
	forwarded  []*resourcepb.BulkRequest
	batchSizes []int
	called     bool
	rollback   bool
	diskBacked bool
}

func (b *bulkBlobValidationBackend) ProcessBulk(ctx context.Context, settings BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse {
	b.called = true
	b.settings = settings
	_, b.diskBacked = iter.(*spooledBulkRequests)
	if batchIter, ok := iter.(BulkRequestBatchIterator); ok {
		for batchIter.NextBatch(ctx) {
			if batchIter.RollbackRequested() {
				b.rollback = true
				break
			}
			batch := batchIter.Batch()
			b.batchSizes = append(b.batchSizes, len(batch))
			b.forwarded = append(b.forwarded, batch...)
		}
	} else {
		for iter.Next() {
			if iter.RollbackRequested() {
				b.rollback = true
				break
			}
			b.forwarded = append(b.forwarded, iter.Request())
		}
	}
	return &resourcepb.BulkResponse{Processed: int64(len(b.forwarded))}
}

type corruptBulkSpoolBackend struct {
	UnimplementedStorageBackend
	corruption []byte
	rollback   bool
	err        error
}

func (b *corruptBulkSpoolBackend) ProcessBulk(ctx context.Context, _ BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse {
	spool := iter.(*spooledBulkRequests)
	if b.err = spool.file.Truncate(0); b.err != nil {
		return &resourcepb.BulkResponse{}
	}
	if _, b.err = spool.file.Seek(0, io.SeekStart); b.err != nil {
		return &resourcepb.BulkResponse{}
	}
	if _, b.err = spool.file.Write(b.corruption); b.err != nil {
		return &resourcepb.BulkResponse{}
	}
	if _, b.err = spool.file.Seek(0, io.SeekStart); b.err != nil {
		return &resourcepb.BulkResponse{}
	}
	spool.reader.Reset(spool.file)
	batchIter := iter.(BulkRequestBatchIterator)
	for batchIter.NextBatch(ctx) {
		if batchIter.RollbackRequested() {
			b.rollback = true
			break
		}
	}
	return &resourcepb.BulkResponse{}
}

type bulkBlobValidationStream struct {
	testBulkProcessServer
	response *resourcepb.BulkResponse
	headers  metadata.MD
}

func (s *bulkBlobValidationStream) SendAndClose(response *resourcepb.BulkResponse) error {
	s.response = response
	return nil
}

func (s *bulkBlobValidationStream) SetHeader(md metadata.MD) error {
	s.headers = metadata.Join(s.headers, md)
	return nil
}

func (s *bulkBlobValidationStream) SendHeader(md metadata.MD) error {
	return s.SetHeader(md)
}
