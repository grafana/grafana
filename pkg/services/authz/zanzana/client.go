package zanzana

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	authlib.AccessClient
	List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error)
	Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error)
	Write(ctx context.Context, req *authzextv1.WriteRequest) error

	Mutate(ctx context.Context, req *authzextv1.MutateRequest) error
	Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error)
}
