package client

import (
	"context"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func NewNoopZanzanaClient() *NoopZanzanaClient {
	return &NoopZanzanaClient{}
}

type NoopZanzanaClient struct{}

func (nc NoopZanzanaClient) Check(ctx context.Context, caller claims.AuthInfo, req *authzlib.CheckRequest) (authzlib.CheckResponse, error) {
	return authzlib.CheckResponse{}, nil
}

func (nc NoopZanzanaClient) List(ctx context.Context, caller claims.AuthInfo, req *zanzana.ListRequest) ([]string, error) {
	return []string{}, nil
}

func NewNoopOpenFGAClient() *NoopOpenFGAClient {
	return &NoopOpenFGAClient{}
}

type NoopOpenFGAClient struct{}

func (nc NoopOpenFGAClient) Check(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error) {
	return nil, nil
}

func (nc NoopOpenFGAClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	return nil, nil
}

func (nc NoopOpenFGAClient) Read(ctx context.Context, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	return nil, nil
}

func (nc NoopOpenFGAClient) Write(ctx context.Context, in *openfgav1.WriteRequest) error {
	return nil
}
