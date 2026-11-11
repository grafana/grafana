package pluginaccesscontrol

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// AppAccessChecker decides whether user may use the app plugin pluginID. It
// returns an API server authorization decision, so plugin API handlers can use
// it as their authorizer.
type AppAccessChecker = func(ctx context.Context, user identity.Requester, pluginID string) (authorizer.Decision, string, error)

// NewAppAccessChecker authorizes the caller with the same permission as the
// legacy app endpoints: ActionAppAccess on plugins:id:<pluginID>.
func NewAppAccessChecker(accessControl ac.AccessControl) AppAccessChecker {
	return newChecker(accessControl, ActionAppAccess)
}

// NewSettingsWriteChecker authorizes the caller with the same permission as the
// legacy endpoint that updates plugin settings: ActionWrite on plugins:id:<pluginID>.
func NewSettingsWriteChecker(accessControl ac.AccessControl) AppAccessChecker {
	return newChecker(accessControl, ActionWrite)
}

func newChecker(accessControl ac.AccessControl, action string) AppAccessChecker {
	return func(ctx context.Context, user identity.Requester, pluginID string) (authorizer.Decision, string, error) {
		ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action, ScopeProvider.GetResourceScope(pluginID)))
		if err != nil {
			return authorizer.DecisionDeny, "authorization check failed", err
		}
		if !ok {
			return authorizer.DecisionDeny, "access denied", nil
		}
		return authorizer.DecisionAllow, "", nil
	}
}
