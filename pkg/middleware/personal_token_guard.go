package middleware

import (
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"github.com/grafana/grafana/pkg/web"
)

// PersonalTokenGuard returns a named route middleware (see routing.RegisterNamedMiddleware)
// that rejects personal access token requests to routes that are not safely
// covered by RBAC actions alone, e.g. credential and session management.
// allowAdminActions lifts the restriction only for routes whose matching action the token holds explicitly.
func PersonalTokenGuard(allowAdminActions func() bool) func(pattern string) web.Handler {
	return func(pattern string) web.Handler {
		return func(c *contextmodel.ReqContext) {
			if c.SignedInUser == nil || c.SignedInUser.GetAuthenticatedBy() != login.PersonalTokenAuthModule {
				return
			}
			perms := c.SignedInUser.GetPermissions()
			has := func(action string) bool { _, ok := perms[action]; return ok }
			if patscope.RouteAllowed(c.Req.Method, pattern, allowAdminActions(), has) {
				return
			}
			c.JsonApiErr(http.StatusForbidden, "This action is not permitted with a personal access token", nil)
		}
	}
}

// PersonalTokenKubernetesGuard rejects personal access token requests to the
// k8s-style API server paths. It backs up the check in the authn client: the
// apiserver authorizes with the owner's stored permissions and would ignore
// token scopes.
func PersonalTokenKubernetesGuard() web.Handler {
	return func(c *contextmodel.ReqContext) {
		if c.SignedInUser == nil || c.SignedInUser.GetAuthenticatedBy() != login.PersonalTokenAuthModule {
			return
		}
		if patscope.IsDeniedKubernetesPath(c.Req.URL.Path) {
			c.JsonApiErr(http.StatusForbidden, "This action is not permitted with a personal access token", nil)
		}
	}
}
