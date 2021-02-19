package middleware

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type AuthOptions struct {
	ReqGrafanaAdmin bool
	ReqSignedIn     bool
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

	redirectTo := c.Req.RequestURI
	if setting.AppSubUrl != "" && !strings.HasPrefix(redirectTo, setting.AppSubUrl) {
		redirectTo = setting.AppSubUrl + c.Req.RequestURI
	}

	// remove any forceLogin=true params
	redirectTo = removeForceLoginParams(redirectTo)

	cookies.WriteCookie(c.Resp, "redirect_to", url.QueryEscape(redirectTo), 0, nil)
	c.Redirect(setting.AppSubUrl + "/login")
}

var forceLoginParamsRegexp = regexp.MustCompile(`&?forceLogin=true`)

func removeForceLoginParams(str string) string {
	return forceLoginParamsRegexp.ReplaceAllString(str, "")
}

func EnsureEditorOrViewerCanEdit(c *models.ReqContext) {
	if !c.SignedInUser.HasRole(models.ROLE_EDITOR) && !setting.ViewersCanEdit {
		accessForbidden(c)
	}
}

func RoleAuth(roles ...models.RoleType) macaron.Handler {
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

func Auth(options *AuthOptions) macaron.Handler {
	return func(c *models.ReqContext) {
		forceLogin := false
		if c.AllowAnonymous {
			forceLoginParam, err := strconv.ParseBool(c.Req.URL.Query().Get("forceLogin"))
			if err == nil {
				forceLogin = forceLoginParam
			}

			if !forceLogin {
				orgIDValue := c.Req.URL.Query().Get("orgId")
				orgID, err := strconv.ParseInt(orgIDValue, 10, 64)
				if err == nil && orgID > 0 && orgID != c.OrgId {
					forceLogin = true
				}
			}
		}
		requireLogin := !c.AllowAnonymous || forceLogin
		if !c.IsSignedIn && options.ReqSignedIn && requireLogin {
			notAuthorized(c)
			return
		}

		if !c.IsGrafanaAdmin && options.ReqGrafanaAdmin {
			accessForbidden(c)
			return
		}
	}
}

// AdminOrFeatureEnabled creates a middleware that allows access
// if the signed in user is either an Org Admin or if the
// feature flag is enabled.
// Intended for when feature flags open up access to APIs that
// are otherwise only available to admins.
func AdminOrFeatureEnabled(enabled bool) macaron.Handler {
	return func(c *models.ReqContext) {
		if c.OrgRole == models.ROLE_ADMIN {
			return
		}

		if !enabled {
			accessForbidden(c)
		}
	}
}

// SnapshotPublicModeOrSignedIn creates a middleware that allows access
// if snapshot public mode is enabled or if user is signed in.
func SnapshotPublicModeOrSignedIn(cfg *setting.Cfg) macaron.Handler {
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
