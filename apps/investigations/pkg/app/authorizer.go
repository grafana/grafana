package app

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

const ActionDatasourcesExplore = "datasources:explore"

func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		u, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}

		p := u.GetPermissions()
		if len(p) == 0 {
			return authorizer.DecisionDeny, "no permissions", nil
		}

		_, ok := p[ActionDatasourcesExplore]
		if !ok {
			// defer to the default authorizer if datasources:explore is not present
			return authorizer.DecisionNoOpinion, "", nil
		}

		return authorizer.DecisionAllow, "", nil
	})
}
