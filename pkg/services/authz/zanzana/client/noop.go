package client

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func NewNoop() *NoopOpenFGAClient {
	return &NoopOpenFGAClient{}
}

type NoopOpenFGAClient struct{}

func (nc NoopOpenFGAClient) Check(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error) {
	return nil, nil
}

func (nc NoopOpenFGAClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	return nil, nil
}

func (nc NoopOpenFGAClient) Write(ctx context.Context, in *openfgav1.WriteRequest) error {
	return nil
}
