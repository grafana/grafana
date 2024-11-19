package resource

import (
	"context"
	"fmt"

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

type resourceGroup map[string]map[string]interface{}

// authzLimitedClient is a client that enforces RBAC for the limited number of groups and resources.
// This is a temporary solution until the authz service is fully implemented.
// The authz service will be responsible for enforcing RBAC.
// For now, it makes one call to the authz service for each list items. This is known to be inefficient.
type authzLimitedClient struct {
	client authz.AccessChecker
	// whitelist is a map of group to resources that are compatible with RBAC.
	whitelist resourceGroup
}

// NewAuthzLimitedClient creates a new authzLimitedClient.
func NewAuthzLimitedClient(client authz.AccessChecker) authz.AccessClient {
	return &authzLimitedClient{
		client: client,
		whitelist: resourceGroup{
			"dashboard.grafana.app": map[string]interface{}{"dashboards": nil},
			"folder.grafana.app":    map[string]interface{}{"folders": nil},
		},
	}
}

// Check implements authz.AccessClient.
func (c authzLimitedClient) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		return authz.CheckResponse{Allowed: true}, nil
	}
	return c.client.Check(ctx, id, req)
}

// Compile implements authz.AccessClient.
func (c authzLimitedClient) Compile(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (authz.ItemChecker, error) {
	return func(namespace string, name, folder string) bool {
		// TODO: Implement For now we perform the check for each item.
		if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
			return true
		}
		fmt.Println("TODO: Implement authzLimitedClient.Compile")
		r, err := c.client.Check(ctx, id, authz.CheckRequest{
			Verb:      "get",
			Group:     req.Group,
			Resource:  req.Resource,
			Namespace: namespace,
			Name:      name,
			Folder:    folder,
		})
		if err != nil {
			return false
		}
		return r.Allowed
	}, nil
}

func (c authzLimitedClient) IsCompatibleWithRBAC(group, resource string) bool {
	if _, ok := c.whitelist[group]; ok {
		if _, ok := c.whitelist[group][resource]; ok {
			return true
		}
	}
	return false
}

var _ authz.AccessClient = &authzLimitedClient{}
