package pluginaccesscontrol

import (
	"context"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	appv0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
)

// NewAppAccessCheckerWithClient checks app access with AuthZ's Check, which maps
// get on plugins.grafana.app/app/<plugin ID> to plugins.app:access on
// plugins:id:<plugin ID>: the same check unified storage makes for app settings.
func NewAppAccessCheckerWithClient(client types.AccessClient) AppAccessChecker {
	if client == nil {
		return nil
	}
	return func(ctx context.Context, user identity.Requester, id string) (authorizer.Decision, string, error) {
		ns := request.NamespaceValue(ctx)
		if ns == "" {
			if info, ok := request.RequestInfoFrom(ctx); ok {
				ns = info.Namespace
			}
		}
		if ns == "" || ns == "*" {
			return authorizer.DecisionDeny, "a concrete namespace is required", nil
		}
		// An access policy is decided by its token's permissions alone. Users get
		// the app-access check only, as in ST: the calling service's delegated
		// permissions do not narrow it.
		if types.IsIdentityType(user.GetIdentityType(), types.TypeAccessPolicy) {
			verb := "get"
			if info, ok := request.RequestInfoFrom(ctx); ok {
				verb = info.Verb
			}
			if !authzlib.CheckServicePermissions(user, id, appv0.APP_RESOURCE_NAME, verb).Allowed {
				return authorizer.DecisionDeny, "token does not allow this app operation", nil
			}
			return authorizer.DecisionAllow, "", nil
		}
		rsp, err := client.Check(ctx, settingsAppAccessAuthInfo{AuthInfo: user}, types.CheckRequest{
			Verb:      utils.VerbGet,
			Group:     appv0.GROUP,
			Resource:  appv0.APP_RESOURCE_NAME,
			Namespace: ns,
			Name:      id,
		}, "")
		if err != nil || !rsp.Allowed {
			return authorizer.DecisionDeny, "app access denied", err
		}
		return authorizer.DecisionAllow, "", nil
	}
}

// Authlib also checks delegated permissions before contacting AuthZ. This
// lookup asks for the user's app access, independent of the caller's delegated
// grants, so supply only the grant needed for that lookup. Keep this adapter
// local to Check: storage and plugin calls must retain the original credentials.
type settingsAppAccessAuthInfo struct {
	types.AuthInfo
}

func (settingsAppAccessAuthInfo) GetTokenDelegatedPermissions() []string {
	return []string{appv0.GROUP + "/" + appv0.APP_RESOURCE_NAME + ":" + utils.VerbGet}
}
