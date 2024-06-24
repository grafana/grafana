package zanzana

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/log"
)

// Client is a wrapper around OpenFGAServiceClient with only methods using in Grafana included.
type Client interface {
	Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error)
}

type zanzanaClient struct {
	client openfgav1.OpenFGAServiceClient
	logger log.Logger
}

func NewClient(cc grpc.ClientConnInterface) Client {
	return &zanzanaClient{
		client: openfgav1.NewOpenFGAServiceClient(cc),
		logger: log.New("zanzana-client"),
	}
}

func (c *zanzanaClient) Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error) {
	return c.client.Check(ctx, in, opts...)
}

func (c *zanzanaClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error) {
	return c.client.ListObjects(ctx, in, opts...)
}

type NoopClient struct{}

func (nc NoopClient) Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error) {
	return nil, nil
}

func (nc NoopClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error) {
	return nil, nil
}
