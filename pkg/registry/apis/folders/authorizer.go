package folders

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
)

func newAuthorizer(ac authlib.AccessChecker) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
		info, ok := authlib.AuthInfoFrom(ctx)
		if !ok {
			return authorizer.DecisionDeny, "missing auth info", nil
		}

		res, err := ac.Check(ctx, info, authlib.CheckRequest{
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
