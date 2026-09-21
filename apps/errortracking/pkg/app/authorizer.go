package app

import (
	"context"

	"github.com/grafana/authlib/authz"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// GetAuthorizer allows authenticated callers with the required service permission
// to access their own tenant namespace.
// It must be wired into the app installer's GetAuthorizer method — the apiserver
// panics on a nil authorizer for a registered API group.
func GetAuthorizer() authorizer.Authorizer {
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
			return authorizer.DecisionAllow, "", nil
		},
	)
}
