package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func (hs *HTTPServer) setIndexViewData(c *contextmodel.ReqContext) (*dtos.IndexViewData, error) {
	settings, err := hs.getFrontendSettings(c)
	if err != nil {
		return nil, err
	}

	settings.IsPublicDashboardView = c.IsPublicDashboardView

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: c.UserID, OrgID: c.OrgID, Teams: c.Teams}
	prefs, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return nil, err
	}

	if hs.Features.IsEnabled(featuremgmt.FlagIndividualCookiePreferences) {
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

	appURL := setting.AppUrl
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

	hasAccess := ac.HasAccess(hs.AccessControl, c)
	hasEditPerm := hasAccess(ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsCreate), ac.EvalPermission(dashboards.ActionFoldersCreate)))

	data := dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:                         c.UserID,
			IsSignedIn:                 c.IsSignedIn,
			Login:                      c.Login,
			Email:                      c.Email,
			Name:                       c.Name,
			OrgCount:                   c.OrgCount,
			OrgId:                      c.OrgID,
			OrgName:                    c.OrgName,
			OrgRole:                    c.OrgRole,
			GravatarUrl:                dtos.GetGravatarUrl(c.Email),
			IsGrafanaAdmin:             c.IsGrafanaAdmin,
			Theme:                      theme.ID,
			LightTheme:                 theme.Type == "light",
			Timezone:                   prefs.Timezone,
			WeekStart:                  weekStart,
			Locale:                     locale,
			Language:                   language,
			HelpFlags1:                 c.HelpFlags1,
			HasEditPermissionInFolders: hasEditPerm,
			Analytics:                  hs.buildUserAnalyticsSettings(c.Req.Context(), c.SignedInUser),
		},
		Settings:                            settings,
		ThemeType:                           theme.Type,
		AppUrl:                              appURL,
		AppSubUrl:                           appSubURL,
		NewsFeedEnabled:                     setting.NewsFeedEnabled,
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
		ContentDeliveryURL:                  hs.Cfg.GetContentDeliveryURL(hs.License.ContentDeliveryPrefix()),
		LoadingLogo:                         "public/img/grafana_icon.svg",
		IsDevelopmentEnv:                    hs.Cfg.Env == setting.Dev,
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

	if setting.DisableGravatar {
		data.User.GravatarUrl = hs.Cfg.AppSubURL + "/public/img/user_profile.png"
	}

	if len(data.User.Name) == 0 {
		data.User.Name = data.User.Login
	}

	hs.HooksService.RunIndexDataHooks(&data, c)

	data.NavTree.ApplyAdminIA()
	data.NavTree.Sort()

	return &data, nil
}

func (hs *HTTPServer) buildUserAnalyticsSettings(ctx context.Context, signedInUser *user.SignedInUser) dtos.AnalyticsSettings {
	identifier := signedInUser.Email + "@" + setting.AppUrl

	authInfo, err := hs.authInfoService.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: signedInUser.UserID})
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
		if !theme.IsExtra || hs.Features.IsEnabled(featuremgmt.FlagExtraThemes) {
			return theme
		}
	}

	return pref.GetThemeByID(hs.Cfg.DefaultTheme)
}
