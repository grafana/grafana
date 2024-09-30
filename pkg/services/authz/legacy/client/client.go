package client

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc"
)

type CheckRequest struct {
	Namespace string

	// Subject is the typed identity we want to perform a check for
	Subject string

	// Action to check access for
	Action string

	// Resource is ~Kind eg dashboards
	Resource string
	// Attribute used to store permission
	Attr string
	// Name is the identifier for the resource.
	// In grafana, this was historically called "UID", but in k8s, it is the name
	Name string

	// Contextuals are additional resource + name that should be checked.
	// E.g. for dashboards this can be the folder that a it belong to.
	Contextuals []Contextual
}

type Contextual struct {
	// Resource is ~Kind eg dashboards
	Resource string
	// Attribute used to store permission
	Attr string
	// Name is the identifier for the resource.
	// In grafana, this was historically called "UID", but in k8s, it is the name
	Name string
}

type CheckResponse struct {
	Allowed bool
}

// FIME: this is the "new" client interface?
type ReadClient interface {
	Check(ctx context.Context, r CheckRequest) (*CheckResponse, error)
}

var _ ReadClient = (*Client)(nil)

func NewClient(cc grpc.ClientConnInterface) *Client {
	return &Client{
		inner: openfgav1.NewOpenFGAServiceClient(cc),
	}
}

type Client struct {
	inner openfgav1.OpenFGAServiceClient
}

func (c *Client) Check(ctx context.Context, r CheckRequest) (*CheckResponse, error) {
	res, err := c.inner.Check(ctx, &openfgav1.CheckRequest{
		StoreId: r.Namespace,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.Subject,
			Relation: r.Action,
			Object:   fmt.Sprintf("%s:%s:%s", r.Resource, r.Attr, r.Name),
		},
		ContextualTuples: &openfgav1.ContextualTupleKeys{},
	})

	if err != nil {
		return nil, err
	}

	return &CheckResponse{
		Allowed: res.Allowed,
	}, nil
}
