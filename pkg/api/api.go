// Package api contains API logic.
package api

import (
	"time"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/frontendlogging"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
)

var plog = log.New("api")

// registerRoutes registers all API HTTP routes.
func (hs *HTTPServer) registerRoutes() {
	reqNoAuth := middleware.NoAuth()
	reqSignedIn := middleware.ReqSignedIn
	reqNotSignedIn := middleware.ReqNotSignedIn
	reqSignedInNoAnonymous := middleware.ReqSignedInNoAnonymous
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin
	reqEditorRole := middleware.ReqEditorRole
	reqOrgAdmin := middleware.ReqOrgAdmin
	reqOrgAdminFolderAdminOrTeamAdmin := middleware.OrgAdminFolderAdminOrTeamAdmin
	reqCanAccessTeams := middleware.AdminOrFeatureEnabled(hs.Cfg.EditorsCanAdmin)
	reqSnapshotPublicModeOrSignedIn := middleware.SnapshotPublicModeOrSignedIn(hs.Cfg)
	redirectFromLegacyPanelEditURL := middleware.RedirectFromLegacyPanelEditURL(hs.Cfg)
	authorize := acmiddleware.Middleware(hs.AccessControl)
	quota := middleware.Quota(hs.QuotaService)
	bind := binding.Bind

	r := hs.RouteRegister

	// not logged in views
	r.Get("/logout", hs.Logout)
	r.Post("/login", quota("session"), routing.Wrap(hs.LoginPost))
	r.Get("/login/:name", quota("session"), hs.OAuthLogin)
	r.Get("/login", hs.LoginView)
	r.Get("/invite/:code", hs.Index)

	// authed views
	r.Get("/", reqSignedIn, hs.Index)
	r.Get("/profile/", reqSignedInNoAnonymous, hs.Index)
	r.Get("/profile/password", reqSignedInNoAnonymous, hs.Index)
	r.Get("/.well-known/change-password", redirectToChangePassword)
	r.Get("/profile/switch-org/:id", reqSignedInNoAnonymous, hs.ChangeActiveOrgAndRedirectToHome)
	r.Get("/org/", reqOrgAdmin, hs.Index)
	r.Get("/org/new", reqGrafanaAdmin, hs.Index)
	r.Get("/datasources/", authorize(reqOrgAdmin, dataSourcesConfigurationAccessEvaluator), hs.Index)
	r.Get("/datasources/new", authorize(reqOrgAdmin, dataSourcesNewAccessEvaluator), hs.Index)
	r.Get("/datasources/edit/*", authorize(reqOrgAdmin, dataSourcesEditAccessEvaluator), hs.Index)
	r.Get("/org/users", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead, ac.ScopeUsersAll)), hs.Index)
	r.Get("/org/users/new", reqOrgAdmin, hs.Index)
	r.Get("/org/users/invite", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), hs.Index)
	r.Get("/org/teams", reqCanAccessTeams, hs.Index)
	r.Get("/org/teams/*", reqCanAccessTeams, hs.Index)
	r.Get("/org/apikeys/", reqOrgAdmin, hs.Index)
	r.Get("/dashboard/import/", reqSignedIn, hs.Index)
	r.Get("/configuration", reqGrafanaAdmin, hs.Index)
	r.Get("/admin", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/settings", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)), hs.Index)
	r.Get("/admin/users", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), hs.Index)
	r.Get("/admin/users/create", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersCreate)), hs.Index)
	r.Get("/admin/users/edit/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead)), hs.Index)
	r.Get("/admin/orgs", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/orgs/edit/:id", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/stats", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionServerStatsRead)), hs.Index)
	r.Get("/admin/ldap", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPStatusRead)), hs.Index)
	r.Get("/styleguide", reqSignedIn, hs.Index)

	r.Get("/live", reqGrafanaAdmin, hs.Index)
	r.Get("/live/pipeline", reqGrafanaAdmin, hs.Index)
	r.Get("/live/cloud", reqGrafanaAdmin, hs.Index)

	r.Get("/plugins", reqSignedIn, hs.Index)
	r.Get("/plugins/:id/", reqSignedIn, hs.Index)
	r.Get("/plugins/:id/edit", reqSignedIn, hs.Index) // deprecated
	r.Get("/plugins/:id/page/:page", reqSignedIn, hs.Index)
	r.Get("/a/:id/*", reqSignedIn, hs.Index) // App Root Page
	r.Get("/a/:id", reqSignedIn, hs.Index)

	r.Get("/d/:uid/:slug", reqSignedIn, redirectFromLegacyPanelEditURL, hs.Index)
	r.Get("/d/:uid", reqSignedIn, redirectFromLegacyPanelEditURL, hs.Index)
	r.Get("/dashboard/script/*", reqSignedIn, hs.Index)
	r.Get("/dashboard/new", reqSignedIn, hs.Index)
	r.Get("/dashboard-solo/snapshot/*", hs.Index)
	r.Get("/d-solo/:uid/:slug", reqSignedIn, hs.Index)
	r.Get("/d-solo/:uid", reqSignedIn, hs.Index)
	r.Get("/dashboard-solo/script/*", reqSignedIn, hs.Index)
	r.Get("/import/dashboard", reqSignedIn, hs.Index)
	r.Get("/dashboards/", reqSignedIn, hs.Index)
	r.Get("/dashboards/*", reqSignedIn, hs.Index)
	r.Get("/goto/:uid", reqSignedIn, hs.redirectFromShortURL, hs.Index)

	r.Get("/explore", authorize(func(c *models.ReqContext) {
		if f, ok := reqSignedIn.(func(c *models.ReqContext)); ok {
			f(c)
		}
		middleware.EnsureEditorOrViewerCanEdit(c)
	}, ac.EvalPermission(ac.ActionDatasourcesExplore)), hs.Index)

	r.Get("/playlists/", reqSignedIn, hs.Index)
	r.Get("/playlists/*", reqSignedIn, hs.Index)
	r.Get("/alerting/", reqSignedIn, hs.Index)
	r.Get("/alerting/*", reqSignedIn, hs.Index)

	// sign up
	r.Get("/verify", hs.Index)
	r.Get("/signup", hs.Index)
	r.Get("/api/user/signup/options", routing.Wrap(GetSignUpOptions))
	r.Post("/api/user/signup", quota("user"), bind(dtos.SignUpForm{}), routing.Wrap(SignUp))
	r.Post("/api/user/signup/step2", bind(dtos.SignUpStep2Form{}), routing.Wrap(hs.SignUpStep2))

	// invited
	r.Get("/api/user/invite/:code", routing.Wrap(GetInviteInfoByCode))
	r.Post("/api/user/invite/complete", bind(dtos.CompleteInviteForm{}), routing.Wrap(hs.CompleteInvite))

	// reset password
	r.Get("/user/password/send-reset-email", reqNotSignedIn, hs.Index)
	r.Get("/user/password/reset", hs.Index)

	r.Post("/api/user/password/send-reset-email", bind(dtos.SendResetPasswordEmailForm{}), routing.Wrap(SendResetPasswordEmail))
	r.Post("/api/user/password/reset", bind(dtos.ResetUserPasswordForm{}), routing.Wrap(ResetPassword))

	// dashboard snapshots
	r.Get("/dashboard/snapshot/*", reqNoAuth, hs.Index)
	r.Get("/dashboard/snapshots/", reqSignedIn, hs.Index)

	// api renew session based on cookie
	r.Get("/api/login/ping", quota("session"), routing.Wrap(hs.LoginAPIPing))

	// expose plugin file system assets
	r.Get("/public/plugins/:pluginId/*", hs.getPluginAssets)

	// authed api
	r.Group("/api", func(apiRoute routing.RouteRegister) {
		// user (signed in)
		apiRoute.Group("/user", func(userRoute routing.RouteRegister) {
			userRoute.Get("/", routing.Wrap(GetSignedInUser))
			userRoute.Put("/", bind(models.UpdateUserCommand{}), routing.Wrap(UpdateSignedInUser))
			userRoute.Post("/using/:id", routing.Wrap(UserSetUsingOrg))
			userRoute.Get("/orgs", routing.Wrap(GetSignedInUserOrgList))
			userRoute.Get("/teams", routing.Wrap(GetSignedInUserTeamList))

			userRoute.Post("/stars/dashboard/:id", routing.Wrap(StarDashboard))
			userRoute.Delete("/stars/dashboard/:id", routing.Wrap(UnstarDashboard))

			userRoute.Put("/password", bind(models.ChangeUserPasswordCommand{}), routing.Wrap(ChangeUserPassword))
			userRoute.Get("/quotas", routing.Wrap(GetUserQuotas))
			userRoute.Put("/helpflags/:id", routing.Wrap(SetHelpFlag))
			// For dev purpose
			userRoute.Get("/helpflags/clear", routing.Wrap(ClearHelpFlags))

			userRoute.Get("/preferences", routing.Wrap(hs.GetUserPreferences))
			userRoute.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), routing.Wrap(hs.UpdateUserPreferences))

			userRoute.Get("/auth-tokens", routing.Wrap(hs.GetUserAuthTokens))
			userRoute.Post("/revoke-auth-token", bind(models.RevokeAuthTokenCmd{}), routing.Wrap(hs.RevokeUserAuthToken))
		}, reqSignedInNoAnonymous)

		// users (admin permission required)
		apiRoute.Group("/users", func(usersRoute routing.RouteRegister) {
			userIDScope := ac.Scope("global", "users", "id", ac.Parameter(":id"))
			usersRoute.Get("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.searchUsersService.SearchUsers))
			usersRoute.Get("/search", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.searchUsersService.SearchUsersWithPaging))
			usersRoute.Get("/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(GetUserByID))
			usersRoute.Get("/:id/teams", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersTeamRead, userIDScope)), routing.Wrap(GetUserTeams))
			usersRoute.Get("/:id/orgs", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(GetUserByLoginOrEmail))
			usersRoute.Put("/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), bind(models.UpdateUserCommand{}), routing.Wrap(UpdateUser))
			usersRoute.Post("/:id/using/:orgId", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(UpdateUserActiveOrg))
		})

		// team (admin permission required)
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Post("/", bind(models.CreateTeamCommand{}), routing.Wrap(hs.CreateTeam))
			teamsRoute.Put("/:teamId", bind(models.UpdateTeamCommand{}), routing.Wrap(hs.UpdateTeam))
			teamsRoute.Delete("/:teamId", routing.Wrap(hs.DeleteTeamByID))
			teamsRoute.Get("/:teamId/members", routing.Wrap(hs.GetTeamMembers))
			teamsRoute.Post("/:teamId/members", bind(models.AddTeamMemberCommand{}), routing.Wrap(hs.AddTeamMember))
			teamsRoute.Put("/:teamId/members/:userId", bind(models.UpdateTeamMemberCommand{}), routing.Wrap(hs.UpdateTeamMember))
			teamsRoute.Delete("/:teamId/members/:userId", routing.Wrap(hs.RemoveTeamMember))
			teamsRoute.Get("/:teamId/preferences", routing.Wrap(hs.GetTeamPreferences))
			teamsRoute.Put("/:teamId/preferences", bind(dtos.UpdatePrefsCmd{}), routing.Wrap(hs.UpdateTeamPreferences))
		}, reqCanAccessTeams)

		// team without requirement of user to be org admin
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Get("/:teamId", routing.Wrap(hs.GetTeamByID))
			teamsRoute.Get("/search", routing.Wrap(hs.SearchTeams))
		})

		// org information available to all users.
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/", authorize(reqSignedIn, ac.EvalPermission(ActionOrgsRead, ScopeOrgCurrentID)), routing.Wrap(GetCurrentOrg))
			orgRoute.Get("/quotas", authorize(reqSignedIn, ac.EvalPermission(ActionOrgsQuotasRead, ScopeOrgCurrentID)), routing.Wrap(hs.GetCurrentOrgQuotas))
		})

		// current org
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgRoute.Put("/", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsWrite, ScopeOrgCurrentID)), bind(dtos.UpdateOrgForm{}), routing.Wrap(UpdateCurrentOrg))
			orgRoute.Put("/address", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsWrite, ScopeOrgCurrentID)), bind(dtos.UpdateOrgAddressForm{}), routing.Wrap(UpdateCurrentOrgAddress))
			orgRoute.Get("/users", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead, ac.ScopeUsersAll)), routing.Wrap(hs.GetOrgUsersForCurrentOrg))
			orgRoute.Get("/users/search", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead, ac.ScopeUsersAll)), routing.Wrap(hs.SearchOrgUsersWithPaging))
			orgRoute.Post("/users", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), quota("user"), bind(models.AddOrgUserCommand{}), routing.Wrap(AddOrgUserToCurrentOrg))
			orgRoute.Patch("/users/:userId", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRoleUpdate, userIDScope)), bind(models.UpdateOrgUserCommand{}), routing.Wrap(UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(GetPendingOrgInvites))
			orgRoute.Post("/invites", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), quota("user"), bind(dtos.AddInviteForm{}), routing.Wrap(AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsPreferencesRead, ScopeOrgCurrentID)), routing.Wrap(hs.GetOrgPreferences))
			orgRoute.Put("/preferences", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsPreferencesWrite, ScopeOrgCurrentID)), bind(dtos.UpdatePrefsCmd{}), routing.Wrap(hs.UpdateOrgPreferences))
		})

		// current org without requirement of user to be org admin
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/users/lookup", authorize(reqOrgAdminFolderAdminOrTeamAdmin, ac.EvalPermission(ac.ActionOrgUsersRead, ac.ScopeUsersAll)), routing.Wrap(hs.GetOrgUsersForCurrentOrgLookup))
		})

		// create new org
		apiRoute.Post("/orgs", authorize(reqSignedIn, ac.EvalPermission(ActionOrgsCreate)), quota("org"), bind(models.CreateOrgCommand{}), routing.Wrap(hs.CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsRead, ScopeOrgsAll)), routing.Wrap(SearchOrgs))

		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute routing.RouteRegister) {
			orgsRoute.Get("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsRead, ScopeOrgID)), routing.Wrap(GetOrgByID))
			orgsRoute.Put("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsWrite, ScopeOrgID)), bind(dtos.UpdateOrgForm{}), routing.Wrap(UpdateOrg))
			orgsRoute.Put("/address", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsWrite, ScopeOrgID)), bind(dtos.UpdateOrgAddressForm{}), routing.Wrap(UpdateOrgAddress))
			orgsRoute.Delete("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsDelete, ScopeOrgID)), routing.Wrap(DeleteOrgByID))
			orgsRoute.Get("/users", reqGrafanaAdmin, routing.Wrap(hs.GetOrgUsers))
			orgsRoute.Post("/users", reqGrafanaAdmin, bind(models.AddOrgUserCommand{}), routing.Wrap(AddOrgUser))
			orgsRoute.Patch("/users/:userId", reqGrafanaAdmin, bind(models.UpdateOrgUserCommand{}), routing.Wrap(UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", reqGrafanaAdmin, routing.Wrap(RemoveOrgUser))
			orgsRoute.Get("/quotas", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsQuotasRead, ScopeOrgID)), routing.Wrap(hs.GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsQuotasWrite, ScopeOrgID)), bind(models.UpdateOrgQuotaCmd{}), routing.Wrap(hs.UpdateOrgQuota))
		})

		// orgs (admin routes)
		apiRoute.Get("/orgs/name/:name/", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionOrgsRead, ScopeOrgName)), routing.Wrap(hs.GetOrgByName))

		// auth api keys
		apiRoute.Group("/auth/keys", func(keysRoute routing.RouteRegister) {
			keysRoute.Get("/", routing.Wrap(GetAPIKeys))
			keysRoute.Post("/", quota("api_key"), bind(models.AddApiKeyCommand{}), routing.Wrap(hs.AddAPIKey))
			keysRoute.Post("/additional", quota("api_key"), bind(models.AddApiKeyCommand{}), routing.Wrap(hs.AdditionalAPIKey))
			keysRoute.Delete("/:id", routing.Wrap(DeleteAPIKey))
		}, reqOrgAdmin)

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute routing.RouteRegister) {
			prefRoute.Post("/set-home-dash", bind(models.SavePreferencesCommand{}), routing.Wrap(SetHomeDashboard))
		})

		// Data sources
		apiRoute.Group("/datasources", func(datasourceRoute routing.RouteRegister) {
			datasourceRoute.Get("/", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead, ScopeDatasourcesAll)), routing.Wrap(hs.GetDataSources))
			datasourceRoute.Post("/", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesCreate)), quota("data_source"), bind(models.AddDataSourceCommand{}), routing.Wrap(AddDataSource))
			datasourceRoute.Put("/:id", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesWrite, ScopeDatasourceID)), bind(models.UpdateDataSourceCommand{}), routing.Wrap(hs.UpdateDataSource))
			datasourceRoute.Delete("/:id", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesDelete, ScopeDatasourceID)), routing.Wrap(hs.DeleteDataSourceById))
			datasourceRoute.Delete("/uid/:uid", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesDelete, ScopeDatasourceUID)), routing.Wrap(hs.DeleteDataSourceByUID))
			datasourceRoute.Delete("/name/:name", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesDelete, ScopeDatasourceName)), routing.Wrap(hs.DeleteDataSourceByName))
			datasourceRoute.Get("/:id", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead, ScopeDatasourceID)), routing.Wrap(GetDataSourceById))
			datasourceRoute.Get("/uid/:uid", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead, ScopeDatasourceUID)), routing.Wrap(GetDataSourceByUID))
			datasourceRoute.Get("/name/:name", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead, ScopeDatasourceName)), routing.Wrap(GetDataSourceByName))
		})

		apiRoute.Get("/datasources/id/:name", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesIDRead, ScopeDatasourceName)), routing.Wrap(GetDataSourceIdByName))

		apiRoute.Get("/plugins", routing.Wrap(hs.GetPluginList))
		apiRoute.Get("/plugins/:pluginId/settings", routing.Wrap(hs.GetPluginSettingByID))
		apiRoute.Get("/plugins/:pluginId/markdown/:name", routing.Wrap(hs.GetPluginMarkdown))
		apiRoute.Get("/plugins/:pluginId/health", routing.Wrap(hs.CheckHealth))
		apiRoute.Any("/plugins/:pluginId/resources", hs.CallResource)
		apiRoute.Any("/plugins/:pluginId/resources/*", hs.CallResource)
		apiRoute.Get("/plugins/errors", routing.Wrap(hs.GetPluginErrorsList))

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Post("/:pluginId/install", bind(dtos.InstallPluginCommand{}), routing.Wrap(hs.InstallPlugin))
			pluginRoute.Post("/:pluginId/uninstall", routing.Wrap(hs.UninstallPlugin))
		}, reqGrafanaAdmin)

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Get("/:pluginId/dashboards/", routing.Wrap(hs.GetPluginDashboards))
			pluginRoute.Post("/:pluginId/settings", bind(models.UpdatePluginSettingCmd{}), routing.Wrap(hs.UpdatePluginSetting))
			pluginRoute.Get("/:pluginId/metrics", routing.Wrap(hs.CollectPluginMetrics))
		}, reqOrgAdmin)

		apiRoute.Get("/frontend/settings/", hs.GetFrontendSettings)
		apiRoute.Any("/datasources/proxy/:id/*", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/proxy/:id", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/:id/resources", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), hs.CallDatasourceResource)
		apiRoute.Any("/datasources/:id/resources/*", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), hs.CallDatasourceResource)
		apiRoute.Any("/datasources/:id/health", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), routing.Wrap(hs.CheckDatasourceHealth))

		// Folders
		apiRoute.Group("/folders", func(folderRoute routing.RouteRegister) {
			folderRoute.Get("/", routing.Wrap(hs.GetFolders))
			folderRoute.Get("/id/:id", routing.Wrap(hs.GetFolderByID))
			folderRoute.Post("/", bind(models.CreateFolderCommand{}), routing.Wrap(hs.CreateFolder))

			folderRoute.Group("/:uid", func(folderUidRoute routing.RouteRegister) {
				folderUidRoute.Get("/", routing.Wrap(hs.GetFolderByUID))
				folderUidRoute.Put("/", bind(models.UpdateFolderCommand{}), routing.Wrap(hs.UpdateFolder))
				folderUidRoute.Delete("/", routing.Wrap(hs.DeleteFolder))

				folderUidRoute.Group("/permissions", func(folderPermissionRoute routing.RouteRegister) {
					folderPermissionRoute.Get("/", routing.Wrap(hs.GetFolderPermissionList))
					folderPermissionRoute.Post("/", bind(dtos.UpdateDashboardAclCommand{}), routing.Wrap(hs.UpdateFolderPermissions))
				})
			})
		})

		// Dashboard
		apiRoute.Group("/dashboards", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/uid/:uid", routing.Wrap(hs.GetDashboard))
			dashboardRoute.Delete("/uid/:uid", routing.Wrap(hs.DeleteDashboardByUID))

			dashboardRoute.Post("/calculate-diff", bind(dtos.CalculateDiffOptions{}), routing.Wrap(CalculateDashboardDiff))
			dashboardRoute.Post("/trim", bind(models.TrimDashboardCommand{}), routing.Wrap(hs.TrimDashboard))

			dashboardRoute.Post("/db", bind(models.SaveDashboardCommand{}), routing.Wrap(hs.PostDashboard))
			dashboardRoute.Get("/home", routing.Wrap(hs.GetHomeDashboard))
			dashboardRoute.Get("/tags", GetDashboardTags)
			dashboardRoute.Post("/import", bind(dtos.ImportDashboardCommand{}), routing.Wrap(hs.ImportDashboard))

			dashboardRoute.Group("/id/:dashboardId", func(dashIdRoute routing.RouteRegister) {
				dashIdRoute.Get("/versions", routing.Wrap(GetDashboardVersions))
				dashIdRoute.Get("/versions/:id", routing.Wrap(GetDashboardVersion))
				dashIdRoute.Post("/restore", bind(dtos.RestoreDashboardVersionCommand{}), routing.Wrap(hs.RestoreDashboardVersion))

				dashIdRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", routing.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", bind(dtos.UpdateDashboardAclCommand{}), routing.Wrap(hs.UpdateDashboardPermissions))
				})
			})
		})

		// Dashboard snapshots
		apiRoute.Group("/dashboard/snapshots", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/", routing.Wrap(SearchDashboardSnapshots))
		})

		// Playlist
		apiRoute.Group("/playlists", func(playlistRoute routing.RouteRegister) {
			playlistRoute.Get("/", routing.Wrap(SearchPlaylists))
			playlistRoute.Get("/:id", ValidateOrgPlaylist, routing.Wrap(GetPlaylist))
			playlistRoute.Get("/:id/items", ValidateOrgPlaylist, routing.Wrap(GetPlaylistItems))
			playlistRoute.Get("/:id/dashboards", ValidateOrgPlaylist, routing.Wrap(GetPlaylistDashboards))
			playlistRoute.Delete("/:id", reqEditorRole, ValidateOrgPlaylist, routing.Wrap(DeletePlaylist))
			playlistRoute.Put("/:id", reqEditorRole, bind(models.UpdatePlaylistCommand{}), ValidateOrgPlaylist, routing.Wrap(UpdatePlaylist))
			playlistRoute.Post("/", reqEditorRole, bind(models.CreatePlaylistCommand{}), routing.Wrap(CreatePlaylist))
		})

		// Search
		apiRoute.Get("/search/sorting", routing.Wrap(hs.ListSortOptions))
		apiRoute.Get("/search/", routing.Wrap(Search))

		// metrics
		apiRoute.Post("/tsdb/query", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), bind(dtos.MetricRequest{}), routing.Wrap(hs.QueryMetrics))

		// DataSource w/ expressions
		apiRoute.Post("/ds/query", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), bind(dtos.MetricRequest{}), routing.Wrap(hs.QueryMetricsV2))

		apiRoute.Group("/alerts", func(alertsRoute routing.RouteRegister) {
			alertsRoute.Post("/test", bind(dtos.AlertTestCommand{}), routing.Wrap(hs.AlertTest))
			alertsRoute.Post("/:alertId/pause", reqEditorRole, bind(dtos.PauseAlertCommand{}), routing.Wrap(PauseAlert))
			alertsRoute.Get("/:alertId", ValidateOrgAlert, routing.Wrap(GetAlert))
			alertsRoute.Get("/", routing.Wrap(GetAlerts))
			alertsRoute.Get("/states-for-dashboard", routing.Wrap(GetAlertStatesForDashboard))
		})

		apiRoute.Get("/alert-notifiers", reqEditorRole, routing.Wrap(
			GetAlertNotifiers(hs.Cfg.UnifiedAlerting.Enabled)),
		)

		apiRoute.Group("/alert-notifications", func(alertNotifications routing.RouteRegister) {
			alertNotifications.Get("/", routing.Wrap(GetAlertNotifications))
			alertNotifications.Post("/test", bind(dtos.NotificationTestCommand{}), routing.Wrap(NotificationTest))
			alertNotifications.Post("/", bind(models.CreateAlertNotificationCommand{}), routing.Wrap(CreateAlertNotification))
			alertNotifications.Put("/:notificationId", bind(models.UpdateAlertNotificationCommand{}), routing.Wrap(hs.UpdateAlertNotification))
			alertNotifications.Get("/:notificationId", routing.Wrap(GetAlertNotificationByID))
			alertNotifications.Delete("/:notificationId", routing.Wrap(DeleteAlertNotification))
			alertNotifications.Get("/uid/:uid", routing.Wrap(GetAlertNotificationByUID))
			alertNotifications.Put("/uid/:uid", bind(models.UpdateAlertNotificationWithUidCommand{}), routing.Wrap(hs.UpdateAlertNotificationByUID))
			alertNotifications.Delete("/uid/:uid", routing.Wrap(DeleteAlertNotificationByUID))
		}, reqEditorRole)

		// alert notifications without requirement of user to be org editor
		apiRoute.Group("/alert-notifications", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/lookup", routing.Wrap(GetAlertNotificationLookup))
		})

		apiRoute.Get("/annotations", routing.Wrap(GetAnnotations))
		apiRoute.Post("/annotations/mass-delete", reqOrgAdmin, bind(dtos.DeleteAnnotationsCmd{}), routing.Wrap(DeleteAnnotations))

		apiRoute.Group("/annotations", func(annotationsRoute routing.RouteRegister) {
			annotationsRoute.Post("/", bind(dtos.PostAnnotationsCmd{}), routing.Wrap(PostAnnotation))
			annotationsRoute.Delete("/:annotationId", routing.Wrap(DeleteAnnotationByID))
			annotationsRoute.Put("/:annotationId", bind(dtos.UpdateAnnotationsCmd{}), routing.Wrap(UpdateAnnotation))
			annotationsRoute.Patch("/:annotationId", bind(dtos.PatchAnnotationsCmd{}), routing.Wrap(PatchAnnotation))
			annotationsRoute.Post("/graphite", reqEditorRole, bind(dtos.PostGraphiteAnnotationsCmd{}), routing.Wrap(PostGraphiteAnnotation))
			annotationsRoute.Get("/tags", routing.Wrap(GetAnnotationTags))
		})

		apiRoute.Post("/frontend-metrics", bind(metrics.PostFrontendMetricsCommand{}), routing.Wrap(hs.PostFrontendMetrics))

		apiRoute.Group("/live", func(liveRoute routing.RouteRegister) {
			// the channel path is in the name
			liveRoute.Post("/publish", bind(dtos.LivePublishCmd{}), routing.Wrap(hs.Live.HandleHTTPPublish))

			// POST influx line protocol.
			liveRoute.Post("/push/:streamId", hs.LivePushGateway.Handle)

			// List available streams and fields
			liveRoute.Get("/list", routing.Wrap(hs.Live.HandleListHTTP))

			// Some channels may have info
			liveRoute.Get("/info/*", routing.Wrap(hs.Live.HandleInfoHTTP))

			if hs.Cfg.FeatureToggles["live-pipeline"] {
				// POST Live data to be processed according to channel rules.
				liveRoute.Post("/pipeline/push/*", hs.LivePushGateway.HandlePipelinePush)
				liveRoute.Post("/pipeline-convert-test", routing.Wrap(hs.Live.HandlePipelineConvertTestHTTP), reqOrgAdmin)
				liveRoute.Get("/pipeline-entities", routing.Wrap(hs.Live.HandlePipelineEntitiesListHTTP), reqOrgAdmin)
				liveRoute.Get("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesListHTTP), reqOrgAdmin)
				liveRoute.Post("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesPostHTTP), reqOrgAdmin)
				liveRoute.Put("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesPutHTTP), reqOrgAdmin)
				liveRoute.Delete("/channel-rules", routing.Wrap(hs.Live.HandleChannelRulesDeleteHTTP), reqOrgAdmin)
				liveRoute.Get("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsListHTTP), reqOrgAdmin)
				liveRoute.Post("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsPostHTTP), reqOrgAdmin)
				liveRoute.Put("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsPutHTTP), reqOrgAdmin)
				liveRoute.Delete("/write-configs", routing.Wrap(hs.Live.HandleWriteConfigsDeleteHTTP), reqOrgAdmin)
			}
		})

		// short urls
		apiRoute.Post("/short-urls", bind(dtos.CreateShortURLCmd{}), routing.Wrap(hs.createShortURL))
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		adminRoute.Get("/settings", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)), routing.Wrap(hs.AdminGetSettings))
		adminRoute.Get("/stats", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionServerStatsRead)), routing.Wrap(AdminGetStats))
		adminRoute.Post("/pause-all-alerts", reqGrafanaAdmin, bind(dtos.PauseAllAlertsCommand{}), routing.Wrap(PauseAllAlerts))

		adminRoute.Post("/provisioning/dashboards/reload", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersDashboards)), routing.Wrap(hs.AdminProvisioningReloadDashboards))
		adminRoute.Post("/provisioning/plugins/reload", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersPlugins)), routing.Wrap(hs.AdminProvisioningReloadPlugins))
		adminRoute.Post("/provisioning/datasources/reload", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersDatasources)), routing.Wrap(hs.AdminProvisioningReloadDatasources))
		adminRoute.Post("/provisioning/notifications/reload", authorize(reqGrafanaAdmin, ac.EvalPermission(ActionProvisioningReload, ScopeProvisionersNotifications)), routing.Wrap(hs.AdminProvisioningReloadNotifications))

		adminRoute.Post("/ldap/reload", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPConfigReload)), routing.Wrap(hs.ReloadLDAPCfg))
		adminRoute.Post("/ldap/sync/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPUsersSync)), routing.Wrap(hs.PostSyncUserWithLDAP))
		adminRoute.Get("/ldap/:username", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPUsersRead)), routing.Wrap(hs.GetUserFromLDAP))
		adminRoute.Get("/ldap/status", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPStatusRead)), routing.Wrap(hs.GetLDAPStatus))
	})

	// Administering users
	r.Group("/api/admin/users", func(adminUserRoute routing.RouteRegister) {
		userIDScope := ac.Scope("global", "users", "id", ac.Parameter(":id"))

		adminUserRoute.Post("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersCreate)), bind(dtos.AdminCreateUserForm{}), routing.Wrap(hs.AdminCreateUser))
		adminUserRoute.Put("/:id/password", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersPasswordUpdate, userIDScope)), bind(dtos.AdminUpdateUserPasswordForm{}), routing.Wrap(AdminUpdateUserPassword))
		adminUserRoute.Put("/:id/permissions", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersPermissionsUpdate, userIDScope)), bind(dtos.AdminUpdateUserPermissionsForm{}), routing.Wrap(hs.AdminUpdateUserPermissions))
		adminUserRoute.Delete("/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersDelete, userIDScope)), routing.Wrap(AdminDeleteUser))
		adminUserRoute.Post("/:id/disable", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersDisable, userIDScope)), routing.Wrap(hs.AdminDisableUser))
		adminUserRoute.Post("/:id/enable", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersEnable, userIDScope)), routing.Wrap(AdminEnableUser))
		adminUserRoute.Get("/:id/quotas", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersQuotasList, userIDScope)), routing.Wrap(GetUserQuotas))
		adminUserRoute.Put("/:id/quotas/:target", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersQuotasUpdate, userIDScope)), bind(models.UpdateUserQuotaCmd{}), routing.Wrap(UpdateUserQuota))

		adminUserRoute.Post("/:id/logout", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersLogout, userIDScope)), routing.Wrap(hs.AdminLogoutUser))
		adminUserRoute.Get("/:id/auth-tokens", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersAuthTokenList, userIDScope)), routing.Wrap(hs.AdminGetUserAuthTokens))
		adminUserRoute.Post("/:id/revoke-auth-token", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersAuthTokenUpdate, userIDScope)), bind(models.RevokeAuthTokenCmd{}), routing.Wrap(hs.AdminRevokeUserAuthToken))
	})

	// rendering
	r.Get("/render/*", reqSignedIn, hs.RenderToPng)

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, hs.ProxyGnetRequest)

	// Gravatar service.
	avatarCacheServer := avatar.NewCacheServer(hs.Cfg)
	r.Get("/avatar/:hash", avatarCacheServer.Handler)

	// Snapshots
	r.Post("/api/snapshots/", reqSnapshotPublicModeOrSignedIn, bind(models.CreateDashboardSnapshotCommand{}), CreateDashboardSnapshot)
	r.Get("/api/snapshot/shared-options/", reqSignedIn, GetSharingOptions)
	r.Get("/api/snapshots/:key", routing.Wrap(GetDashboardSnapshot))
	r.Get("/api/snapshots-delete/:deleteKey", reqSnapshotPublicModeOrSignedIn, routing.Wrap(DeleteDashboardSnapshotByDeleteKey))
	r.Delete("/api/snapshots/:key", reqEditorRole, routing.Wrap(DeleteDashboardSnapshot))

	// Frontend logs
	sourceMapStore := frontendlogging.NewSourceMapStore(hs.Cfg, hs.pluginStaticRouteResolver, frontendlogging.ReadSourceMapFromFS)
	r.Post("/log", middleware.RateLimit(hs.Cfg.Sentry.EndpointRPS, hs.Cfg.Sentry.EndpointBurst, time.Now),
		bind(frontendlogging.FrontendSentryEvent{}), routing.Wrap(NewFrontendLogMessageHandler(sourceMapStore)))
}
