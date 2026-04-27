package middleware

import (
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// ProvisioningAuth returns a middleware that gates /admin/provisioning/* routes.
// Dashboard preview paths (/{slug}/dashboard/preview/{path}) only require a
// signed-in user, while all other sub-paths still require OrgAdmin via the
// provided fallback handler.
//
// This allows non-admin users to access preview links posted in pull-request
// comments by the git-sync backend, without relaxing access to the rest of
// the provisioning admin UI.
func ProvisioningAuth(fallback web.Handler) func(c *contextmodel.ReqContext) {
	reqOrgAdmin := fallback.(func(*contextmodel.ReqContext))

	return func(c *contextmodel.ReqContext) {
		if isProvisioningPreviewPath(c.Req.URL.Path) {
			if !c.IsSignedIn {
				notAuthorized(c)
			}
			return
		}

		reqOrgAdmin(c)
	}
}

const provisioningPrefix = "/admin/provisioning/"

// isProvisioningPreviewPath reports whether urlPath matches the pattern
// /admin/provisioning/{slug}/dashboard/preview/{rest}.
func isProvisioningPreviewPath(urlPath string) bool {
	if !strings.HasPrefix(urlPath, provisioningPrefix) {
		return false
	}

	remainder := urlPath[len(provisioningPrefix):]

	// remainder must be: {slug}/dashboard/preview/{rest}
	// Find first slash to skip the slug segment.
	slashIdx := strings.IndexByte(remainder, '/')
	if slashIdx < 1 {
		return false
	}

	return strings.HasPrefix(remainder[slashIdx+1:], "dashboard/preview/")
}
