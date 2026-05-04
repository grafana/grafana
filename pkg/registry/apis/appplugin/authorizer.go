package appplugin

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	pluginaccesscontrol "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

// Structured so we can more easily replace with the MT access client
type PluginAccessChecker = func(ctx context.Context, user identity.Requester, pluginID string) (authorized authorizer.Decision, reason string, err error)

func NewPluginAccessChecker(accessControl ac.AccessControl) PluginAccessChecker {
	return func(ctx context.Context, user identity.Requester, pluginID string) (authorized authorizer.Decision, reason string, err error) {
		scope := pluginaccesscontrol.ScopeProvider.GetResourceScope(pluginID)
		// Authorize the caller using the same permission as the legacy endpoint:
		//   ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, plugins:id:<pluginID>)
		ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, scope))
		if err != nil {
			return authorizer.DecisionDeny, "authorization check failed", err
		}
		if !ok {
			return authorizer.DecisionDeny, "access denied", nil
		}
		return authorizer.DecisionAllow, "", nil
	}
}

func (b *AppPluginAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}
			return b.accessControl(ctx, user, b.pluginJSON.ID)
		},
	)
}
