package snapshot

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type publicSnapshotStore struct {
	resourcepb.UnimplementedResourceStoreServer
	resourcepb.UnimplementedBlobStoreServer
	reads        []*resourcepb.ReadRequest
	readMetadata []metadata.MD
	blobMetadata []metadata.MD
}

func (s *publicSnapshotStore) Read(ctx context.Context, req *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	s.readMetadata = append(s.readMetadata, md)
	s.reads = append(s.reads, req)
	if req.Key.Resource != "snapshots" || req.Key.Namespace != "org-2" || req.Key.Name != "public-key" ||
		len(md.Get("x-access-token")) != 1 || md.Get("x-access-token")[0] != "service-token" || len(md.Get("x-id-token")) != 0 {
		return nil, status.Error(codes.PermissionDenied, "out of scope")
	}
	return &resourcepb.ReadResponse{Value: []byte(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Snapshot","metadata":{"name":"public-key","namespace":"org-2"},"spec":{"deleteKey":"secret"},"blobs":{"dashboard":{"uid":"blob-1"}}}`)}, nil
}

func (s *publicSnapshotStore) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	s.blobMetadata = append(s.blobMetadata, md)
	return &resourcepb.GetBlobResponse{Value: []byte(`{"title":"CPU"}`)}, nil
}

// Adapt the production apistore storage interface to the Kubernetes REST getter.
// The metadata read still passes through the real apistore and remote gRPC client.
type remoteSnapshotGetter struct{ store storage.Interface }

func (g remoteSnapshotGetter) New() runtime.Object { return &dashv0.Snapshot{} }
func (g remoteSnapshotGetter) Destroy()            {}
func (g remoteSnapshotGetter) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	var snap dashv0.Snapshot
	key := "/group/" + dashv0.GROUP + "/resource/snapshots/namespace/" + k8srequest.NamespaceValue(ctx) + "/name/" + name
	if err := g.store.Get(ctx, key, storage.GetOptions{}, &snap); err != nil {
		return nil, err
	}
	return &snap, nil
}

func TestPublicSnapshotMetadataWithStandaloneRemoteClient(t *testing.T) {
	for _, endpoint := range []string{"snapshot", "dashboard"} {
		t.Run(endpoint, func(t *testing.T) {
			server := &publicSnapshotStore{}
			channel := &inprocgrpc.Channel{}
			channel.RegisterService(&resourcepb.ResourceStore_ServiceDesc, server)
			channel.RegisterService(&resourcepb.BlobStore_ServiceDesc, server)
			client, err := resourceclient.NewStandaloneRemoteResourceClient(noop.NewTracerProvider().Tracer("snapshot-test"), channel, channel, resourceclient.RemoteResourceClientConfig{
				TokenExchanger: authn.NewStaticTokenExchanger("service-token"),
			})
			require.NoError(t, err)
			scheme := runtime.NewScheme()
			require.NoError(t, dashv0.AddToScheme(scheme))
			config := storagebackend.NewDefaultConfig("", serializer.NewCodecFactory(scheme).LegacyCodec(dashv0.GroupVersion))
			store, destroy, err := apistore.NewStorage(
				config.ForResource(dashv0.SnapshotResourceInfo.GroupResource()), client, nil, nil,
				func() runtime.Object { return &dashv0.Snapshot{} },
				func() runtime.Object { return &dashv0.SnapshotList{} },
				storage.DefaultNamespaceScopedAttr, nil, nil, nil, apistore.StorageOptions{},
			)
			require.NoError(t, err)
			t.Cleanup(destroy)
			getter := remoteSnapshotGetter{store: store}
			// Use a concrete namespace to exercise direct metadata reads; default resolves keys through LIST.
			ctx := identity.WithRequester(k8srequest.WithNamespace(t.Context(), "org-2"), &identity.StaticRequester{Type: authlib.TypeAnonymous})
			// Strict enforcement rejects the unmodified anonymous metadata lookup.
			_, err = getter.Get(ctx, "public-key", &metav1.GetOptions{})
			require.Error(t, err)
			require.Empty(t, server.reads)

			if endpoint == "snapshot" {
				wrapped := NewStorageWrapper(getter, dashv0.SnapshotSharingOptions{}, nil, client).(*storageWrapper)
				obj, err := wrapped.Get(ctx, "public-key", &metav1.GetOptions{})
				require.NoError(t, err)
				require.Equal(t, "public-key", obj.(*dashv0.Snapshot).Name)
				require.Nil(t, obj.(*dashv0.Snapshot).Spec.DeleteKey)
			} else {
				r, err := NewDashboardREST(getter, client)
				require.NoError(t, err)
				responder := &capturingResponder{}
				handler, err := r.(*dashboardREST).Connect(ctx, "public-key", nil, responder)
				require.NoError(t, err)
				handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
				require.NoError(t, responder.err)
				require.Equal(t, "CPU", responder.obj.(*dashv0.Dashboard).Spec.Object["title"])
				require.Equal(t, []string{"service-token"}, server.blobMetadata[0].Get("x-access-token"))
			}
			require.Len(t, server.reads, 1)
			require.Equal(t, "org-2", server.reads[0].Key.Namespace)
			require.Equal(t, []string{"service-token"}, server.readMetadata[0].Get("x-access-token"))
			require.Empty(t, server.readMetadata[0].Get("x-id-token"))

			// An explicitly different namespace cannot reuse the public GET delegation.
			other := identity.WithRequester(k8srequest.WithNamespace(t.Context(), "org-3"), &identity.StaticRequester{Type: authlib.TypeAnonymous})
			if endpoint == "snapshot" {
				wrapped := NewStorageWrapper(getter, dashv0.SnapshotSharingOptions{}, nil, client).(*storageWrapper)
				_, err = wrapped.Get(other, "public-key", &metav1.GetOptions{})
			} else {
				r, _ := NewDashboardREST(getter, client)
				_, err = r.(*dashboardREST).Connect(other, "public-key", nil, &capturingResponder{})
			}
			require.Error(t, err)
			require.Equal(t, "org-3", server.reads[1].Key.Namespace)
		})
	}
}
