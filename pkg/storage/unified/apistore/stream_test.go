package apistore

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
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
	newFunc := func() runtime.Object { return &unstructured.Unstructured{} }
	client := &errWatchClient{ctx: t.Context(), err: resource.NewResourceVersionExpiredError(1234)}
	decoder := newStreamDecoder(client, newFunc, storage.Everything, unstructuredCodec(), func() {}, false)

	// The expired resource version is reported as a 410/Expired status object so
	// that clients (e.g. reflectors) re-list from scratch.
	action, obj, err := decoder.Decode()
	require.NoError(t, err)
	require.Equal(t, watch.Error, action)
	status, ok := obj.(*metav1.Status)
	require.True(t, ok, "expected a metav1.Status, got %T", obj)
	require.Equal(t, int32(http.StatusGone), status.Code)
	require.Equal(t, metav1.StatusReasonExpired, status.Reason)
	require.True(t, apierrors.IsResourceExpired(apierrors.FromObject(status)))

	// The stream is done: the same error must not be reported again.
	_, _, err = decoder.Decode()
	require.ErrorIs(t, err, io.EOF)
}
