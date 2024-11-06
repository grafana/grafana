package zanzana

import (
	"context"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	authz.AccessClient
	List(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (*authzextv1.ListResponse, error)

	CheckObject(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error)
	Read(ctx context.Context, namespace string, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error)
	Write(ctx context.Context, namespace string, in *openfgav1.WriteRequest) error
}

func NewNoopClient() *client.NoopClient {
	return client.NewNoop()
}
