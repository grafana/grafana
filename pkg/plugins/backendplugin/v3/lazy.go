package v3

import (
	"context"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/api/errors"

	clientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// ClientV3Loader returns a plugin's v3 client once the registry has loaded it.
type ClientV3Loader interface {
	ClientV3(ctx context.Context, pluginID string) (clientv3.Client, bool)
}

// Lazy client resolves the client before each request
func NewLazyClient(loader ClientV3Loader, id string) clientv3.Client {
	return &lazyClient{loader, id}
}

type lazyClient struct {
	loader ClientV3Loader
	id     string
}

func (c *lazyClient) resolve(ctx context.Context) (clientv3.Client, error) {
	client, ok := c.loader.ClientV3(ctx, c.id)
	if !ok {
		return nil, errors.NewServiceUnavailable(
			"the plugin backend does not implement ClientV3")
	}
	return client, nil
}

// AdmissionReview implements [ClientV3].
func (c *lazyClient) AdmissionReview(ctx context.Context, in *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	v, err := c.resolve(ctx)
	if err != nil {
		return nil, err
	}
	return v.AdmissionReview(ctx, in)
}

// CallRoute implements [ClientV3].
func (c *lazyClient) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	v, err := c.resolve(ctx)
	if err != nil {
		return nil, err
	}
	return v.CallRoute(ctx, in)
}

// ConvertObjects implements [ClientV3].
func (c *lazyClient) ConvertObjects(ctx context.Context, in *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	v, err := c.resolve(ctx)
	if err != nil {
		return nil, err
	}
	return v.ConvertObjects(ctx, in)
}
