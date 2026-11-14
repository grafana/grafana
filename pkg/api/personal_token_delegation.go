package api

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/login"
)

// personalTokenRequiresDashboardsRead guards routes that have no RBAC action of
// their own (playlists, stars) and read org data through the k8s API with the
// owner's rights. Personal access tokens must hold dashboards:read to use them;
// other callers are unaffected.
func (hs *HTTPServer) personalTokenRequiresDashboardsRead() func(*contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		if c.SignedInUser == nil || c.SignedInUser.GetAuthenticatedBy() != login.PersonalTokenAuthModule {
			return
		}
		if !ac.HasAccess(hs.AccessControl, c)(ac.EvalPermission(dashboards.ActionDashboardsRead)) {
			c.JsonApiErr(http.StatusForbidden, "This action is not permitted with a personal access token", nil)
		}
	}
}

// personalTokenScopedDelegationDenied reports whether a request must not be
// handed to the in-process k8s API server. That server authorizes with the
// owner's stored permissions, so resource-level narrowing of a personal access
// token (e.g. one datasource UID) would be lost. Fail closed: a token is only
// delegated when every scope it holds for the given actions is a wildcard.
func personalTokenScopedDelegationDenied(requester identity.Requester, actions ...string) bool {
	by, ok := requester.(interface{ GetAuthenticatedBy() string })
	if !ok || by.GetAuthenticatedBy() != login.PersonalTokenAuthModule {
		return false
	}
	perms := requester.GetPermissions()
	for _, action := range actions {
		for _, scope := range perms[action] {
			if !isWildcardScope(scope) {
				return true
			}
		}
	}
	return false
}

func isWildcardScope(scope string) bool {
	return scope == "*" || (strings.HasSuffix(scope, ":*") && strings.Count(scope, ":") == 1)
}

func writePersonalTokenDelegationDenied(w http.ResponseWriter) {
	http.Error(w, "This action is not permitted with a resource-scoped personal access token", http.StatusForbidden)
}
