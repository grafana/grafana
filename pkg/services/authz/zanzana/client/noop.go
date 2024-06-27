package client

import (
	"context"

	"google.golang.org/grpc"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func NewNoop() *NoopClient {
	return &NoopClient{}
}

type NoopClient struct{}

func (nc NoopClient) Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error) {
	return nil, nil
}

func (nc NoopClient) ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error) {
	return nil, nil
}
