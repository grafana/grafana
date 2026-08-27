package appplugin

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

var _ v3.ClientV3 = (*clientWrapper)(nil)

// clientWrapper resolves the plugin's v3 client on each call, because the backend
// may not have started yet when the API builder is constructed.
type clientWrapper struct {
	loader v3.ClientV3Loader
	id     string
}

func (c *clientWrapper) resolve(ctx context.Context, service string) (v3.ClientV3, error) {
	client, ok := c.loader.ClientV3(ctx, c.id)
	if !ok {
		return nil, errors.NewServiceUnavailable(
			fmt.Sprintf("the plugin backend does not implement the v3 %s service", service))
	}
	return client, nil
}

func (c *clientWrapper) AdmissionReview(ctx context.Context, in *pluginv3.AdmissionReviewRequest, opts ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	client, err := c.resolve(ctx, "admission")
	if err != nil {
		return nil, err
	}
	return client.AdmissionReview(ctx, in, opts...)
}

func (c *clientWrapper) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	client, err := c.resolve(ctx, "route")
	if err != nil {
		return nil, err
	}
	return client.CallRoute(ctx, in, opts...)
}

func (c *clientWrapper) ConvertObjects(ctx context.Context, in *pluginv3.ConvertObjectsRequest, opts ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	client, err := c.resolve(ctx, "conversion")
	if err != nil {
		return nil, err
	}
	return client.ConvertObjects(ctx, in, opts...)
}
