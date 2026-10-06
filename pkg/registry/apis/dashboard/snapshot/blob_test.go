package snapshot

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeBlobStore struct {
	put      *resourcepb.PutBlobRequest
	get      *resourcepb.GetBlobRequest
	putRsp   *resourcepb.PutBlobResponse
	value    []byte
	checkGet func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error)
}

func (f *fakeBlobStore) PutBlob(_ context.Context, req *resourcepb.PutBlobRequest, _ ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	f.put = req
	f.value = req.Value
	return f.putRsp, nil
}

func (f *fakeBlobStore) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest, _ ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	f.get = req
	if f.checkGet != nil {
		return f.checkGet(ctx, req)
	}
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

func TestPublicSnapshotDashboardBlob(t *testing.T) {
	const namespace = "org-2"
	store := &fakeBlobStore{checkGet: func(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
		info, ok := authlib.AuthInfoFrom(ctx)
		if !ok || info == nil {
			return &resourcepb.GetBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusUnauthorized}}, nil
		}
		if info.GetNamespace() != req.Resource.Namespace {
			return &resourcepb.GetBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusForbidden}}, nil
		}
		return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
	}}
	snap := newBlobTestSnapshot()
	snap.Namespace = namespace
	snap.Spec.Dashboard = nil
	snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: "blob-1"}
	getter := grafanarest.NewMockStorage(t)
	getter.On("Get", mock.Anything, "snap-1", mock.Anything).Return(snap, nil)
	rest, err := NewDashboardREST(getter, store)
	require.NoError(t, err)
	ctx := k8srequest.WithNamespace(context.Background(), namespace)
	_, err = rest.(*dashboardREST).Connect(ctx, "snap-1", nil, nil)
	require.NoError(t, err)
	require.Equal(t, namespace, store.get.Resource.Namespace)

	// Authenticated requests must retain their caller identity for remote blob stores.
	caller := &identity.StaticRequester{Type: authlib.TypeUser, Namespace: namespace, IDToken: "caller-token"}
	store.checkGet = func(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
		info, ok := authlib.AuthInfoFrom(ctx)
		require.True(t, ok)
		require.Same(t, caller, info)
		require.Equal(t, "caller-token", info.GetIDToken())
		return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
	}
	_, err = rest.(*dashboardREST).Connect(authlib.WithAuthInfo(ctx, caller), "snap-1", nil, nil)
	require.NoError(t, err)

	store.checkGet = func(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
		info, ok := authlib.AuthInfoFrom(ctx)
		require.True(t, ok)
		require.Equal(t, authlib.TypeAnonymous, info.GetIdentityType())
		require.Equal(t, req.Resource.Namespace, info.GetNamespace())
		require.Empty(t, info.GetIDToken())
		return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
	}
	for _, tc := range []struct {
		name   string
		caller *identity.StaticRequester
	}{
		{"anonymous requester without namespace", &identity.StaticRequester{Type: authlib.TypeAnonymous}},
		{"Grafana admin in another namespace", &identity.StaticRequester{Type: authlib.TypeUser, Namespace: "org-3", IsGrafanaAdmin: true, IDToken: "other-token"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store.get = nil
			_, err = rest.(*dashboardREST).Connect(identity.WithRequester(ctx, tc.caller), "snap-1", nil, nil)
			require.NoError(t, err)
			require.NotNil(t, store.get)
		})
	}

	// The snapshot lookup is global in the legacy store. A result from another
	// namespace must not be used to mint blob access for that namespace.
	snap.Namespace = "org-3"
	store.get = nil
	_, err = rest.(*dashboardREST).Connect(ctx, "snap-1", nil, nil)
	require.True(t, apierrors.IsNotFound(err))
	require.Nil(t, store.get)
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
		require.True(t, store.get.MustProxyBytes)
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
