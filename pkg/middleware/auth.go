package middleware

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqSignedIn     bool
	ReqNoAnonynmous bool
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
		c.WriteErrOrFallback(http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized), c.AuthErr)
		return
	}

	writeRedirectCookie(c)

	if errors.Is(c.AuthErr, authn.ErrTokenNeedsRotation) {
		c.Redirect(setting.AppSubUrl + "/user/auth-tokens/rotate")
		return
	}

	c.Redirect(setting.AppSubUrl + "/login")
}

func tokenRevoked(c *contextmodel.ReqContext, err *auth.TokenRevokedError) {
	if c.IsApiRequest() {
		c.JSON(401, map[string]interface{}{
			"message": "Token revoked",
			"error": map[string]interface{}{
				"id":                    "ERR_TOKEN_REVOKED",
				"maxConcurrentSessions": err.MaxConcurrentSessions,
			},
		})
		return
	}

	writeRedirectCookie(c)
	c.Redirect(setting.AppSubUrl + "/login")
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
	redirectTo = removeForceLoginParams(redirectTo)
	cookies.WriteCookie(c.Resp, "redirect_to", url.QueryEscape(redirectTo), 0, nil)
}

var forceLoginParamsRegexp = regexp.MustCompile(`&?forceLogin=true`)

func removeForceLoginParams(str string) string {
	return forceLoginParamsRegexp.ReplaceAllString(str, "")
}

func EnsureEditorOrViewerCanEdit(cfg *setting.Cfg) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		if !c.SignedInUser.HasRole(org.RoleEditor) && !cfg.ViewersCanEdit {
			accessForbidden(c)
		}
	}
}

func CanAdminPlugins(cfg *setting.Cfg) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		if !pluginaccesscontrol.ReqCanAdminPlugins(cfg)(c) {
			accessForbidden(c)
			return
		}
	}
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
				if err == nil && orgID > 0 && orgID != c.OrgID {
					forceLogin = true
				}
			}
		}

		requireLogin := !c.AllowAnonymous || forceLogin || options.ReqNoAnonynmous

		if !c.IsSignedIn && options.ReqSignedIn && requireLogin {
			var revokedErr *auth.TokenRevokedError
			if errors.As(c.AuthErr, &revokedErr) {
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

// AdminOrEditorAndFeatureEnabled creates a middleware that allows
// access if the signed in user is either an Org Admin or if they
// are an Org Editor and the feature flag is enabled.
// Intended for when feature flags open up access to APIs that
// are otherwise only available to admins.
func AdminOrEditorAndFeatureEnabled(enabled bool) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if c.OrgRole == org.RoleAdmin {
			return
		}

		if c.OrgRole == org.RoleEditor && enabled {
			return
		}

		accessForbidden(c)
	}
}

// SnapshotPublicModeOrSignedIn creates a middleware that allows access
// if snapshot public mode is enabled or if user is signed in.
func SnapshotPublicModeOrSignedIn(cfg *setting.Cfg) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if cfg.SnapshotPublicMode {
			return
		}

		if !c.IsSignedIn {
			notAuthorized(c)
			return
		}
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

func OrgAdminDashOrFolderAdminOrTeamAdmin(ss db.DB, ds dashboards.DashboardService, ts team.Service) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		if c.OrgRole == org.RoleAdmin {
			return
		}

		hasAdminPermissionInDashOrFoldersQuery := folder.HasAdminPermissionInDashboardsOrFoldersQuery{SignedInUser: c.SignedInUser}
		hasAdminPermissionInDashOrFoldersQueryResult, err := ds.HasAdminPermissionInDashboardsOrFolders(c.Req.Context(), &hasAdminPermissionInDashOrFoldersQuery)
		if err != nil {
			c.JsonApiErr(500, "Failed to check if user is a folder admin", err)
		}

		if hasAdminPermissionInDashOrFoldersQueryResult {
			return
		}

		isAdminOfTeamsQuery := team.IsAdminOfTeamsQuery{SignedInUser: c.SignedInUser}
		isAdminOfTeamsQueryResult, err := ts.IsAdminOfTeams(c.Req.Context(), &isAdminOfTeamsQuery)
		if err != nil {
			c.JsonApiErr(500, "Failed to check if user is a team admin", err)
		}

		if isAdminOfTeamsQueryResult {
			return
		}

		accessForbidden(c)
	}
}
