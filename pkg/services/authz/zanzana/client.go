package zanzana

import (
	"context"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// OpenFGAClient is a wrapper around [openfgav1.OpenFGAServiceClient]
type OpenFGAClient interface {
	Check(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error)
	Write(ctx context.Context, in *openfgav1.WriteRequest) error
}

type ZanzanaClient interface {
	authzlib.Client
	List(ctx context.Context, caller claims.AuthInfo, req *ListRequest) ([]string, error)
}

type ListRequest struct {
	// The namespace in which the request is made (e.g. "stacks-12")
	Namespace string
	// The requested action (e.g. "dashboards:read")
	Action string
	// ~Kind eg dashboards
	Resource string
}
