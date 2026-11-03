package resource

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

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
				backend, stream := runBulkBlobValidationTest(t, tc.req(), skip)
				require.Empty(t, backend.forwarded)
				require.True(t, backend.rollback)
				require.NotNil(t, stream.response)
				require.Zero(t, stream.response.Processed)
				require.NotNil(t, stream.response.Error)
				require.Equal(t, tc.code, stream.response.Error.Code)
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
				backend, stream := runBulkBlobValidationTest(t, req, skip)
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

func bulkBlobBody(body string) func() *resourcepb.BulkRequest {
	return func() *resourcepb.BulkRequest {
		req := newTestBulkRequest("item")
		req.Value = []byte(body)
		return req
	}
}

func runBulkBlobValidationTest(t *testing.T, req *resourcepb.BulkRequest, skip bool) (*bulkBlobValidationBackend, *bulkBlobValidationStream) {
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
	require.NoError(t, srv.BulkProcess(stream))
	return backend, stream
}

type bulkBlobValidationBackend struct {
	UnimplementedStorageBackend
	settings  BulkSettings
	forwarded []*resourcepb.BulkRequest
	rollback  bool
}

func (b *bulkBlobValidationBackend) ProcessBulk(_ context.Context, settings BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse {
	b.settings = settings
	for iter.Next() {
		if iter.RollbackRequested() {
			b.rollback = true
			break
		}
		b.forwarded = append(b.forwarded, iter.Request())
	}
	return &resourcepb.BulkResponse{Processed: int64(len(b.forwarded))}
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
