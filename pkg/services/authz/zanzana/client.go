package zanzana

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// OpenFGAClient is a wrapper around [openfgav1.OpenFGAServiceClient]
type OpenFGAClient interface {
	Check(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error)
	Write(ctx context.Context, in *openfgav1.WriteRequest) error
}
