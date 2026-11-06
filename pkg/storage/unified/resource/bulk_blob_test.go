package resource

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/memblob"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type bulkBlobUploadFunc struct {
	StreamingBlobSupport
	put func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error)
}

func (b bulkBlobUploadFunc) PutResourceBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	return b.put(ctx, req, reader)
}

func newBulkBlobNormalizationRequest() *resourcepb.BulkRequest {
	req := newTestBulkRequest("item")
	req.BlobUploads = []*resourcepb.BulkBlobUpload{{Name: "dashboard", ContentType: "application/json", Size: 3}}
	return req
}

func completedBulkBlobUpload(reader io.Reader) (*resourcepb.PutBlobResponse, error) {
	n, err := io.Copy(io.Discard, reader)
	if err != nil {
		return nil, err
	}
	return &resourcepb.PutBlobResponse{Uid: "uploaded", Size: n, Hash: "server-hash", MimeType: "application/json", Charset: "utf-8"}, nil
}

func TestNormalizeBulkBlobUploads(t *testing.T) {
	req := newBulkBlobNormalizationRequest()
	req.Folder = "folder"
	req.Value = []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","metadata":{"name":"item","namespace":"default"},"spec":{"data":"resource-specific","number":9007199254740993},"extension":{"unknown":true},"blobs":{"existing":{"uid":"old","custom":{"data":"not inline"}}}}`)
	req.BlobUploads = append(req.BlobUploads, &resourcepb.BulkBlobUpload{Name: "image", ContentType: "image/png", Size: 4})
	original := proto.Clone(req)
	stream := &testBulkProcessServer{requests: []*resourcepb.BulkRequest{
		bulkTestChunk("dashboard", []byte("abc"), false),
		bulkTestChunk("dashboard", nil, true),
		bulkTestChunk("image", []byte{0, 1, 2, 255}, false),
		bulkTestChunk("image", nil, true),
		newTestBulkRequest("next"),
	}}
	calls := 0
	backend := bulkBlobUploadFunc{put: func(ctx context.Context, upload *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
		require.Equal(t, t.Context(), ctx)
		require.True(t, proto.Equal(req.Key, upload.Resource))
		require.Equal(t, resourcepb.PutBlobRequest_GRPC, upload.Method)
		require.Empty(t, upload.Value)
		value, err := io.ReadAll(reader)
		require.NoError(t, err)
		calls++
		if calls == 1 {
			require.Equal(t, "application/json", upload.ContentType)
			require.Equal(t, []byte("abc"), value)
			return &resourcepb.PutBlobResponse{Uid: "dashboard-uid", Size: 3, Hash: "computed", MimeType: "application/json", Charset: "utf-8"}, nil
		}
		require.Equal(t, "image/png", upload.ContentType)
		require.Equal(t, []byte{0, 1, 2, 255}, value)
		return &resourcepb.PutBlobResponse{Uid: "image-uid", Size: 4, Hash: "image-hash", MimeType: "image/png"}, nil
	}}
	result, err := normalizeBulkBlobUploads(t.Context(), req, backend, stream.Recv)
	require.NoError(t, err)
	require.Equal(t, 2, calls)
	require.True(t, proto.Equal(original, req), "input must remain unchanged")
	require.NotSame(t, req, result)
	require.Empty(t, result.BlobUploads)
	require.Nil(t, result.BlobChunk)
	require.Equal(t, req.Folder, result.Folder)
	require.Equal(t, req.Action, result.Action)
	require.True(t, proto.Equal(req.Key, result.Key))
	require.NoError(t, validateBulkBlobInput(result))

	before, err := resourcepb.DecodeBlobObject(req.Value)
	require.NoError(t, err)
	after, err := resourcepb.DecodeBlobObject(result.Value)
	require.NoError(t, err)
	for name, raw := range before {
		if name != "blobs" {
			require.JSONEq(t, string(raw), string(after[name]))
		}
	}
	require.Contains(t, string(after["spec"]), "9007199254740993")
	blobs, err := resourcepb.DecodeBlobObject(after["blobs"])
	require.NoError(t, err)
	require.JSONEq(t, `{"uid":"old","custom":{"data":"not inline"}}`, string(blobs["existing"]))
	require.JSONEq(t, `{"uid":"dashboard-uid","contentType":"application/json; charset=utf-8","size":3,"hash":"computed"}`, string(blobs["dashboard"]))
	require.JSONEq(t, `{"uid":"image-uid","contentType":"image/png","size":4,"hash":"image-hash"}`, string(blobs["image"]))
	next, err := stream.Recv()
	require.NoError(t, err)
	require.Equal(t, "next", next.Key.Name)
}

func TestNormalizeBulkBlobUploadsPreservesReferenceOnlyInput(t *testing.T) {
	for _, value := range []string{"", `{"spec":{"data":"not inline"}}`, `{"blobs":null}`, `{"blobs":{}}`, `{"blobs":{"old":{"uid":"old","custom":true}}}`} {
		t.Run(value, func(t *testing.T) {
			req := newTestBulkRequest("item")
			req.Value = []byte(value)
			result, err := normalizeBulkBlobUploads(t.Context(), req, nil, nil)
			require.NoError(t, err)
			require.Same(t, req, result)
			require.Equal(t, value, string(result.Value))
		})
	}
}

func TestNormalizeBulkBlobUploadsRejectsInvalidInputBeforeUpload(t *testing.T) {
	cases := []struct {
		name   string
		change func(*resourcepb.BulkRequest)
	}{
		{"delete", func(r *resourcepb.BulkRequest) { r.Action = resourcepb.BulkRequest_DELETED }},
		{"missing key", func(r *resourcepb.BulkRequest) { r.Key = nil }},
		{"invalid key", func(r *resourcepb.BulkRequest) { r.Key.Name = "" }},
		{"malformed body", func(r *resourcepb.BulkRequest) { r.Value = []byte(`{`) }},
		{"non-object body", func(r *resourcepb.BulkRequest) { r.Value = []byte(`[]`) }},
		{"missing metadata", func(r *resourcepb.BulkRequest) { r.Value = []byte(`{}`) }},
		{"wrong name", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"item"`, `"other"`, 1))
		}},
		{"wrong namespace", func(r *resourcepb.BulkRequest) { r.Key.Namespace = "other" }},
		{"wrong group", func(r *resourcepb.BulkRequest) { r.Key.Group = "other.grafana.app" }},
		{"duplicate metadata name", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"name":"item"`, `"name":"item","name":"other"`, 1))
		}},
		{"duplicate declaration", func(r *resourcepb.BulkRequest) { r.BlobUploads = append(r.BlobUploads, r.BlobUploads[0]) }},
		{"invalid size", func(r *resourcepb.BulkRequest) { r.BlobUploads[0].Size = 0 }},
		{"invalid content type", func(r *resourcepb.BulkRequest) { r.BlobUploads[0].ContentType = "*/*" }},
		{"collision", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"spec":`, `"blobs":{"dashboard":{"uid":"old"}},"spec":`, 1))
		}},
		{"inline data", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"spec":`, `"blobs":{"other":{"data":null}},"spec":`, 1))
		}},
		{"empty existing name", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"spec":`, `"blobs":{" ":{"uid":"old"}},"spec":`, 1))
		}},
		{"combined entry limit", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"spec":`, `"blobs":{"existing":{"uid":"old"}},"spec":`, 1))
			for i := 1; i < resourcepb.MaxInlineBlobEntries; i++ {
				r.BlobUploads = append(r.BlobUploads, &resourcepb.BulkBlobUpload{Name: "blob-" + strconv.Itoa(i), ContentType: "text/plain", Size: 3})
			}
		}},
		{"duplicate blobs", func(r *resourcepb.BulkRequest) {
			r.Value = []byte(strings.Replace(string(r.Value), `"spec":`, `"blobs":{},"blobs":{},"spec":`, 1))
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := newBulkBlobNormalizationRequest()
			tc.change(req)
			backend := bulkBlobUploadFunc{put: func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
				t.Fatal("invalid input must not upload")
				return nil, nil
			}}
			result, err := normalizeBulkBlobUploads(t.Context(), req, backend, func() (*resourcepb.BulkRequest, error) {
				t.Fatal("invalid input must not consume chunks")
				return nil, nil
			})
			require.Nil(t, result)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
		})
	}
}

func TestNormalizeBulkBlobUploadsRequiresStreamingBackend(t *testing.T) {
	result, err := normalizeBulkBlobUploads(t.Context(), newBulkBlobNormalizationRequest(), nil, nil)
	require.Nil(t, result)
	require.Equal(t, codes.Unimplemented, status.Code(err))
}

func TestNormalizeBulkBlobUploadsRejectsFailedUploads(t *testing.T) {
	transportErr := status.Error(codes.Unavailable, "upload transport failed")
	cases := []struct {
		name string
		put  func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error)
		want string
	}{
		{"transport error", func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
			return nil, transportErr
		}, "upload transport failed"},
		{"response error", func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "upload response failed"}}, nil
		}, "upload response failed"},
		{"both errors", func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusBadRequest, Message: "secondary"}}, transportErr
		}, "upload transport failed"},
		{"nil response", func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
			return nil, nil
		}, "no upload response"},
		{"unread upload", func(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error) {
			return &resourcepb.PutBlobResponse{Uid: "early", Size: 3}, nil
		}, "before consuming upload EOF"},
		{"exact bytes without EOF", func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
			_, err := io.ReadFull(r, make([]byte, 3))
			require.NoError(t, err)
			return &resourcepb.PutBlobResponse{Uid: "early", Size: 3}, nil
		}, "before consuming upload EOF"},
		{"missing uid", func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
			response, err := completedBulkBlobUpload(r)
			if response != nil {
				response.Uid = ""
			}
			return response, err
		}, "invalid upload metadata"},
		{"wrong size", func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
			response, err := completedBulkBlobUpload(r)
			if response != nil {
				response.Size++
			}
			return response, err
		}, "invalid upload metadata"},
		{"missing content type", func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
			response, err := completedBulkBlobUpload(r)
			if response != nil {
				response.MimeType = ""
			}
			return response, err
		}, "invalid upload metadata"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := newBulkBlobNormalizationRequest()
			original := proto.Clone(req)
			stream := &testBulkProcessServer{requests: []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true)}}
			result, err := normalizeBulkBlobUploads(t.Context(), req, bulkBlobUploadFunc{put: tc.put}, stream.Recv)
			require.Nil(t, result)
			require.ErrorContains(t, err, tc.want)
			require.True(t, proto.Equal(original, req))
			if tc.name == "both errors" || tc.name == "transport error" {
				require.ErrorIs(t, err, transportErr)
			}
		})
	}
}

func TestNormalizeBulkBlobUploadsPreservesReaderErrors(t *testing.T) {
	for _, swallow := range []bool{false, true} {
		stream := &testBulkProcessServer{requests: []*resourcepb.BulkRequest{bulkTestChunk("wrong", []byte("abc"), false)}}
		backend := bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, reader io.Reader) (*resourcepb.PutBlobResponse, error) {
			response, err := completedBulkBlobUpload(reader)
			if swallow {
				return &resourcepb.PutBlobResponse{Uid: "bad", Size: 3}, nil
			}
			return response, err
		}}
		result, err := normalizeBulkBlobUploads(t.Context(), newBulkBlobNormalizationRequest(), backend, stream.Recv)
		require.Nil(t, result)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
		require.ErrorContains(t, err, "declaration order")
	}
}

func TestNormalizeBulkBlobUploadsSecondUploadFailure(t *testing.T) {
	req := newBulkBlobNormalizationRequest()
	req.BlobUploads = append(req.BlobUploads, &resourcepb.BulkBlobUpload{Name: "second", ContentType: "text/plain", Size: 3})
	original := proto.Clone(req)
	stream := &testBulkProcessServer{requests: []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true)}}
	failure := errors.New("second upload failed")
	calls := 0
	backend := bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
		calls++
		if calls == 2 {
			return nil, failure
		}
		return completedBulkBlobUpload(r)
	}}
	result, err := normalizeBulkBlobUploads(t.Context(), req, backend, stream.Recv)
	require.ErrorIs(t, err, failure)
	require.Nil(t, result)
	require.True(t, proto.Equal(original, req))
}

func TestNormalizeBulkBlobUploadsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	backend := bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
		return completedBulkBlobUpload(r)
	}}
	result, err := normalizeBulkBlobUploads(ctx, newBulkBlobNormalizationRequest(), backend, func() (*resourcepb.BulkRequest, error) {
		t.Fatal("canceled uploads must not receive chunks")
		return nil, nil
	})
	require.Nil(t, result)
	require.Equal(t, codes.Canceled, status.Code(err))
}

func TestNormalizeBulkBlobUploadsNullBlobs(t *testing.T) {
	req := newBulkBlobNormalizationRequest()
	req.Value = []byte(strings.Replace(string(req.Value), `"spec":`, `"blobs":null,"spec":`, 1))
	stream := &testBulkProcessServer{requests: []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true)}}
	backend := bulkBlobUploadFunc{put: func(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
		return completedBulkBlobUpload(r)
	}}
	result, err := normalizeBulkBlobUploads(t.Context(), req, backend, stream.Recv)
	require.NoError(t, err)
	var body map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(result.Value, &body))
	require.Contains(t, string(body["blobs"]), `"dashboard"`)
}

func TestNormalizeBulkBlobUploadsBackendRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		name, backend, contentType, downloadedContentType string
	}{
		{"kv", "kv", "application/json", "application/json"},
		{"bucket", "bucket", "application/json", "application/json"},
		{"kv profile", "kv", "application/json; profile=foo", "application/json; profile=foo"},
		// Bucket downloads currently lose non-charset parameters when decoding resource references.
		{"bucket boundary", "bucket", "multipart/form-data; boundary=abc", "multipart/form-data"},
		{"kv profile and charset", "kv", "application/json; charset=utf-8; profile=foo", "application/json; charset=utf-8; profile=foo"},
		{"kv quoted charset", "kv", `text/plain; charset="x;y"`, `text/plain; charset="x;y"`},
		{"bucket quoted charset", "bucket", `text/plain; charset="x;y"`, "text/plain; charset=x;y"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var store BlobSupport
			if tc.backend == "kv" {
				store = NewKVBlobSupport(setupBadgerKV(t))
			} else {
				bucket := memblob.OpenBucket(nil)
				t.Cleanup(func() { require.NoError(t, bucket.Close()) })
				var err error
				store, err = NewCDKBlobSupport(t.Context(), CDKBlobSupportOptions{Bucket: bucket})
				require.NoError(t, err)
			}
			req := newBulkBlobNormalizationRequest()
			req.BlobUploads[0].ContentType = tc.contentType
			stream := &testBulkProcessServer{requests: []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false), bulkTestChunk("dashboard", nil, true)}}
			result, err := normalizeBulkBlobUploads(t.Context(), req, store.(StreamingBlobSupport), stream.Recv)
			require.NoError(t, err)
			require.NoError(t, validateBulkBlobInput(result))
			body, err := resourcepb.DecodeBlobObject(result.Value)
			require.NoError(t, err)
			blobs, err := resourcepb.DecodeBlobEntries(body["blobs"])
			require.NoError(t, err)
			ref := blobs["dashboard"]
			require.NotEmpty(t, ref.UID)
			require.EqualValues(t, 3, ref.Size)
			require.Equal(t, "900150983cd24fb0d6963f7d28e17f72", ref.Hash)
			require.Equal(t, tc.contentType, ref.ContentType)
			srv, _, _ := newBlobAuthzTestServer(t, nil)
			srv.blob = store
			ctx := ctxWithUserInNs(req.Key.Namespace)
			created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: req.Key, Value: result.Value})
			require.NoError(t, err)
			require.Nil(t, created.Error)
			client := NewLocalResourceClient(srv)
			get, err := client.GetBlob(ctx, &resourcepb.GetBlobRequest{Resource: req.Key, Uid: ref.UID, MustProxyBytes: true})
			require.NoError(t, err)
			require.Nil(t, get.Error)
			require.Equal(t, tc.downloadedContentType, get.ContentType)
			require.Equal(t, []byte("abc"), get.Value)
		})
	}
}

func bulkTestChunk(name string, value []byte, last bool) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{BlobChunk: &resourcepb.BulkBlobChunk{Name: name, Value: value, Last: last}}
}

func TestBulkBlobReader(t *testing.T) {
	frames := []*resourcepb.BulkRequest{
		bulkTestChunk("dashboard", []byte("abc"), false),
		bulkTestChunk("dashboard", []byte("de"), false),
		bulkTestChunk("dashboard", nil, true),
		bulkTestChunk("image", []byte("png"), false),
		bulkTestChunk("image", nil, true),
		newTestBulkRequest("next-resource"),
	}
	stream := &testBulkProcessServer{requests: frames}
	for _, upload := range []*resourcepb.BulkBlobUpload{
		{Name: "dashboard", Size: 5},
		{Name: "image", Size: 3},
	} {
		r := &bulkBlobReader{ctx: t.Context(), recv: stream.Recv, upload: upload}
		var got []byte
		// Small reads exercise pending bytes without receiving another frame.
		p := make([]byte, 2)
		for {
			n, err := r.Read(p)
			got = append(got, p[:n]...)
			if errors.Is(err, io.EOF) {
				break
			}
			require.NoError(t, err)
		}
		if upload.Name == "dashboard" {
			require.Equal(t, "abcde", string(got))
		} else {
			require.Equal(t, "png", string(got))
		}
		require.True(t, r.complete)
		require.Equal(t, upload.Size, r.total)
		n, err := r.Read(p)
		require.Zero(t, n)
		require.ErrorIs(t, err, io.EOF)
	}
	next, err := stream.Recv()
	require.NoError(t, err)
	require.Equal(t, "next-resource", next.Key.Name)
}

func TestBulkBlobReaderRejectsInvalidStream(t *testing.T) {
	mixed := bulkTestChunk("dashboard", []byte("abc"), false)
	mixed.Key = newTestBulkRequest("item").Key
	cases := []struct {
		name   string
		frames []*resourcepb.BulkRequest
		want   string
	}{
		{"premature stream end", nil, "before final blob chunk"},
		{"missing EOF at exact size", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), false)}, "before final blob chunk"},
		{"short upload", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("a"), false), bulkTestChunk("dashboard", nil, true)}, "size does not match"},
		{"empty upload", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", nil, true)}, "size does not match"},
		{"oversized upload", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abcd"), false)}, "exceeds declared size"},
		{"wrong name", []*resourcepb.BulkRequest{bulkTestChunk("other", []byte("abc"), false)}, "declaration order"},
		{"interleaved upload", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("a"), false), bulkTestChunk("other", []byte("bc"), false)}, "declaration order"},
		{"premature resource", []*resourcepb.BulkRequest{newTestBulkRequest("next")}, "before next resource"},
		{"nil frame", []*resourcepb.BulkRequest{nil}, "must not be nil"},
		{"empty chunk", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", nil, false)}, "1.."},
		{"large chunk", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", make([]byte, resourcepb.BulkBlobChunkSize+1), false)}, "1.."},
		{"EOF with bytes", []*resourcepb.BulkRequest{bulkTestChunk("dashboard", []byte("abc"), true)}, "no bytes"},
		{"mixed frame", []*resourcepb.BulkRequest{mixed}, "resource fields"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stream := &testBulkProcessServer{requests: tc.frames}
			r := &bulkBlobReader{ctx: t.Context(), recv: stream.Recv, upload: &resourcepb.BulkBlobUpload{Name: "dashboard", Size: 3}}
			_, err := io.Copy(io.Discard, r)
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			require.ErrorContains(t, err, tc.want)
			require.False(t, r.complete)
			_, repeated := r.Read(make([]byte, 1))
			require.Equal(t, err, repeated)
		})
	}
}

func TestBulkBlobReaderMaxSize(t *testing.T) {
	chunk := make([]byte, resourcepb.BulkBlobChunkSize)
	remaining := int64(resourcepb.MaxInlineBlobSize)
	r := &bulkBlobReader{
		ctx:    t.Context(),
		upload: &resourcepb.BulkBlobUpload{Name: "dashboard", Size: resourcepb.MaxInlineBlobSize},
		recv: func() (*resourcepb.BulkRequest, error) {
			if remaining == 0 {
				return bulkTestChunk("dashboard", nil, true), nil
			}
			remaining -= int64(len(chunk))
			return bulkTestChunk("dashboard", chunk, false), nil
		},
	}
	n, err := io.Copy(io.Discard, r)
	require.NoError(t, err)
	require.EqualValues(t, resourcepb.MaxInlineBlobSize, n)
	require.True(t, r.complete)
}

func TestBulkBlobReaderTransportError(t *testing.T) {
	want := status.Error(codes.Unavailable, "transport failed")
	r := &bulkBlobReader{
		ctx:    t.Context(),
		upload: &resourcepb.BulkBlobUpload{Name: "dashboard", Size: 3},
		recv:   func() (*resourcepb.BulkRequest, error) { return nil, want },
	}
	_, err := io.ReadAll(r)
	require.ErrorIs(t, err, want)
	require.False(t, r.complete)
}

func TestBulkBlobReaderCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
		defer cancel()
		closed := make(chan struct{})
		defer close(closed)
		r := &bulkBlobReader{
			ctx:    ctx,
			upload: &resourcepb.BulkBlobUpload{Name: "dashboard", Size: 3},
			recv: func() (*resourcepb.BulkRequest, error) {
				<-closed
				return nil, io.EOF
			},
		}
		_, err := io.ReadAll(r)
		require.Equal(t, codes.DeadlineExceeded, status.Code(err))
		require.False(t, r.complete)
	})
}

func TestBulkBlobReaderAlreadyCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	r := &bulkBlobReader{
		ctx: ctx,
		recv: func() (*resourcepb.BulkRequest, error) {
			t.Fatal("must not receive after cancellation")
			return nil, nil
		},
	}
	_, err := r.Read(make([]byte, 1))
	require.Equal(t, codes.Canceled, status.Code(err))
}
