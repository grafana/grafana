package snapshot

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
	putCalls int
	get      *resourcepb.GetBlobRequest
	putRsp   *resourcepb.PutBlobResponse
	putErr   error
	value    []byte
	checkGet func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error)
}

func (f *fakeBlobStore) PutBlob(_ context.Context, req *resourcepb.PutBlobRequest, _ ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	f.put = req
	f.putCalls++
	f.value = req.Value
	return f.putRsp, f.putErr
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
		Blobs: dashv0.SnapshotBlobs{Dashboard: &dashv0.SnapshotBlobReference{
			Data:        new(base64.StdEncoding.EncodeToString([]byte(`{"title":"CPU","panels":[]}`))),
			ContentType: new("application/json"),
		}},
	}
}

func dashboardContentForTest(t *testing.T, snap *dashv0.Snapshot) map[string]any {
	t.Helper()
	dashboard, err := inlineDashboardContent(snap)
	require.NoError(t, err)
	return dashboard
}

func TestInlineDashboardContent(t *testing.T) {
	for _, value := range []string{`{"id":9007199254740993}`, `{}`} {
		snap := newBlobTestSnapshot()
		snap.Blobs.Dashboard.Data = new(base64.StdEncoding.EncodeToString([]byte(value)))
		dashboard, err := inlineDashboardContent(snap)
		require.NoError(t, err)
		encoded, err := json.Marshal(dashboard)
		require.NoError(t, err)
		require.JSONEq(t, value, string(encoded))
	}
	for _, value := range []string{`null`, `[]`, `"dashboard"`, `{} {}`, `invalid`} {
		t.Run(value, func(t *testing.T) {
			snap := newBlobTestSnapshot()
			snap.Blobs.Dashboard.Data = new(base64.StdEncoding.EncodeToString([]byte(value)))
			_, err := inlineDashboardContent(snap)
			require.Error(t, err)
		})
	}
}

func TestPublicSnapshotDashboardBlob(t *testing.T) {
	const namespace = "org-2"
	store := &fakeBlobStore{checkGet: func(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
		info, ok := authlib.AuthInfoFrom(ctx)
		if !ok || info == nil {
			return nil, status.Error(codes.Unauthenticated, "missing auth info")
		}
		if info.GetNamespace() != req.Resource.Namespace {
			return nil, status.Error(codes.PermissionDenied, "namespace mismatch")
		}
		return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
	}}
	snap := newBlobTestSnapshot()
	snap.Namespace = namespace
	snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("blob-1")}
	getter := grafanarest.NewMockStorage(t)
	getter.On("Get", mock.Anything, "snap-1", mock.Anything).Return(snap, nil)
	getter.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*snap}}, nil)
	rest, err := NewDashboardREST(getter, store)
	require.NoError(t, err)
	ctx := k8srequest.WithNamespace(context.Background(), namespace)
	_, err = rest.(*dashboardREST).Connect(ctx, "snap-1", nil, nil)
	require.NoError(t, err)
	require.Equal(t, namespace, store.get.Resource.Namespace)

	store.checkGet = func(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
		info, ok := authlib.AuthInfoFrom(ctx)
		require.True(t, ok)
		require.True(t, identity.IsServiceIdentity(ctx))
		require.Equal(t, req.Resource.Namespace, info.GetNamespace())
		require.Empty(t, info.GetIDToken())
		return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
	}
	for _, tc := range []struct {
		name   string
		caller *identity.StaticRequester
	}{
		{"anonymous requester without namespace", &identity.StaticRequester{Type: authlib.TypeAnonymous}},
		{"anonymous requester in snapshot namespace", &identity.StaticRequester{Type: authlib.TypeAnonymous, Namespace: namespace}},
		{"same-org user", &identity.StaticRequester{Type: authlib.TypeUser, Namespace: namespace, IDToken: "caller-token"}},
		{"same-org user without token", &identity.StaticRequester{Type: authlib.TypeUser, Namespace: namespace}},
		{"Grafana admin in another namespace", &identity.StaticRequester{Type: authlib.TypeUser, Namespace: "org-3", IsGrafanaAdmin: true, IDToken: "other-token"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store.get = nil
			_, err = rest.(*dashboardREST).Connect(identity.WithRequester(ctx, tc.caller), "snap-1", nil, nil)
			require.NoError(t, err)
			require.NotNil(t, store.get)
		})
	}

	t.Run("anonymous public lookup through the default namespace", func(t *testing.T) {
		store.get = nil
		ctx := k8srequest.WithNamespace(context.Background(), "default")
		ctx = identity.WithRequester(ctx, &identity.StaticRequester{Type: authlib.TypeAnonymous})
		responder := &capturingResponder{}
		handler, err := rest.(*dashboardREST).Connect(ctx, "snap-1", nil, responder)
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
		require.NoError(t, responder.err)
		require.Equal(t, "CPU", responder.obj.(*dashv0.Dashboard).Spec.Object["title"])
		require.NotNil(t, store.get)
		require.Equal(t, namespace, store.get.Resource.Namespace)
	})

	t.Run("inline public lookup through the default namespace", func(t *testing.T) {
		inline := snap.DeepCopy()
		inline.Blobs.Dashboard = nil
		require.NoError(t, setDashboardContent(inline, map[string]any{"title": "CPU"}))
		getter := grafanarest.NewMockStorage(t)
		getter.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*inline}}, nil)
		r, err := NewDashboardREST(getter, nil)
		require.NoError(t, err)
		ctx := k8srequest.WithNamespace(context.Background(), "default")
		ctx = identity.WithRequester(ctx, &identity.StaticRequester{Type: authlib.TypeAnonymous})
		responder := &capturingResponder{}
		handler, err := r.(*dashboardREST).Connect(ctx, "snap-1", nil, responder)
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
		require.NoError(t, responder.err)
		require.Equal(t, "CPU", responder.obj.(*dashv0.Dashboard).Spec.Object["title"])
	})

	// An explicit org namespace must still match the returned snapshot.
	snap.Namespace = "org-3"
	store.get = nil
	_, err = rest.(*dashboardREST).Connect(ctx, "snap-1", nil, nil)
	require.True(t, apierrors.IsNotFound(err))
	require.Nil(t, store.get)
}

func TestLoadDashboardContent(t *testing.T) {
	ctx := context.Background()

	t.Run("reads the blob referenced by blobs.dashboard", func(t *testing.T) {
		store := &fakeBlobStore{value: []byte(`{"title":"CPU","panels":[]}`)}
		snap := newBlobTestSnapshot()
		snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("blob-1")}

		dash, err := loadDashboardContent(ctx, store, snap)

		require.NoError(t, err)
		require.Equal(t, "blob-1", store.get.Uid)
		require.True(t, store.get.MustProxyBytes)
		require.Equal(t, "snap-1", store.get.Resource.Name)
		require.Equal(t, map[string]any{"title": "CPU", "panels": []any{}}, dash)
	})

	t.Run("reads internal legacy inline input", func(t *testing.T) {
		snap := newBlobTestSnapshot()
		dash, err := loadDashboardContent(ctx, nil, snap)
		require.NoError(t, err)
		require.Equal(t, dashboardContentForTest(t, snap), dash)
	})

	t.Run("fails when a reference exists but no blob store is configured", func(t *testing.T) {
		snap := newBlobTestSnapshot()
		snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("blob-1")}

		dash, err := loadDashboardContent(ctx, nil, snap)

		require.Error(t, err)
		require.Nil(t, dash)
	})

	t.Run("preserves attached error details", func(t *testing.T) {
		failure := &resourcepb.ErrorResult{
			Code: http.StatusForbidden, Reason: string(metav1.StatusReasonForbidden), Message: "blob denied",
			Details: &resourcepb.ErrorDetails{Group: dashv0.GROUP, Kind: "snapshots", Name: "snap-1"},
		}
		st, err := status.New(codes.PermissionDenied, failure.Message).WithDetails(failure)
		require.NoError(t, err)
		snap := newBlobTestSnapshot()
		snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("blob-1")}
		store := &fakeBlobStore{checkGet: func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			return nil, st.Err()
		}}

		dash, err := loadDashboardContent(ctx, store, snap)

		require.Nil(t, dash)
		apiStatus, ok := err.(apierrors.APIStatus)
		require.True(t, ok, "expected direct APIStatus, got %T", err)
		require.Equal(t, metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden, Message: failure.Message,
			Details: &metav1.StatusDetails{Group: dashv0.GROUP, Kind: "snapshots", Name: "snap-1"},
		}, apiStatus.Status())
	})

	t.Run("missing streamed blob returns a Kubernetes 404", func(t *testing.T) {
		snap := newBlobTestSnapshot()
		snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("missing")}
		store := &fakeBlobStore{checkGet: func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			return nil, status.Error(codes.NotFound, "blob not found")
		}}

		dash, err := loadDashboardContent(ctx, store, snap)

		require.Nil(t, dash)
		require.True(t, apierrors.IsNotFound(err), "expected Kubernetes 404, got %v", err)
	})

	for _, tc := range []struct {
		name string
		get  func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error)
	}{
		{"transport error", func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			return nil, apierrors.NewServiceUnavailable("blob unavailable")
		}},
		{"storage error", func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			return &resourcepb.GetBlobResponse{}, status.Error(codes.NotFound, "blob not found")
		}},
		{"signed URL", func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			return &resourcepb.GetBlobResponse{Url: "https://example.com/blob"}, nil
		}},
		{"invalid JSON", func(context.Context, *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			return &resourcepb.GetBlobResponse{Value: []byte(`invalid`)}, nil
		}},
	} {
		t.Run("does not fall back to inline dashboard on "+tc.name, func(t *testing.T) {
			snap := newBlobTestSnapshot()
			snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("blob-1")}
			dash, err := loadDashboardContent(ctx, &fakeBlobStore{checkGet: tc.get}, snap)

			require.Error(t, err)
			require.Nil(t, dash)
		})
	}
}
