package zanzana

import (
	"context"

	"google.golang.org/grpc"

	authlib "github.com/grafana/authlib/types"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
)

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	authlib.AccessClient
	Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error)
	Write(ctx context.Context, req *authzextv1.WriteRequest) error
	BatchCheck(ctx context.Context, req *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error)
}

func NewClient(cc grpc.ClientConnInterface) (*client.Client, error) {
	return client.New(cc)
}

func NewNoopClient() *client.NoopClient {
	return client.NewNoop()
}
