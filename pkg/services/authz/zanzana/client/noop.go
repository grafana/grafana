package client

import (
	"context"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

var _ authz.AccessClient = (*NoopClient)(nil)

func NewNoop() *NoopClient {
	return &NoopClient{}
}

type NoopClient struct{}

func (nc *NoopClient) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	return authz.CheckResponse{}, nil
}

func (nc *NoopClient) Compile(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (authz.ItemChecker, error) {
	return nil, nil
}

func (nc *NoopClient) List(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (*authzextv1.ListResponse, error) {
	return nil, nil
}

func (nc NoopClient) Read(ctx context.Context, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	return nil, nil
}

func (nc NoopClient) Write(ctx context.Context, in *openfgav1.WriteRequest) error {
	return nil
}
