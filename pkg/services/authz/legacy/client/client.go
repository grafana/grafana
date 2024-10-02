package client

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc"
)

type CheckRequest struct {
	// Namespace is either `org-<id>` or `stacks-<id>`.
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

	// Parents are a list of uid:s for folders that the object belongs to.
	Parents []string
}

type CheckResponse struct {
	Allowed bool
}

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
	var object string

	if r.Resource != "" && r.Attr != "" && r.Name != "" {
		object = formatObject(r.Resource, r.Attr, r.Name)
	}

	contextual := &openfgav1.ContextualTupleKeys{}
	for _, p := range r.Parents {
		contextual.TupleKeys = append(
			contextual.TupleKeys,
			&openfgav1.TupleKey{
				User:     formatObject(r.Resource, r.Attr, r.Name),
				Relation: "parent",
				Object:   formatObject("folders", "uid", p),
			},
		)
	}

	res, err := c.inner.Check(ctx, &openfgav1.CheckRequest{
		StoreId: r.Namespace,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.Subject,
			Relation: r.Action,
			Object:   object,
		},
		ContextualTuples: contextual,
	})

	if err != nil {
		return nil, err
	}

	return &CheckResponse{Allowed: res.Allowed}, nil
}

func formatObject(resource, attr, name string) string {
	return fmt.Sprintf("%s:%s:%s", resource, attr, name)
}
