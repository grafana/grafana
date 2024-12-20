package client

import (
	"context"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
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

func (nc NoopClient) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	return nil, nil
}

func (nc NoopClient) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	return nil
}

func (nc NoopClient) BatchCheck(ctx context.Context, req *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error) {
	return nil, nil
}
