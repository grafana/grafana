package middleware

import (
	"errors"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqNoAnonynmous bool
	ReqSignedIn     bool
}

func accessForbidden(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}

func notAuthorized(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.WriteErrOrFallback(http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized), c.LookupTokenErr)
		return
	}

	if !c.UseSessionStorageRedirect {
		writeRedirectCookie(c)
	}

	if errors.Is(c.LookupTokenErr, authn.ErrTokenNeedsRotation) {
		if !c.UseSessionStorageRedirect {
			c.Redirect(setting.AppSubUrl + "/user/auth-tokens/rotate")
			return
		}

		c.Redirect(setting.AppSubUrl + "/user/auth-tokens/rotate" + getRedirectToQueryParam(c))
		return
	}

	if !c.UseSessionStorageRedirect {
		c.Redirect(setting.AppSubUrl + "/login")
		return
	}

	c.Redirect(setting.AppSubUrl + "/login" + getRedirectToQueryParam(c))
}

func tokenRevoked(c *contextmodel.ReqContext, err *auth.TokenRevokedError) {
	if c.IsApiRequest() {
		c.JSON(http.StatusUnauthorized, map[string]any{
			"message": "Token revoked",
			"error": map[string]any{
				"id":                    "ERR_TOKEN_REVOKED",
				"maxConcurrentSessions": err.MaxConcurrentSessions,
			},
		})
		return
	}

	if !c.UseSessionStorageRedirect {
		writeRedirectCookie(c)
		c.Redirect(setting.AppSubUrl + "/login")
		return
	}

	c.Redirect(setting.AppSubUrl + "/login" + getRedirectToQueryParam(c))
}

func writeRedirectCookie(c *contextmodel.ReqContext) {
	redirectTo := c.Req.RequestURI
	if setting.AppSubUrl != "" && !strings.HasPrefix(redirectTo, setting.AppSubUrl) {
		redirectTo = setting.AppSubUrl + c.Req.RequestURI
	}

	if redirectTo == "/" {
		return
	}

	// remove any forceLogin=true params
	redirectTo = RemoveForceLoginParams(redirectTo)
	cookies.WriteCookie(c.Resp, "redirect_to", url.QueryEscape(redirectTo), 0, nil)
}

func getRedirectToQueryParam(c *contextmodel.ReqContext) string {
	redirectTo := c.Req.RequestURI
	if setting.AppSubUrl != "" && strings.HasPrefix(redirectTo, setting.AppSubUrl) {
		redirectTo = strings.TrimPrefix(redirectTo, setting.AppSubUrl)
	}

	if redirectTo == "/" {
		return ""
	}

	// remove any forceLogin=true params
	redirectTo = RemoveForceLoginParams(redirectTo)
	return "?redirectTo=" + url.QueryEscape(redirectTo)
}

var forceLoginParamsRegexp = regexp.MustCompile(`&?forceLogin=true`)

func RemoveForceLoginParams(str string) string {
	return forceLoginParamsRegexp.ReplaceAllString(str, "")
}

func CanAdminPlugins(cfg *setting.Cfg, accessControl ac.AccessControl) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		hasAccess := ac.HasAccess(accessControl, c)
		if !pluginaccesscontrol.ReqCanAdminPlugins(cfg)(c) && !hasAccess(pluginaccesscontrol.AdminAccessEvaluator) {
			accessForbidden(c)
			return
		}
		if c.AllowAnonymous && !c.IsSignedIn && shouldForceLogin(c) {
			notAuthorized(c)
			return
		}
	}
}

func RoleAppPluginAuth(accessControl ac.AccessControl, ps pluginstore.Store, logger log.Logger) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		pluginID := web.Params(c.Req)[":id"]
		p, exists := ps.Plugin(c.Req.Context(), pluginID)
		if !exists {
			// The frontend will handle app not found appropriately
			return
		}

		permitted := true
		path := normalizeIncludePath(c.Req.URL.Path)
		hasAccess := ac.HasAccess(accessControl, c)
		for _, i := range p.Includes {
			if i.Type != "page" {
				continue
			}

			u, err := url.Parse(i.Path)
			if err != nil {
				logger.Error("failed to parse include path", "pluginId", pluginID, "include", i.Name, "err", err)
				continue
			}

			if normalizeIncludePath(u.Path) == path {
				if i.RequiresRBACAction() && !hasAccess(pluginaccesscontrol.GetPluginRouteEvaluator(pluginID, i.Action)) {
					logger.Debug("Plugin include is covered by RBAC, user doesn't have access", "plugin", pluginID, "include", i.Name)
					permitted = false
					break
				} else if !i.RequiresRBACAction() && !c.HasUserRole(i.Role) {
					permitted = false
					break
				}
			}
		}

		if !permitted {
			accessForbidden(c)
			return
		}
	}
}

func normalizeIncludePath(p string) string {
	return strings.TrimPrefix(filepath.Clean(p), "/")
}

func RoleAuth(roles ...org.RoleType) web.Handler {
	return func(c *contextmodel.ReqContext) {
		ok := false
		for _, role := range roles {
			if role == c.OrgRole {
				ok = true
				break
			}
		}
		if !ok {
			accessForbidden(c)
		}
	}
}

func Auth(options *AuthOptions) web.Handler {
	return func(c *contextmodel.ReqContext) {
		forceLogin := false
		if c.AllowAnonymous {
			forceLogin = shouldForceLogin(c)
			if !forceLogin {
				orgIDValue := c.Req.URL.Query().Get("orgId")
				orgID, err := strconv.ParseInt(orgIDValue, 10, 64)
				if err == nil && orgID > 0 && orgID != c.SignedInUser.GetOrgID() {
					forceLogin = true
				}
			}
		}

		requireLogin := !c.AllowAnonymous || forceLogin || options.ReqNoAnonynmous

		if !c.IsSignedIn && options.ReqSignedIn && requireLogin {
			var revokedErr *auth.TokenRevokedError
			if errors.As(c.LookupTokenErr, &revokedErr) {
				tokenRevoked(c, revokedErr)
				return
			}

			notAuthorized(c)
			return
		}

		if !c.IsGrafanaAdmin && options.ReqGrafanaAdmin {
			accessForbidden(c)
			return
		}
	}
}

// SnapshotPublicModeOrCreate creates a middleware that allows access
// if snapshot public mode is enabled or if user has creation permission.
func SnapshotPublicModeOrCreate(cfg *setting.Cfg, ac2 ac.AccessControl) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if cfg.SnapshotPublicMode {
			return
		}

		if !c.IsSignedIn {
			notAuthorized(c)
			return
		}

		ac.Middleware(ac2)(ac.EvalPermission(dashboards.ActionSnapshotsCreate))
	}
}

// SnapshotPublicModeOrDelete creates a middleware that allows access
// if snapshot public mode is enabled or if user has delete permission.
func SnapshotPublicModeOrDelete(cfg *setting.Cfg, ac2 ac.AccessControl) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if cfg.SnapshotPublicMode {
			return
		}

		if !c.IsSignedIn {
			notAuthorized(c)
			return
		}

		ac.Middleware(ac2)(ac.EvalPermission(dashboards.ActionSnapshotsDelete))
	}
}

func ReqNotSignedIn(c *contextmodel.ReqContext) {
	if c.IsSignedIn {
		c.Redirect(setting.AppSubUrl + "/")
	}
}

// NoAuth creates a middleware that doesn't require any authentication.
// If forceLogin param is set it will redirect the user to the login page.
func NoAuth() web.Handler {
	return func(c *contextmodel.ReqContext) {
		if shouldForceLogin(c) {
			notAuthorized(c)
			return
		}
	}
}

// shouldForceLogin checks if user should be enforced to login.
// Returns true if forceLogin parameter is set.
func shouldForceLogin(c *contextmodel.ReqContext) bool {
	forceLogin := false
	forceLoginParam, err := strconv.ParseBool(c.Req.URL.Query().Get("forceLogin"))
	if err == nil {
		forceLogin = forceLoginParam
	}

	return forceLogin
}
