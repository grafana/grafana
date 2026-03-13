package appplugin

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	pluginaccesscontrol "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func (b *AppPluginAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}
			scope := pluginaccesscontrol.ScopeProvider.GetResourceScope(b.pluginID)
			// Authorize the caller using the same permission as the legacy endpoint:
			//   ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, plugins:id:<pluginID>)
			ok, err := b.accessControl.Evaluate(ctx, user, ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, scope))
			if err != nil {
				return authorizer.DecisionDeny, "authorization check failed", err
			}
			if !ok {
				return authorizer.DecisionDeny, "access denied", nil
			}
			return authorizer.DecisionAllow, "", nil
		},
	)
}
