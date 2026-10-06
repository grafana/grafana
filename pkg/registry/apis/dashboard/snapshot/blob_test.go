package snapshot

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeBlobStore struct {
	put    *resourcepb.PutBlobRequest
	get    *resourcepb.GetBlobRequest
	putRsp *resourcepb.PutBlobResponse
	value  []byte
}

func (f *fakeBlobStore) PutBlob(_ context.Context, req *resourcepb.PutBlobRequest, _ ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	f.put = req
	f.value = req.Value
	return f.putRsp, nil
}

func (f *fakeBlobStore) GetBlob(_ context.Context, req *resourcepb.GetBlobRequest, _ ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	f.get = req
	return &resourcepb.GetBlobResponse{Value: f.value, ContentType: "application/json"}, nil
}

func newBlobTestSnapshot() *dashv0.Snapshot {
	return &dashv0.Snapshot{
		ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: "snap-1"},
		Spec: dashv0.SnapshotSpec{
			Dashboard: map[string]any{"title": "CPU", "panels": []any{}},
		},
	}
}

func TestMoveDashboardToBlob(t *testing.T) {
	ctx := context.Background()

	t.Run("stores the dashboard as a blob and references it from blobs.dashboard", func(t *testing.T) {
		store := &fakeBlobStore{putRsp: &resourcepb.PutBlobResponse{Uid: "blob-1", Size: 27, Hash: "abc", MimeType: "application/json"}}
		snap := newBlobTestSnapshot()

		require.NoError(t, moveDashboardToBlob(ctx, store, snap))

		require.Nil(t, snap.Spec.Dashboard)
		require.Equal(t, &resourcepb.ResourceKey{Namespace: "default", Group: dashv0.GROUP, Resource: "snapshots", Name: "snap-1"}, store.put.Resource)
		require.JSONEq(t, `{"title":"CPU","panels":[]}`, string(store.put.Value))
		require.Equal(t, "blob-1", snap.Blobs.Dashboard.Uid)
		require.Equal(t, int64(27), *snap.Blobs.Dashboard.Size)
		require.Equal(t, "abc", *snap.Blobs.Dashboard.Hash)
		require.Equal(t, "application/json", *snap.Blobs.Dashboard.ContentType)
		require.Empty(t, snap.GetAnnotations())

		encoded, err := json.Marshal(snap)
		require.NoError(t, err)
		decoded := &dashv0.Snapshot{}
		require.NoError(t, json.Unmarshal(encoded, decoded))
		require.Equal(t, snap.Blobs, decoded.Blobs)
		require.Contains(t, string(encoded), `"blobs":{"dashboard":{"uid":"blob-1"`)
	})

	t.Run("keeps the dashboard inline when the blob store is not implemented", func(t *testing.T) {
		store := &fakeBlobStore{putRsp: &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotImplemented}}}
		snap := newBlobTestSnapshot()

		require.NoError(t, moveDashboardToBlob(ctx, store, snap))

		require.NotNil(t, snap.Spec.Dashboard)
		require.Nil(t, snap.Blobs.Dashboard)
	})
}

func TestReadDashboardBlob(t *testing.T) {
	ctx := context.Background()

	t.Run("reads the blob referenced by blobs.dashboard", func(t *testing.T) {
		store := &fakeBlobStore{value: []byte(`{"title":"CPU","panels":[]}`)}
		snap := newBlobTestSnapshot()
		snap.Spec.Dashboard = nil
		snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: "blob-1"}

		dash, ok, err := readDashboardBlob(ctx, store, snap)

		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, "blob-1", store.get.Uid)
		require.Equal(t, "snap-1", store.get.Resource.Name)
		require.Equal(t, map[string]any{"title": "CPU", "panels": []any{}}, dash)
	})

	t.Run("reports no blob for snapshots without a reference", func(t *testing.T) {
		store := &fakeBlobStore{}
		_, ok, err := readDashboardBlob(ctx, store, newBlobTestSnapshot())

		require.NoError(t, err)
		require.False(t, ok)
		require.Nil(t, store.get)
	})

	t.Run("fails when a reference exists but no blob store is configured", func(t *testing.T) {
		snap := newBlobTestSnapshot()
		snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: "blob-1"}

		_, ok, err := readDashboardBlob(ctx, nil, snap)

		require.Error(t, err)
		require.True(t, ok)
	})
}
