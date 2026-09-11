package apistore

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
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// mockWatchClient implements resourcepb.ResourceStore_WatchClient for testing.
type mockWatchClient struct {
	grpc.ClientStream
	ctx    context.Context
	events []*resourcepb.WatchEvent
	idx    int
}

func (m *mockWatchClient) Recv() (*resourcepb.WatchEvent, error) {
	if m.idx >= len(m.events) {
		return nil, io.EOF
	}
	evt := m.events[m.idx]
	m.idx++
	return evt, nil
}

func (m *mockWatchClient) Context() context.Context     { return m.ctx }
func (m *mockWatchClient) Header() (metadata.MD, error) { return nil, nil }
func (m *mockWatchClient) Trailer() metadata.MD         { return nil }
func (m *mockWatchClient) CloseSend() error             { return nil }
func (m *mockWatchClient) SendMsg(any) error            { return nil }
func (m *mockWatchClient) RecvMsg(any) error            { return nil }

func unstructuredCodec() runtime.Codec {
	scheme := runtime.NewScheme()
	codecs := serializer.NewCodecFactory(scheme)
	return codecs.LegacyCodec()
}

func TestStreamDecoderBookmarkAnnotation(t *testing.T) {
	newFunc := func() runtime.Object { return &unstructured.Unstructured{} }
	predicate := storage.Everything

	t.Run("initial-events-end annotation only on first bookmark when sendInitialEvents is true", func(t *testing.T) {
		client := &mockWatchClient{
			ctx: t.Context(),
			events: []*resourcepb.WatchEvent{
				{
					Type:     resourcepb.WatchEvent_BOOKMARK,
					Resource: &resourcepb.WatchEvent_Resource{Version: 10},
				},
				{
					Type:     resourcepb.WatchEvent_BOOKMARK,
					Resource: &resourcepb.WatchEvent_Resource{Version: 20},
				},
				{
					Type:     resourcepb.WatchEvent_BOOKMARK,
					Resource: &resourcepb.WatchEvent_Resource{Version: 30},
				},
			},
		}

		decoder := newStreamDecoder(client, newFunc, predicate, unstructuredCodec(), func() {}, true)

		// First bookmark should have the initial-events-end annotation.
		action, obj, err := decoder.Decode()
		require.NoError(t, err)
		require.Equal(t, watch.Bookmark, action)
		accessor, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		annotations := accessor.GetAnnotations()
		require.Equal(t, "true", annotations["k8s.io/initial-events-end"])

		// Subsequent bookmarks should *not* have the annotation.
		for range 2 {
			action, obj, err = decoder.Decode()
			require.NoError(t, err)
			require.Equal(t, watch.Bookmark, action)
			accessor, err = utils.MetaAccessor(obj)
			require.NoError(t, err)
			annotations = accessor.GetAnnotations()
			require.Empty(t, annotations["k8s.io/initial-events-end"])
		}
	})

	t.Run("no initial-events-end annotation when sendInitialEvents is false", func(t *testing.T) {
		client := &mockWatchClient{
			ctx: t.Context(),
			events: []*resourcepb.WatchEvent{
				{
					Type:     resourcepb.WatchEvent_BOOKMARK,
					Resource: &resourcepb.WatchEvent_Resource{Version: 10},
				},
				{
					Type:     resourcepb.WatchEvent_BOOKMARK,
					Resource: &resourcepb.WatchEvent_Resource{Version: 20},
				},
			},
		}

		decoder := newStreamDecoder(client, newFunc, predicate, unstructuredCodec(), func() {}, false)

		for range 2 {
			action, obj, err := decoder.Decode()
			require.NoError(t, err)
			require.Equal(t, watch.Bookmark, action)
			accessor, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			annotations := accessor.GetAnnotations()
			require.Empty(t, annotations["k8s.io/initial-events-end"])
		}
	})
}

// errWatchClient implements resourcepb.ResourceStore_WatchClient and always
// fails Recv with the same error, like a terminated gRPC stream does.
type errWatchClient struct {
	grpc.ClientStream
	ctx context.Context
	err error
}

func (m *errWatchClient) Recv() (*resourcepb.WatchEvent, error) { return nil, m.err }
func (m *errWatchClient) Context() context.Context              { return m.ctx }
func (m *errWatchClient) Header() (metadata.MD, error)          { return nil, nil }
func (m *errWatchClient) Trailer() metadata.MD                  { return nil }
func (m *errWatchClient) CloseSend() error                      { return nil }
func (m *errWatchClient) SendMsg(any) error                     { return nil }
func (m *errWatchClient) RecvMsg(any) error                     { return nil }

func TestStreamDecoderExpiredResourceVersion(t *testing.T) {
	for _, canceled := range []bool{false, true} {
		name := "active context"
		if canceled {
			name = "already canceled context"
		}
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			t.Cleanup(cancel)
			if canceled {
				cancel()
			}
			client := &errWatchClient{ctx: ctx, err: resource.NewResourceVersionExpiredError(1234)}
			decoder := newStreamDecoder(client, func() runtime.Object { return &unstructured.Unstructured{} }, storage.Everything, unstructuredCodec(), cancel, false)
			t.Cleanup(decoder.Close)

			action, obj, err := decoder.Decode()
			require.NoError(t, err)
			require.Equal(t, watch.Error, action)
			s, ok := obj.(*metav1.Status)
			require.True(t, ok, "expected a metav1.Status, got %T", obj)
			require.Equal(t, int32(http.StatusGone), s.Code)
			require.Equal(t, metav1.StatusReasonExpired, s.Reason)
			require.True(t, apierrors.IsResourceExpired(apierrors.FromObject(s)))

			// The stream is done: the same error must not be reported again.
			_, _, err = decoder.Decode()
			require.ErrorIs(t, err, io.EOF)
		})
	}
}

type streamDecoderTestServer struct {
	resourcepb.UnimplementedResourceStoreServer
	watch func(resourcepb.ResourceStore_WatchServer) error
}

func (s *streamDecoderTestServer) Watch(_ *resourcepb.WatchRequest, stream resourcepb.ResourceStore_WatchServer) error {
	return s.watch(stream)
}

func newStreamDecoderGRPCClient(t *testing.T, handler func(resourcepb.ResourceStore_WatchServer) error) (resourcepb.ResourceStore_WatchClient, context.CancelFunc) {
	t.Helper()

	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer()
	resourcepb.RegisterResourceStoreServer(server, &streamDecoderTestServer{watch: handler})
	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()
	t.Cleanup(func() {
		server.Stop()
		require.NoError(t, <-serveErr)
	})

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })

	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	t.Cleanup(cancel)
	client, err := resourcepb.NewResourceStoreClient(conn).Watch(ctx, &resourcepb.WatchRequest{})
	require.NoError(t, err)
	return client, cancel
}

func TestStreamDecoderGRPCTermination(t *testing.T) {
	for _, tc := range []struct {
		name    string
		err     error
		expired bool
	}{
		{name: "expired resource version", err: resource.NewResourceVersionExpiredError(1234), expired: true},
		{name: "clean close"},
		{name: "canceled", err: status.Error(codes.Canceled, "watch canceled")},
		{name: "max age disconnect", err: status.Error(codes.Unavailable, "transport is closing")},
		{name: "deadline exceeded", err: status.Error(codes.DeadlineExceeded, "watch deadline exceeded")},
		{name: "permission denied", err: status.Error(codes.PermissionDenied, "watch denied")},
		{name: "internal", err: status.Error(codes.Internal, "storage error")},
		{name: "out of range without expiry details", err: status.Error(codes.OutOfRange, "invalid range")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client, cancel := newStreamDecoderGRPCClient(t, func(stream resourcepb.ResourceStore_WatchServer) error {
				if err := stream.Send(&resourcepb.WatchEvent{
					Type:     resourcepb.WatchEvent_BOOKMARK,
					Resource: &resourcepb.WatchEvent_Resource{Version: 10},
				}); err != nil {
					return err
				}
				return tc.err
			})
			decoder := newStreamDecoder(client, func() runtime.Object { return &unstructured.Unstructured{} }, storage.Everything, unstructuredCodec(), cancel, false)
			t.Cleanup(decoder.Close)

			action, obj, err := decoder.Decode()
			require.NoError(t, err)
			require.Equal(t, watch.Bookmark, action)
			require.Equal(t, "10", obj.(*unstructured.Unstructured).GetResourceVersion())

			action, obj, err = decoder.Decode()
			require.Equal(t, watch.Error, action)
			require.ErrorIs(t, client.Context().Err(), context.Canceled)
			if tc.expired {
				require.NoError(t, err)
				s, ok := obj.(*metav1.Status)
				require.True(t, ok, "expected a metav1.Status, got %T", obj)
				require.Equal(t, int32(http.StatusGone), s.Code)
				require.Equal(t, metav1.StatusReasonExpired, s.Reason)
				require.True(t, apierrors.IsResourceExpired(apierrors.FromObject(s)))

				action, obj, err = decoder.Decode()
				require.Equal(t, watch.Error, action)
			}
			require.Nil(t, obj)
			require.ErrorIs(t, err, io.EOF)
		})
	}
}

func TestStreamDecoderCallerCancellation(t *testing.T) {
	client, cancel := newStreamDecoderGRPCClient(t, func(stream resourcepb.ResourceStore_WatchServer) error {
		<-stream.Context().Done()
		return status.FromContextError(stream.Context().Err()).Err()
	})
	decoder := newStreamDecoder(client, func() runtime.Object { return &unstructured.Unstructured{} }, storage.Everything, unstructuredCodec(), cancel, false)
	t.Cleanup(decoder.Close)

	cancel()
	action, obj, err := decoder.Decode()
	require.Equal(t, watch.Error, action)
	require.Nil(t, obj)
	require.ErrorIs(t, err, io.EOF)
}
