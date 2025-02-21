package app

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		l := log.New("advisor.authorizer")
		l.Info("GetAuthorizer", "attr", attr)
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// require a user
		u, err := identity.GetRequester(ctx)
		l.Info("GetAuthorizer", "user", u, "err", err)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}

		l.Info("IsAdmin", "isAdmin", u.GetIsGrafanaAdmin())
		l.Info("IsAPIKey", "uid", u.GetUID(), "email", u.GetEmail())
		// check if is admin
		if u.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "", nil
		}

		return authorizer.DecisionDeny, "forbidden", nil
	})
}
