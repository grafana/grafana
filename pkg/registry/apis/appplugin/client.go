package appplugin

import (
	"context"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

var _ v3.ClientV3 = (*clientWrapper)(nil)

// lazy loaded wrapper
type clientWrapper struct {
	loader v3.ClientV3Loader
	id     string
}

// AdmissionReview implements [v3.ClientV3].
func (c *clientWrapper) AdmissionReview(ctx context.Context, in *pluginv3.AdmissionReviewRequest, opts ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	client, ok := c.loader.ClientV3(ctx, c.id)
	if !ok {
		return nil, errors.NewServiceUnavailable(
			"the plugin backend does not implement the v3 route service (AdmissionReview)")
	}
	return client.AdmissionReview(ctx, in, opts...)
}

// CallRoute implements [v3.ClientV3].
func (c *clientWrapper) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	client, ok := c.loader.ClientV3(ctx, c.id)
	if !ok {
		return nil, errors.NewServiceUnavailable(
			"the plugin backend does not implement the v3 route service (CallRoute)")
	}
	return client.CallRoute(ctx, in, opts...)
}

// ConvertObjects implements [v3.ClientV3].
func (c *clientWrapper) ConvertObjects(ctx context.Context, in *pluginv3.ConvertObjectsRequest, opts ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	client, ok := c.loader.ClientV3(ctx, c.id)
	if !ok {
		return nil, errors.NewServiceUnavailable(
			"the plugin backend does not implement the v3 route service (ConvertObjects)")
	}
	return client.ConvertObjects(ctx, in, opts...)
}
