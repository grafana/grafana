package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

type URLPrefs struct {
	Language       string
	RegionalFormat string
	Theme          string
}

// URL prefs take precedence over any saved user preferences
func getURLPrefs(c *contextmodel.ReqContext) URLPrefs {
	language := c.Query("lang")
	theme := c.Query("theme")
	regionalFormat := c.Query("regionalFormat")

	return URLPrefs{
		Language:       language,
		RegionalFormat: regionalFormat,
		Theme:          theme,
	}
}

func (hs *HTTPServer) setIndexViewData(c *contextmodel.ReqContext) (*dtos.IndexViewData, error) {
	c, span := hs.injectSpan(c, "api.setIndexViewData")
	defer span.End()

	settings, err := hs.getFrontendSettings(c)
	if err != nil {
		return nil, err
	}

	userID, _ := identity.UserIdentifier(c.GetID())

	ctx := c.Req.Context()
	flag := "nonExistingFlag"
	nonExistingFlag, err := openfeature.GetApiInstance().GetClient().BooleanValueDetails(ctx, flag, false, openfeature.TransactionContext(ctx))
	hs.log.Info("OpenFeature testing", "flag", flag, "evaluation details", nonExistingFlag, "error", err)

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: userID, OrgID: c.GetOrgID(), Teams: c.Teams}
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
	acceptLangHeaderFirstValue := ""

	if len(acceptLangHeader) > 0 {
		parts := strings.Split(acceptLangHeader, ",")
		acceptLangHeaderFirstValue = parts[0]
	}

	locale := "en-US" // default to en formatting, but use the accept-lang header or user's preference
	if acceptLangHeaderFirstValue != "" {
		locale = acceptLangHeaderFirstValue
	}

	language := "" // frontend will set the default language
	urlPrefs := getURLPrefs(c)

	if urlPrefs.Language != "" {
		language = urlPrefs.Language
	} else if prefs.JSONData.Language != "" {
		language = prefs.JSONData.Language
	}

	var regionalFormat string
	if hs.Features.IsEnabled(c.Req.Context(), featuremgmt.FlagLocaleFormatPreference) {
		regionalFormat = "en"

		// We default the regional format (locale) to the Accept-Language header rather than the language preference
		// mainly because we want to avoid defaulting to en-US for most users who have not set a preference, and we
		// don't have more specific English language preferences yet.

		// Regional format preference order (from most-preferred to least):
		// 1. URL parameter
		// 2. regionalFormat User preference
		// 3. Accept-Language header
		// 4. Language preference
		if urlPrefs.RegionalFormat != "" {
			regionalFormat = urlPrefs.RegionalFormat
		} else if prefs.JSONData.RegionalFormat != "" {
			regionalFormat = prefs.JSONData.RegionalFormat
		} else if acceptLangHeaderFirstValue != "" {
			regionalFormat = acceptLangHeaderFirstValue
		} else if language != "" {
			regionalFormat = language
		}
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

	theme := hs.getThemeForIndexData(prefs.Theme, urlPrefs.Theme)
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
			Email:                      c.GetEmail(),
			Name:                       c.Name,
			OrgId:                      c.GetOrgID(),
			OrgName:                    c.OrgName,
			OrgRole:                    c.GetOrgRole(),
			OrgCount:                   hs.getUserOrgCount(c, userID),
			GravatarUrl:                dtos.GetGravatarUrl(hs.Cfg, c.GetEmail()),
			IsGrafanaAdmin:             c.IsGrafanaAdmin,
			Theme:                      theme.ID,
			LightTheme:                 theme.Type == "light",
			Timezone:                   prefs.Timezone,
			WeekStart:                  weekStart,
			Locale:                     locale, // << will be removed in favor of RegionalFormat
			RegionalFormat:             regionalFormat,
			Language:                   language,
			HelpFlags1:                 c.HelpFlags1,
			HasEditPermissionInFolders: hasEditPerm,
			Analytics:                  hs.buildUserAnalyticsSettings(c),
			AuthenticatedBy:            c.GetAuthenticatedBy(),
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

	data.NavTree.ApplyCostManagementIA()
	data.NavTree.ApplyHelpVersion(data.Settings.BuildInfo.VersionString) // RunIndexDataHooks can modify the version string
	data.NavTree.Sort()

	return &data, nil
}

func (hs *HTTPServer) buildUserAnalyticsSettings(c *contextmodel.ReqContext) dtos.AnalyticsSettings {
	// Anonymous users do not have an email or auth info
	if !c.IsIdentityType(claims.TypeUser) {
		return dtos.AnalyticsSettings{Identifier: "@" + hs.Cfg.AppURL}
	}

	if !c.IsSignedIn {
		return dtos.AnalyticsSettings{}
	}

	identifier := c.GetEmail() + "@" + hs.Cfg.AppURL

	if authenticatedBy := c.GetAuthenticatedBy(); authenticatedBy == login.GrafanaComAuthModule {
		identifier = c.GetAuthID()
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
	c, span := hs.injectSpan(c, "api.Index")
	defer span.End()

	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, http.StatusInternalServerError, "Failed to get settings", err)
		return
	}
	c.HTML(http.StatusOK, "index", data)
}

func (hs *HTTPServer) NotFoundHandler(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(http.StatusNotFound, "Not found", nil)
		return
	}

	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, http.StatusInternalServerError, "Failed to get settings", err)
		return
	}

	c.HTML(http.StatusNotFound, "index", data)
}

func (hs *HTTPServer) getThemeForIndexData(themePrefId string, themeURLParam string) *pref.ThemeDTO {
	if themeURLParam != "" && pref.IsValidThemeID(themeURLParam) {
		return pref.GetThemeByID(themeURLParam)
	}

	if pref.IsValidThemeID(themePrefId) {
		theme := pref.GetThemeByID(themePrefId)
		// TODO refactor
		if !theme.IsExtra || hs.Features.IsEnabledGlobally(featuremgmt.FlagGrafanaconThemes) {
			return theme
		}
	}

	return pref.GetThemeByID(hs.Cfg.DefaultTheme)
}
