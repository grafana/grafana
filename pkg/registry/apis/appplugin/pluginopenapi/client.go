package pluginopenapi

import (
	"context"

	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ v3.ClientV3 = offlineClientV3{}

// offlineClientV3 stands in for the plugin backend. A kind that declares
// admission capabilities is refused a nil client, and the spec describes the
// custom routes this client would serve, so it has to exist -- but rendering a
// spec never starts the plugin.
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

// offlineSearchClient stands in for the search index. The kinds that serve
// /search and /trash are described only when a plugin's API server has an index
// client, so rendering needs one to describe them -- but nothing here is asked
// a question.
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
