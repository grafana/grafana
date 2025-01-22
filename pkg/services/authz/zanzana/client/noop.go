package client

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var _ authlib.AccessClient = (*NoopClient)(nil)

func NewNoop() *NoopClient {
	return &NoopClient{}
}

type NoopClient struct{}

func (nc *NoopClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (nc *NoopClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, error) {
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
