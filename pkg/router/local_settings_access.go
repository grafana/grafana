package router

import (
	"context"

	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

// ST's legacy checker supports identities and namespace behavior that AuthZ
// Check does not yet represent. Keep those cases local to the ST loader; an
// AuthZ denial or outage must never trigger a fallback.
func localSettingsAccessChecker(client types.AccessClient, legacy accesscontrol.AccessControl) pluginaccesscontrol.AppAccessChecker {
	check := pluginaccesscontrol.NewAppAccessCheckerWithClient(client)
	return func(ctx context.Context, user identity.Requester, id string) (authorizer.Decision, string, error) {
		info, ok := request.RequestInfoFrom(ctx)
		ns := request.NamespaceValue(ctx)
		if ns == "" && ok {
			ns = info.Namespace
		}
		if ok && !info.IsResourceRequest {
			// Discovery has no path namespace; check app access in the caller's org.
			ns = user.GetNamespace()
			ctx = request.WithNamespace(ctx, ns)
		}
		crossNamespace := (user.GetIsGrafanaAdmin() || types.IsIdentityType(user.GetIdentityType(), types.TypeAnonymous)) && !types.NamespaceMatches(user.GetNamespace(), ns)
		compatibility := ns == "" || ns == "*" || crossNamespace ||
			user.GetOrgID() == accesscontrol.NoOrgID ||
			!types.IsIdentityType(user.GetIdentityType(), types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous, types.TypeRenderService, types.TypeAccessPolicy)
		if compatibility {
			if legacy == nil {
				return authorizer.DecisionDeny, "local app-access checker is required", nil
			}
			return pluginaccesscontrol.NewAppAccessChecker(legacy)(ctx, user, id)
		}
		if check == nil {
			return authorizer.DecisionDeny, "AuthZ client is required", nil
		}
		return check(ctx, user, id)
	}
}
