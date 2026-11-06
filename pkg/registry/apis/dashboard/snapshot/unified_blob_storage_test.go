package snapshot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type snapshotResourceClient struct {
	resourceclient.ResourceClient
	fakeBlobStore
	value  []byte
	writes int
}

func (c *snapshotResourceClient) PutBlob(ctx context.Context, req *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	return c.fakeBlobStore.PutBlob(ctx, req, opts...)
}

func (c *snapshotResourceClient) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest, opts ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	return c.fakeBlobStore.GetBlob(ctx, req, opts...)
}

func (c *snapshotResourceClient) Create(_ context.Context, req *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.writes++
	c.value = req.Value
	return &resourcepb.CreateResponse{ResourceVersion: 1}, nil
}

func (c *snapshotResourceClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	if c.value == nil {
		return nil, status.Error(codes.NotFound, "not found")
	}
	return &resourcepb.ReadResponse{Value: c.value, ResourceVersion: 1}, nil
}

func (c *snapshotResourceClient) List(context.Context, *resourcepb.ListRequest, ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return &resourcepb.ListResponse{Items: []*resourcepb.ResourceWrapper{{Value: c.value, ResourceVersion: 1}}, ResourceVersion: 1}, nil
}

func newSnapshotUnifiedStorage(t *testing.T, client *snapshotResourceClient) grafanarest.Storage {
	t.Helper()
	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	codec := serializer.NewCodecFactory(scheme).LegacyCodec(dashv0.SnapshotResourceInfo.GroupVersion())
	opts := apistore.NewRESTOptionsGetterForClient(client, nil, storagebackend.Config{Codec: codec}, nil, nil)
	opts.RegisterOptions(dashv0.SnapshotResourceInfo.GroupResource(), apistore.StorageOptions{
		EnableInlineBlobs: true, GVK: dashv0.SnapshotResourceInfo.GroupVersionKind(),
	})
	store, err := grafanaregistry.NewRegistryStore(scheme, dashv0.SnapshotResourceInfo, opts)
	require.NoError(t, err)
	t.Cleanup(store.Destroy)
	return NewUnifiedBlobStorage(store)
}

func TestSnapshotGenericInlineCreate(t *testing.T) {
	for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode1, grafanarest.Mode2, grafanarest.Mode3, grafanarest.Mode4} {
		t.Run(fmt.Sprint(mode), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				service := dashboardsnapshots.NewMockService(t)
				if mode != grafanarest.Mode4 {
					service.On("CreateDashboardSnapshot", mock.Anything, mock.MatchedBy(func(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) bool {
						return cmd.Dashboard.Object["title"] == "CPU"
					})).Return(&dashboardsnapshots.DashboardSnapshot{Key: "snap-1", OrgID: 1, Dashboard: simplejson.New()}, nil).Once()
				}
				legacy := &SnapshotLegacyStore{ResourceInfo: dashv0.SnapshotResourceInfo, Service: service, Namespacer: authlib.OrgNamespaceFormatter}
				client := &snapshotResourceClient{fakeBlobStore: fakeBlobStore{putRsp: &resourcepb.PutBlobResponse{Uid: "blob-1", Size: 27, Hash: "server-hash", MimeType: "application/json"}}}
				unified := newSnapshotUnifiedStorage(t, client)
				gr := dashv0.SnapshotResourceInfo.GroupResource()
				cfg := dualwrite.NewFakeConfig()
				cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
				storage, err := dualwrite.ProvideServiceForTests(cfg).NewStorage(gr, legacy, unified)
				require.NoError(t, err)
				ctx := k8srequest.WithNamespace(identity.WithRequester(t.Context(), snapshotCreatorForTest(1)), "default")
				input := newBlobTestSnapshot()
				_, err = storage.Create(ctx, input, nil, &metav1.CreateOptions{})
				require.NoError(t, err)
				synctest.Wait()
				require.Equal(t, 1, client.writes)
				require.NotNil(t, client.put)
				require.Equal(t, 1, client.putCalls)
				require.Equal(t, "snap-1", client.put.Resource.Name)
				require.JSONEq(t, `{"title":"CPU","panels":[]}`, string(client.put.Value))
				var saved dashv0.Snapshot
				require.NoError(t, json.Unmarshal(client.value, &saved))
				require.Equal(t, "blob-1", *saved.Blobs.Dashboard.Uid)
				require.Nil(t, saved.Blobs.Dashboard.Data)
				require.Equal(t, "server-hash", *saved.Blobs.Dashboard.Hash)
				require.EqualValues(t, 27, *saved.Blobs.Dashboard.Size)
				require.NotContains(t, string(client.value), `"data"`)
				require.Equal(t, "CPU", dashboardContentForTest(t, input)["title"])
				read, err := unified.Get(ctx, input.Name, &metav1.GetOptions{})
				require.NoError(t, err)
				require.Nil(t, read.(*dashv0.Snapshot).Blobs.Dashboard.Data)
				dashboard, err := loadDashboardContent(ctx, client, read.(*dashv0.Snapshot))
				require.NoError(t, err)
				require.Equal(t, dashboardContentForTest(t, input), dashboard)
				list, err := unified.List(ctx, &internalversion.ListOptions{})
				require.NoError(t, err)
				items := list.(*dashv0.SnapshotList).Items
				require.Len(t, items, 1)
				require.Equal(t, saved.Blobs, items[0].Blobs)
			})
		})
	}
}

func TestSnapshotInlineUploadFailure(t *testing.T) {
	for _, tc := range []struct {
		name     string
		response *resourcepb.PutBlobResponse
		err      error
	}{
		{"transport", nil, errors.New("upload failed")},
		{"embedded", &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotImplemented}}, nil},
		{"status", nil, status.Error(codes.Unimplemented, "blob store not configured")},
		{"incomplete", &resourcepb.PutBlobResponse{}, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &snapshotResourceClient{fakeBlobStore: fakeBlobStore{putRsp: tc.response, putErr: tc.err}}
			storage := newSnapshotUnifiedStorage(t, client)
			ctx := k8srequest.WithNamespace(identity.WithRequester(t.Context(), snapshotCreatorForTest(1)), "default")
			input := newBlobTestSnapshot()
			_, err := storage.Create(ctx, input, nil, &metav1.CreateOptions{})
			require.Error(t, err)
			require.Zero(t, client.writes)
			require.NotNil(t, input.Blobs.Dashboard.Data)
		})
	}
}

func TestSnapshotInlineDryRun(t *testing.T) {
	for _, invalid := range []bool{false, true} {
		client := &snapshotResourceClient{}
		storage := newSnapshotUnifiedStorage(t, client)
		ctx := k8srequest.WithNamespace(identity.WithRequester(t.Context(), snapshotCreatorForTest(1)), "default")
		input := newBlobTestSnapshot()
		input.Annotations = map[string]string{"kubectl.kubernetes.io/last-applied-configuration": "private"}
		if invalid {
			input.Blobs.Dashboard.Data = new("")
		}
		out, err := storage.Create(ctx, input, nil, &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}})
		if invalid {
			require.Error(t, err)
		} else {
			require.NoError(t, err)
			require.Nil(t, out.(*dashv0.Snapshot).Blobs.Dashboard)
			require.NotContains(t, out.(*dashv0.Snapshot).Annotations, "kubectl.kubernetes.io/last-applied-configuration")
		}
		require.Nil(t, client.put)
		require.Zero(t, client.writes)
		require.NotNil(t, input.Blobs.Dashboard.Data)
		require.Contains(t, input.Annotations, "kubectl.kubernetes.io/last-applied-configuration")
	}
}
