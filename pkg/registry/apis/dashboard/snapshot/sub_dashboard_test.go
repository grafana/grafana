package snapshot

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc/metadata"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	authnlib "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type snapshotBlobServer struct {
	resourcepb.UnimplementedBlobStoreServer
	get      *resourcepb.GetBlobRequest
	metadata metadata.MD
}

func (s *snapshotBlobServer) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	s.get = req
	s.metadata, _ = metadata.FromIncomingContext(ctx)
	return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
}

func TestPublicSnapshotDashboardRemoteClient(t *testing.T) {
	const namespace = "org-2"
	for _, tc := range []struct {
		name   string
		caller *identity.StaticRequester
	}{
		{name: "no caller"},
		{name: "anonymous without namespace", caller: &identity.StaticRequester{Type: authlib.TypeAnonymous}},
		{name: "anonymous in snapshot namespace", caller: &identity.StaticRequester{Type: authlib.TypeAnonymous, Namespace: namespace}},
		{name: "cross-org user", caller: &identity.StaticRequester{Type: authlib.TypeUser, Namespace: "org-3", IDToken: "other-token"}},
		{name: "same-org user", caller: &identity.StaticRequester{Type: authlib.TypeUser, Namespace: namespace, IDToken: "caller-token"}},
		{name: "same-org user without token", caller: &identity.StaticRequester{Type: authlib.TypeUser, Namespace: namespace}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &snapshotBlobServer{}
			channel := &inprocgrpc.Channel{}
			channel.RegisterService(&resourcepb.BlobStore_ServiceDesc, server)
			client, err := resourceclient.NewRemoteResourceClient(noop.NewTracerProvider().Tracer("snapshot-test"), channel, channel, resourceclient.RemoteResourceClientConfig{
				TokenExchanger:        authnlib.NewStaticTokenExchanger("service-token"),
				RequireCallerIdentity: func(context.Context) bool { return true },
				OnBehalfOf:            func(context.Context) bool { return false },
			})
			require.NoError(t, err)
			snap := newBlobTestSnapshot()
			snap.Namespace = namespace
			snap.Spec.Dashboard = nil
			snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: "blob-1"}
			// Only blob-read credentials are exercised here. The initial snapshot lookup
			// is mocked and can still reject anonymous callers under strict identity enforcement.
			getter := grafanarest.NewMockStorage(t)
			getter.On("Get", mock.Anything, snap.Name, mock.Anything).Return(snap, nil)
			r, err := NewDashboardREST(getter, client)
			require.NoError(t, err)
			ctx := k8srequest.WithNamespace(t.Context(), "default")
			if tc.caller != nil {
				ctx = identity.WithRequester(ctx, tc.caller)
			}
			responder := &capturingResponder{}
			handler, err := r.(*dashboardREST).Connect(ctx, snap.Name, nil, responder)
			require.NoError(t, err)
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
			require.NoError(t, responder.err)
			require.Equal(t, "CPU", responder.obj.(*dashv0.Dashboard).Spec.Object["title"])
			require.Equal(t, snapshotBlobKey(snap), server.get.Resource)
			require.Equal(t, "blob-1", server.get.Uid)
			require.True(t, server.get.MustProxyBytes)
			require.Equal(t, []string{"service-token"}, server.metadata.Get("x-access-token"))
			require.Empty(t, server.metadata.Get("x-id-token"))
		})
	}
}
