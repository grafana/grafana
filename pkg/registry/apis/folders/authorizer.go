package folders

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// newMultiTenantAuthorizer creates an authorizer suitable to multi-tenant setup.
// For now it only allow authorization of access tokens.
func newAuthorizer(ac types.AccessClient) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
		info, ok := types.AuthInfoFrom(ctx)
		if !ok {
			return authorizer.DecisionDeny, "missing auth info", nil
		}

		// Check grafana admin
		user, _ := identity.GetRequester(ctx)
		if user != nil && user.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "", nil
		}

		// For now we only allow access policy to authorize with multi-tenant setup
		if !types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy) {
			return authorizer.DecisionDeny, "permission denied", nil
		}

		res, err := ac.Check(ctx, info, types.CheckRequest{
			Verb:        a.GetVerb(),
			Group:       a.GetAPIGroup(),
			Resource:    a.GetResource(),
			Name:        a.GetName(),
			Namespace:   a.GetNamespace(),
			Subresource: a.GetSubresource(),
		})

		if err != nil {
			return authorizer.DecisionDeny, "failed to perform authorization", err
		}

		if !res.Allowed {
			return authorizer.DecisionDeny, "permission denied", nil
		}

		return authorizer.DecisionAllow, "", nil
	})
}
