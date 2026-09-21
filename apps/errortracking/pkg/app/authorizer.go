package app

import (
	"context"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// GetAuthorizer allows authenticated Grafana users to their own tenant namespace.
// It must be wired into the app installer's GetAuthorizer method — the apiserver
// panics on a nil authorizer for a registered API group.
func GetAuthorizer(accessClient authlib.AccessClient) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			user, err := trustedTenant(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid tenant identity is required", err
			}
			if attr.GetNamespace() != user.GetNamespace() {
				return authorizer.DecisionDeny, "requested namespace does not match tenant identity", nil
			}

			servicePermission := authz.CheckServicePermissions(user, attr.GetAPIGroup(), attr.GetResource(), attr.GetVerb())
			if !servicePermission.Allowed {
				return authorizer.DecisionDeny, "calling service lacks required permissions", nil
			}
			if servicePermission.ServiceCall {
				return authorizer.DecisionAllow, "", nil
			}
			if accessClient == nil {
				return authorizer.DecisionDeny, "user permission checker is not configured", nil
			}
			check, err := accessClient.Check(ctx, user, authlib.CheckRequest{
				Verb:        attr.GetVerb(),
				Group:       attr.GetAPIGroup(),
				Resource:    attr.GetResource(),
				Namespace:   attr.GetNamespace(),
				Name:        attr.GetName(),
				Subresource: attr.GetSubresource(),
				Path:        attr.GetPath(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "user permission check failed", err
			}
			if !check.Allowed {
				return authorizer.DecisionDeny, "user lacks required permissions", nil
			}

			return authorizer.DecisionAllow, "", nil
		},
	)
}
