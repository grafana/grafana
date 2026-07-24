package authorizer

import (
	"context"
	"errors"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// Use this only when user authorization is not needed as it's performed downstream (e.g. in the UniStore).
// This authorizer makes a final decision based on the service permissions only, it does not consider the user permissions.
func NewServiceAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			ident, ok := types.AuthInfoFrom(ctx)
			if !ok {
				return authorizer.DecisionDeny, "", errors.New("no identity found for request")
			}

			res := authzlib.CheckServicePermissions(ident, attr.GetAPIGroup(), attr.GetResource(), attr.GetVerb())
			if !res.Allowed {
				log := logging.FromContext(ctx)
				log.Info("calling service lacks required permissions",
					"isServiceCall", res.ServiceCall,
					"apiGroup", attr.GetAPIGroup(),
					"resource", attr.GetResource(),
					"verb", attr.GetVerb(),
					"permissions", len(res.Permissions),
				)
				return authorizer.DecisionDeny, "calling service lacks required permissions", nil
			}

			return authorizer.DecisionAllow, "", nil
		},
	)
}
