package pluginopenapi

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"

	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ v3.ClientV3 = offlineClientV3{}

// offlineClientV3 satisfies dependencies used by admission, conversion, and
// custom routes without starting the plugin backend.
type offlineClientV3 struct{}

func (offlineClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest, ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	return nil, errOffline
}

func (offlineClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest, ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return nil, errOffline
}

func (offlineClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest, ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	return nil, errOffline
}

var errOffline = apierrors.NewServiceUnavailable("the plugin backend is not running")

var _ resourcepb.ResourceIndexClient = offlineSearchClient{}
var _ resourcepb.ResourceStoreClient = offlineStoreClient{}

// offlineStoreClient allows list-keys routes to be registered without connecting
// to the resource store.
type offlineStoreClient struct{}

func (offlineStoreClient) Read(context.Context, *resourcepb.ReadRequest, ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return nil, errOffline
}

func (offlineStoreClient) Create(context.Context, *resourcepb.CreateRequest, ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	return nil, errOffline
}

func (offlineStoreClient) Update(context.Context, *resourcepb.UpdateRequest, ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	return nil, errOffline
}

func (offlineStoreClient) Delete(context.Context, *resourcepb.DeleteRequest, ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	return nil, errOffline
}

func (offlineStoreClient) List(context.Context, *resourcepb.ListRequest, ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return nil, errOffline
}

func (offlineStoreClient) Watch(context.Context, *resourcepb.WatchRequest, ...grpc.CallOption) (resourcepb.ResourceStore_WatchClient, error) {
	return nil, errOffline
}

func (offlineStoreClient) ListStoredResources(context.Context, *resourcepb.ListStoredResourcesRequest, ...grpc.CallOption) (*resourcepb.ListStoredResourcesResponse, error) {
	return nil, errOffline
}

// offlineSearchClient allows search and trash routes to be registered without
// connecting to the search index.
type offlineSearchClient struct{}

func (offlineSearchClient) Search(context.Context, *resourcepb.ResourceSearchRequest, ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return nil, errOffline
}

func (offlineSearchClient) GetStats(context.Context, *resourcepb.ResourceStatsRequest, ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, errOffline
}

func (offlineSearchClient) RebuildIndexes(context.Context, *resourcepb.RebuildIndexesRequest, ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, errOffline
}

func (offlineSearchClient) VectorSearch(context.Context, *resourcepb.VectorSearchRequest, ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, errOffline
}

func (offlineSearchClient) HybridSearch(context.Context, *resourcepb.HybridSearchRequest, ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return nil, errOffline
}

var _ appplugin.PluginClient = offlinePluginClient{}
var _ appplugin.PluginContextWrapper = offlinePluginContext{}

type offlinePluginClient struct{}

func (offlinePluginClient) CheckHealth(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, errOffline
}

func (offlinePluginClient) CallResource(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender) error {
	return errOffline
}

type offlinePluginContext struct{}

func (offlinePluginContext) PluginContextForApp(ctx context.Context, _ string, _ *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
	return ctx, backend.PluginContext{}, errOffline
}
