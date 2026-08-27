package v3

import (
	"context"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// Lazy client resolves the client before each request
func NewLazyClient(loader ClientV3Loader, id string) ClientV3 {
	return &lazyClient{loader, id}
}

type lazyClient struct {
	loader ClientV3Loader
	id     string
}

func (c *lazyClient) resolve(ctx context.Context) (ClientV3, error) {
	client, ok := c.loader.ClientV3(ctx, c.id)
	if !ok {
		return nil, errors.NewServiceUnavailable(
			"the plugin backend does not implement ClientV3")
	}
	return client, nil
}

// AdmissionReview implements [ClientV3].
func (c *lazyClient) AdmissionReview(ctx context.Context, in *pluginv3.AdmissionReviewRequest, opts ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	v, err := c.resolve(ctx)
	if err != nil {
		return nil, err
	}
	return v.AdmissionReview(ctx, in, opts...)
}

// CallRoute implements [ClientV3].
func (c *lazyClient) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	v, err := c.resolve(ctx)
	if err != nil {
		return nil, err
	}
	return v.CallRoute(ctx, in, opts...)
}

// ConvertObjects implements [ClientV3].
func (c *lazyClient) ConvertObjects(ctx context.Context, in *pluginv3.ConvertObjectsRequest, opts ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	v, err := c.resolve(ctx)
	if err != nil {
		return nil, err
	}
	return v.ConvertObjects(ctx, in, opts...)
}
