package middleware

import (
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqSignedIn     bool
	ReqNoAnonynmous bool
}

func accessForbidden(c *models.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}

func notAuthorized(c *models.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(401, "Unauthorized", nil)
		return
	}

	writeRedirectCookie(c)
	c.Redirect(setting.AppSubUrl + "/login")
}

func tokenRevoked(c *models.ReqContext, err *auth.TokenRevokedError) {
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

func writeRedirectCookie(c *models.ReqContext) {
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

func EnsureEditorOrViewerCanEdit(c *models.ReqContext) {
	if !c.SignedInUser.HasRole(org.RoleEditor) && !setting.ViewersCanEdit {
		accessForbidden(c)
	}
}

func RoleAuth(roles ...org.RoleType) web.Handler {
	return func(c *models.ReqContext) {
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
	return func(c *models.ReqContext) {
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

// AdminOrEditorAndFeatureEnabled creates a middleware that allows
// access if the signed in user is either an Org Admin or if they
// are an Org Editor and the feature flag is enabled.
// Intended for when feature flags open up access to APIs that
// are otherwise only available to admins.
func AdminOrEditorAndFeatureEnabled(enabled bool) web.Handler {
	return func(c *models.ReqContext) {
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
	return func(c *models.ReqContext) {
		if cfg.SnapshotPublicMode {
			return
		}

		if !c.IsSignedIn {
			notAuthorized(c)
			return
		}
	}
}

func ReqNotSignedIn(c *models.ReqContext) {
	if c.IsSignedIn {
		c.Redirect(setting.AppSubUrl + "/")
	}
}

// NoAuth creates a middleware that doesn't require any authentication.
// If forceLogin param is set it will redirect the user to the login page.
func NoAuth() web.Handler {
	return func(c *models.ReqContext) {
		if shouldForceLogin(c) {
			notAuthorized(c)
			return
		}
	}
}

// shouldForceLogin checks if user should be enforced to login.
// Returns true if forceLogin parameter is set.
func shouldForceLogin(c *models.ReqContext) bool {
	forceLogin := false
	forceLoginParam, err := strconv.ParseBool(c.Req.URL.Query().Get("forceLogin"))
	if err == nil {
		forceLogin = forceLoginParam
	}

	return forceLogin
}

func OrgAdminDashOrFolderAdminOrTeamAdmin(ss db.DB, ds dashboards.DashboardService, ts team.Service) func(c *models.ReqContext) {
	return func(c *models.ReqContext) {
		if c.OrgRole == org.RoleAdmin {
			return
		}

		hasAdminPermissionInDashOrFoldersQuery := models.HasAdminPermissionInDashboardsOrFoldersQuery{SignedInUser: c.SignedInUser}
		if err := ds.HasAdminPermissionInDashboardsOrFolders(c.Req.Context(), &hasAdminPermissionInDashOrFoldersQuery); err != nil {
			c.JsonApiErr(500, "Failed to check if user is a folder admin", err)
		}

		if hasAdminPermissionInDashOrFoldersQuery.Result {
			return
		}

		isAdminOfTeamsQuery := models.IsAdminOfTeamsQuery{SignedInUser: c.SignedInUser}
		if err := ts.IsAdminOfTeams(c.Req.Context(), &isAdminOfTeamsQuery); err != nil {
			c.JsonApiErr(500, "Failed to check if user is a team admin", err)
		}

		if isAdminOfTeamsQuery.Result {
			return
		}

		accessForbidden(c)
	}
}
