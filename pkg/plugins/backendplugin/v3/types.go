package v3

import (
	"context"

	"google.golang.org/grpc"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin-next/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-app-sdk/plugin-next/grpcplugin"
)

// ClientV3 implements all required functions in the V3 interface.
// This is currently a stub, and will evolve as the V3 interface get exercised with real usage
//
// V2 and V3 both share the same distribution+packaging methods, however in V3, we:
// 1. All implementations are required to be multi-tenant safe
// 2. No requests contain pluginContext (the root plugin configuration)
// 3. The v3 client does not include the expansive middleware that exists for v2
type ClientV3 interface {
	pluginv3.AdmissionServiceClient
	pluginv3.ConversionServiceClient
	pluginv3.RouteServiceClient
}

// ClientV3Loader looks up the ClientV3 for a plugin by ID, waiting for the plugin
// registry to finish loading if necessary.
type ClientV3Loader interface {
	ClientV3(ctx context.Context, pluginID string) (ClientV3, bool)
}

type sdkClient struct {
	client *grpcplugin.ClientV3
}

func NewClientFromSDK(client *grpcplugin.ClientV3) ClientV3 {
	return &sdkClient{client}
}

// AdmissionReview implements [ClientV3].
func (s *sdkClient) AdmissionReview(ctx context.Context, in *pluginv3.AdmissionReviewRequest, opts ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	return s.client.AdmissionReview(ctx, in, opts...)
}

// ConvertObjects implements [ClientV3].
func (s *sdkClient) ConvertObjects(ctx context.Context, in *pluginv3.ConvertObjectsRequest, opts ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	return s.client.ConvertObjects(ctx, in, opts...)
}

// CallRoute implements [ClientV3].
func (s *sdkClient) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return s.client.CallRoute(ctx, in, opts...)
}
