package resource

import (
	"context"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
)

type staticAuthzClient struct {
	allowed bool
}

// Check implements authz.AccessClient.
func (c *staticAuthzClient) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	return authz.CheckResponse{Allowed: c.allowed}, nil
}

// Compile implements authz.AccessClient.
func (c *staticAuthzClient) Compile(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (authz.ItemChecker, error) {
	return func(namespace string, name, folder string) bool {
		return c.allowed
	}, nil
}

var _ authz.AccessClient = &staticAuthzClient{}
