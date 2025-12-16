package zanzana

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	authlib.AccessClient
	Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error)
	Write(ctx context.Context, req *authzextv1.WriteRequest) error
	BatchCheck(ctx context.Context, req *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error)

	Mutate(ctx context.Context, req *authzextv1.MutateRequest) error
	Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error)
}
