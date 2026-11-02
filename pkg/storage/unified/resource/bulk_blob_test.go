package resource

import (
	"context"
	"errors"
	"io"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

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
