package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func (hs *HTTPServer) setIndexViewData(c *contextmodel.ReqContext) (*dtos.IndexViewData, error) {
	settings, err := hs.getFrontendSettings(c)
	if err != nil {
		return nil, err
	}

	userID, _ := identity.UserIdentifier(c.SignedInUser.GetNamespacedID())

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: userID, OrgID: c.SignedInUser.GetOrgID(), Teams: c.Teams}
	prefs, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return nil, err
	}

	if hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagIndividualCookiePreferences) {
		if !prefs.Cookies("analytics") {
			settings.GoogleAnalytics4Id = ""
			settings.GoogleAnalyticsId = ""
		}
	}

	// Locale is used for some number and date/time formatting, whereas language is used just for
	// translating words in the interface
	acceptLangHeader := c.Req.Header.Get("Accept-Language")
	locale := "en-US"
	language := "" // frontend will set the default language

	if prefs.JSONData.Language != "" {
		language = prefs.JSONData.Language
	}

	if len(acceptLangHeader) > 0 {
		parts := strings.Split(acceptLangHeader, ",")
		locale = parts[0]
	}

	appURL := hs.Cfg.AppURL
	appSubURL := hs.Cfg.AppSubURL

	// special case when doing localhost call from image renderer
	if c.IsRenderCall && !hs.Cfg.ServeFromSubPath {
		appURL = fmt.Sprintf("%s://localhost:%s", hs.Cfg.Protocol, hs.Cfg.HTTPPort)
		appSubURL = ""
		settings.AppSubUrl = ""
	}

	navTree, err := hs.navTreeService.GetNavTree(c, prefs)
	if err != nil {
		return nil, err
	}

	weekStart := ""
	if prefs.WeekStart != nil {
		weekStart = *prefs.WeekStart
	}

	theme := hs.getThemeForIndexData(prefs.Theme, c.Query("theme"))
	assets, err := webassets.GetWebAssets(c.Req.Context(), hs.Cfg, hs.License)
	if err != nil {
		return nil, err
	}

	hasAccess := ac.HasAccess(hs.AccessControl, c)
	hasEditPerm := hasAccess(ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsCreate), ac.EvalPermission(dashboards.ActionFoldersCreate)))

	data := dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:                         userID,
			UID:                        c.UserUID, // << not set yet
			IsSignedIn:                 c.IsSignedIn,
			Login:                      c.Login,
			Email:                      c.SignedInUser.GetEmail(),
			Name:                       c.Name,
			OrgId:                      c.SignedInUser.GetOrgID(),
			OrgName:                    c.OrgName,
			OrgRole:                    c.SignedInUser.GetOrgRole(),
			OrgCount:                   hs.getUserOrgCount(c, userID),
			GravatarUrl:                dtos.GetGravatarUrl(hs.Cfg, c.SignedInUser.GetEmail()),
			IsGrafanaAdmin:             c.IsGrafanaAdmin,
			Theme:                      theme.ID,
			LightTheme:                 theme.Type == "light",
			Timezone:                   prefs.Timezone,
			WeekStart:                  weekStart,
			Locale:                     locale,
			Language:                   language,
			HelpFlags1:                 c.HelpFlags1,
			HasEditPermissionInFolders: hasEditPerm,
			Analytics:                  hs.buildUserAnalyticsSettings(c),
			AuthenticatedBy:            hs.getUserAuthenticatedBy(c, userID),
		},
		Settings:                            settings,
		ThemeType:                           theme.Type,
		AppUrl:                              appURL,
		AppSubUrl:                           appSubURL,
		NewsFeedEnabled:                     hs.Cfg.NewsFeedEnabled,
		GoogleAnalyticsId:                   settings.GoogleAnalyticsId,
		GoogleAnalytics4Id:                  settings.GoogleAnalytics4Id,
		GoogleAnalytics4SendManualPageViews: hs.Cfg.GoogleAnalytics4SendManualPageViews,
		GoogleTagManagerId:                  hs.Cfg.GoogleTagManagerID,
		BuildVersion:                        setting.BuildVersion,
		BuildCommit:                         setting.BuildCommit,
		NewGrafanaVersion:                   hs.grafanaUpdateChecker.LatestVersion(),
		NewGrafanaVersionExists:             hs.grafanaUpdateChecker.UpdateAvailable(),
		AppName:                             setting.ApplicationName,
		AppNameBodyClass:                    "app-grafana",
		FavIcon:                             "public/img/fav32.png",
		AppleTouchIcon:                      "public/img/apple-touch-icon.png",
		AppTitle:                            "Grafana",
		NavTree:                             navTree,
		Nonce:                               c.RequestNonce,
		LoadingLogo:                         "public/img/grafana_icon.svg",
		IsDevelopmentEnv:                    hs.Cfg.Env == setting.Dev,
		Assets:                              assets,
	}

	if hs.Cfg.CSPEnabled {
		data.CSPEnabled = true
		data.CSPContent = middleware.ReplacePolicyVariables(hs.Cfg.CSPTemplate, appURL, c.RequestNonce)
	}
	userPermissions, err := hs.accesscontrolService.GetUserPermissions(c.Req.Context(), c.SignedInUser, ac.Options{ReloadCache: false})
	if err != nil {
		return nil, err
	}

	data.User.Permissions = ac.BuildPermissionsMap(userPermissions)

	if hs.Cfg.DisableGravatar {
		data.User.GravatarUrl = hs.Cfg.AppSubURL + "/public/img/user_profile.png"
	}

	if len(data.User.Name) == 0 {
		data.User.Name = data.User.Login
	}

	hs.HooksService.RunIndexDataHooks(&data, c)

	// data.NavTree.ApplyAdminIA() // LOGZIO GRAFANA CHANGE ::
	data.NavTree.Sort()

	return &data, nil
}

func (hs *HTTPServer) buildUserAnalyticsSettings(c *contextmodel.ReqContext) dtos.AnalyticsSettings {
	namespace, id := c.SignedInUser.GetNamespacedID()

	// Anonymous users do not have an email or auth info
	if namespace != identity.NamespaceUser {
		return dtos.AnalyticsSettings{Identifier: "@" + hs.Cfg.AppURL}
	}

	if !c.IsSignedIn {
		return dtos.AnalyticsSettings{}
	}

	userID, err := identity.IntIdentifier(namespace, id)
	if err != nil {
		hs.log.Error("Failed to parse user ID", "error", err)
		return dtos.AnalyticsSettings{Identifier: "@" + hs.Cfg.AppURL}
	}

	identifier := c.SignedInUser.GetEmail() + "@" + hs.Cfg.AppURL

	authInfo, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &login.GetAuthInfoQuery{UserId: userID})
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		hs.log.Error("Failed to get auth info for analytics", "error", err)
	}

	if authInfo != nil && authInfo.AuthModule == login.GrafanaComAuthModule {
		identifier = authInfo.AuthId
	}

	return dtos.AnalyticsSettings{
		Identifier:         identifier,
		IntercomIdentifier: hashUserIdentifier(identifier, hs.Cfg.IntercomSecret),
	}
}

func (hs *HTTPServer) getUserOrgCount(c *contextmodel.ReqContext, userID int64) int {
	if userID == 0 {
		return 1
	}

	userOrgs, err := hs.orgService.GetUserOrgList(c.Req.Context(), &org.GetUserOrgListQuery{UserID: userID})
	if err != nil {
		hs.log.FromContext(c.Req.Context()).Error("Failed to count user orgs", "userId", userID, "error", err)
		return 1
	}

	return len(userOrgs)
}

// getUserAuthenticatedBy returns external authentication method used for user.
// If user does not have an external authentication method an empty string is returned
func (hs *HTTPServer) getUserAuthenticatedBy(c *contextmodel.ReqContext, userID int64) string {
	if userID == 0 {
		return ""
	}

	// Special case for image renderer. Frontend relies on this information
	// to render dashboards in a bit different way.
	if c.IsRenderCall {
		return login.RenderModule
	}

	info, err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &login.GetAuthInfoQuery{UserId: userID})
	// we ignore errors where a user does not have external user auth
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
		hs.log.FromContext(c.Req.Context()).Error("Failed to fetch auth info", "userId", c.SignedInUser.UserID, "error", err)
	}

	if err != nil {
		return ""
	}

	return info.AuthModule
}

func hashUserIdentifier(identifier string, secret string) string {
	if secret == "" {
		return ""
	}

	key := []byte(secret)
	h := hmac.New(sha256.New, key)
	h.Write([]byte(identifier))
	return hex.EncodeToString(h.Sum(nil))
}

func (hs *HTTPServer) Index(c *contextmodel.ReqContext) {
	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, 500, "Failed to get settings", err)
		return
	}
	c.HTML(http.StatusOK, "index", data)
}

func (hs *HTTPServer) NotFoundHandler(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(404, "Not found", nil)
		return
	}

	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, 500, "Failed to get settings", err)
		return
	}

	c.HTML(404, "index", data)
}

func (hs *HTTPServer) getThemeForIndexData(themePrefId string, themeURLParam string) *pref.ThemeDTO {
	if themeURLParam != "" && pref.IsValidThemeID(themeURLParam) {
		return pref.GetThemeByID(themeURLParam)
	}

	if pref.IsValidThemeID(themePrefId) {
		theme := pref.GetThemeByID(themePrefId)
		if !theme.IsExtra || hs.Features.IsEnabledGlobally(featuremgmt.FlagExtraThemes) {
			return theme
		}
	}

	return pref.GetThemeByID(hs.Cfg.DefaultTheme)
}
