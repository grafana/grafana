package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Themes
	lightName  = "light"
	darkName   = "dark"
	systemName = "system"
)

func (hs *HTTPServer) editorInAnyFolder(c *contextmodel.ReqContext) bool {
	hasEditPermissionInFoldersQuery := folder.HasEditPermissionInFoldersQuery{SignedInUser: c.SignedInUser}
	hasEditPermissionInFoldersQueryResult, err := hs.DashboardService.HasEditPermissionInFolders(c.Req.Context(), &hasEditPermissionInFoldersQuery)
	if err != nil {
		return false
	}
	return hasEditPermissionInFoldersQueryResult
}

func (hs *HTTPServer) setIndexViewData(c *contextmodel.ReqContext) (*dtos.IndexViewData, error) {
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	hasEditPerm := hasAccess(hs.editorInAnyFolder, ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsCreate), ac.EvalPermission(dashboards.ActionFoldersCreate)))

	settings, err := hs.getFrontendSettingsMap(c)
	if err != nil {
		return nil, err
	}

	settings["dateFormats"] = hs.Cfg.DateFormats

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: c.UserID, OrgID: c.OrgID, Teams: c.Teams}
	prefs, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return nil, err
	}

	// Locale is used for some number and date/time formatting, whereas language is used just for
	// translating words in the interface
	acceptLangHeader := c.Req.Header.Get("Accept-Language")
	locale := "en-US"
	language := "" // frontend will set the default language

	if hs.Features.IsEnabled(featuremgmt.FlagInternationalization) && prefs.JSONData.Language != "" {
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
		settings["appSubUrl"] = ""
	}

	navTree, err := hs.navTreeService.GetNavTree(c, hasEditPerm, prefs)
	if err != nil {
		return nil, err
	}

	if c.IsPublicDashboardView {
		settings["isPublicDashboardView"] = true
	}

	weekStart := ""
	if prefs.WeekStart != nil {
		weekStart = *prefs.WeekStart
	}

	data := dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:                         c.UserID,
			IsSignedIn:                 c.IsSignedIn,
			Login:                      c.Login,
			Email:                      c.Email,
			ExternalUserId:             c.SignedInUser.ExternalAuthID,
			Name:                       c.Name,
			OrgCount:                   c.OrgCount,
			OrgId:                      c.OrgID,
			OrgName:                    c.OrgName,
			OrgRole:                    c.OrgRole,
			GravatarUrl:                dtos.GetGravatarUrl(c.Email),
			IsGrafanaAdmin:             c.IsGrafanaAdmin,
			Theme:                      prefs.Theme,
			LightTheme:                 prefs.Theme == lightName,
			Timezone:                   prefs.Timezone,
			WeekStart:                  weekStart,
			Locale:                     locale,
			Language:                   language,
			HelpFlags1:                 c.HelpFlags1,
			HasEditPermissionInFolders: hasEditPerm,
			Analytics: dtos.AnalyticsSettings{
				Identifier:         c.SignedInUser.Analytics.Identifier,
				IntercomIdentifier: c.SignedInUser.Analytics.IntercomIdentifier,
			},
		},
		Settings:                            settings,
		Theme:                               prefs.Theme,
		AppUrl:                              appURL,
		AppSubUrl:                           appSubURL,
		GoogleAnalyticsId:                   setting.GoogleAnalyticsId,
		GoogleAnalytics4Id:                  setting.GoogleAnalytics4Id,
		GoogleAnalytics4SendManualPageViews: setting.GoogleAnalytics4SendManualPageViews,
		GoogleTagManagerId:                  setting.GoogleTagManagerId,
		BuildVersion:                        setting.BuildVersion,
		BuildCommit:                         setting.BuildCommit,
		NewGrafanaVersion:                   hs.grafanaUpdateChecker.LatestVersion(),
		NewGrafanaVersionExists:             hs.grafanaUpdateChecker.UpdateAvailable(),
		AppName:                             setting.ApplicationName,
		AppNameBodyClass:                    "app-grafana",
		FavIcon:                             "public/img/smarthub_icon.png",
		AppleTouchIcon:                      "public/img/smarthub_icon.png",
		AppTitle:                            "SmartHub.ai",
		NavTree:                             navTree,
		Sentry:                              &hs.Cfg.Sentry,
		Nonce:                               c.RequestNonce,
		ContentDeliveryURL:                  hs.Cfg.GetContentDeliveryURL(hs.License.ContentDeliveryPrefix()),
		LoadingLogo:                         "url(\\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Ctitle%3EIOT logo%3C/title%3E%3Cg id='998d957f-a2db-4b5b-a060-402777ef4b0c' data-name='Layer 2'%3E%3Cpath d='M84.69,302.18a158.87,158.87,0,0,1-36.94-57.61,70.4,70.4,0,0,1-20.37-11.78A175.69,175.69,0,0,0,157.15,360.23a52.45,52.45,0,0,1,.92-16.24A158.35,158.35,0,0,1,84.69,302.18Z' fill='%230065ab'/%3E%3Cpath d='M197.33,14.25A175.68,175.68,0,0,0,38.22,115.77,70,70,0,0,1,60.43,108,160.38,160.38,0,0,1,84.69,76.9a159.65,159.65,0,0,1,172.67-35,82.68,82.68,0,0,1,6-6.73,80.4,80.4,0,0,1,6.09-5.5A174.72,174.72,0,0,0,197.33,14.25Z' fill='%230065ab'/%3E%3Cpath d='M118.81,124q2.94-3.51,6.22-6.8a102.47,102.47,0,0,1,115-20.59c-.09-1.6-.15-3.2-.15-4.82a80.05,80.05,0,0,1,.93-12.23A118.25,118.25,0,0,0,105.53,115,70.3,70.3,0,0,1,118.81,124Z' fill='%230065ab'/%3E%3Cpath d='M314.16,171.68a80.21,80.21,0,0,1-16.78-3,102.28,102.28,0,0,1-189.3,70.86A69.82,69.82,0,0,1,93.35,246a118.23,118.23,0,0,0,220.81-74.27Z' fill='%230065ab'/%3E%3Cpath d='M369.24,155a80.11,80.11,0,0,1-14.64,9.07,161.52,161.52,0,0,1,2,25.45,159.62,159.62,0,0,1-100.07,148,52.76,52.76,0,0,1,3,16,175.6,175.6,0,0,0,113.09-164A176.68,176.68,0,0,0,369.24,155Z' fill='%230065ab'/%3E%3Cpath d='M320,137.93a46.09,46.09,0,1,1,32.61-13.49h0A46,46,0,0,1,320,137.93Zm0-76.2a30.1,30.1,0,1,0,21.3,8.81A30,30,0,0,0,320,61.73Z' fill='%2336c9e1'/%3E%3Cpath d='M72.58,217a39,39,0,1,1,27.61-11.42A38.89,38.89,0,0,1,72.58,217Zm0-62.07a23,23,0,1,0,16.3,6.74A23,23,0,0,0,72.58,154.93Z' fill='%2336c9e1'/%3E%3Cpath d='M208.22,385.75a30,30,0,0,1-21.52-9,31,31,0,0,1,0-43.39,30.15,30.15,0,0,1,43.05,0,31,31,0,0,1,0,43.39h0A30,30,0,0,1,208.22,385.75Zm0-47.46a16.14,16.14,0,0,0-11.56,4.87,17,17,0,0,0,0,23.73,16.17,16.17,0,0,0,23.11,0h0a17,17,0,0,0,0-23.73A16.1,16.1,0,0,0,208.22,338.29Z' fill='%2336c9e1'/%3E%3Cpath d='M195.1,251.13a59.45,59.45,0,1,1,42-17.41h0A59,59,0,0,1,195.1,251.13Zm0-102.88a43.44,43.44,0,1,0,30.72,74.15h0a43.43,43.43,0,0,0-30.72-74.15Z' fill='%2336c9e1'/%3E%3C/g%3E%3C/svg%3E\\\")",
	}

	if !hs.AccessControl.IsDisabled() {
		userPermissions, err := hs.accesscontrolService.GetUserPermissions(c.Req.Context(), c.SignedInUser, ac.Options{ReloadCache: false})
		if err != nil {
			return nil, err
		}

		data.User.Permissions = ac.BuildPermissionsMap(userPermissions)
	}

	if setting.DisableGravatar {
		data.User.GravatarUrl = hs.Cfg.AppSubURL + "/public/img/user_profile.png"
	}

	if len(data.User.Name) == 0 {
		data.User.Name = data.User.Login
	}

	themeURLParam := c.Query("theme")
	if themeURLParam == lightName || themeURLParam == darkName || themeURLParam == systemName {
		data.User.Theme = themeURLParam
		data.Theme = themeURLParam
	}

	hs.HooksService.RunIndexDataHooks(&data, c)

	// This will remove empty cfg or admin sections and move sections around if topnav is enabled
	data.NavTree.RemoveEmptySectionsAndApplyNewInformationArchitecture(hs.Features.IsEnabled(featuremgmt.FlagTopnav))
	data.NavTree.Sort()

	return &data, nil
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
