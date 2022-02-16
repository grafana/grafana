// Package api contains API logic.
package api

import (
	"time"

	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/frontendlogging"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	reqCanAccessTeams := middleware.AdminOrEditorAndFeatureEnabled(hs.Cfg.EditorsCanAdmin)
	reqSnapshotPublicModeOrSignedIn := middleware.SnapshotPublicModeOrSignedIn(hs.Cfg)
	redirectFromLegacyPanelEditURL := middleware.RedirectFromLegacyPanelEditURL(hs.Cfg)
	authorize := acmiddleware.Middleware(hs.AccessControl)
	authorizeInOrg := acmiddleware.AuthorizeInOrgMiddleware(hs.AccessControl, hs.SQLStore)
	quota := middleware.Quota(hs.QuotaService)

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
	r.Get("/org/", authorize(reqOrgAdmin, orgPreferencesAccessEvaluator), hs.Index)
	r.Get("/org/new", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseGlobalOrg, orgsCreateAccessEvaluator), hs.Index)
	r.Get("/datasources/", authorize(reqOrgAdmin, dataSourcesConfigurationAccessEvaluator), hs.Index)
	r.Get("/datasources/new", authorize(reqOrgAdmin, dataSourcesNewAccessEvaluator), hs.Index)
	r.Get("/datasources/edit/*", authorize(reqOrgAdmin, dataSourcesEditAccessEvaluator), hs.Index)
	r.Get("/org/users", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)), hs.Index)
	r.Get("/org/users/new", reqOrgAdmin, hs.Index)
	r.Get("/org/users/invite", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), hs.Index)
	r.Get("/org/teams", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsRead)), hs.Index)
	r.Get("/org/teams/edit/*", authorize(reqCanAccessTeams, teamsEditAccessEvaluator), hs.Index)
	r.Get("/org/teams/new", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsCreate)), hs.Index)
	r.Get("/org/serviceaccounts", middleware.ReqOrgAdmin, hs.Index)
	r.Get("/org/serviceaccounts/:serviceAccountId", middleware.ReqOrgAdmin, hs.Index)
	r.Get("/org/apikeys/", reqOrgAdmin, hs.Index)
	r.Get("/dashboard/import/", reqSignedIn, hs.Index)
	r.Get("/configuration", reqGrafanaAdmin, hs.Index)
	r.Get("/admin", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/settings", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)), hs.Index)
	r.Get("/admin/users", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), hs.Index)
	r.Get("/admin/users/create", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersCreate)), hs.Index)
	r.Get("/admin/users/edit/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead)), hs.Index)
	r.Get("/admin/orgs", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseGlobalOrg, orgsAccessEvaluator), hs.Index)
	r.Get("/admin/orgs/edit/:id", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseGlobalOrg, orgsAccessEvaluator), hs.Index)
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
	r.Post("/api/user/signup", quota("user"), routing.Wrap(hs.SignUp))
	r.Post("/api/user/signup/step2", routing.Wrap(hs.SignUpStep2))

	// invited
	r.Get("/api/user/invite/:code", routing.Wrap(hs.GetInviteInfoByCode))
	r.Post("/api/user/invite/complete", routing.Wrap(hs.CompleteInvite))

	// reset password
	r.Get("/user/password/send-reset-email", reqNotSignedIn, hs.Index)
	r.Get("/user/password/reset", hs.Index)

	r.Post("/api/user/password/send-reset-email", routing.Wrap(hs.SendResetPasswordEmail))
	r.Post("/api/user/password/reset", routing.Wrap(hs.ResetPassword))

	// dashboard snapshots
	r.Get("/dashboard/snapshot/*", reqNoAuth, hs.Index)
	r.Get("/dashboard/snapshots/", reqSignedIn, hs.Index)

	// api renew session based on cookie
	r.Get("/api/login/ping", quota("session"), routing.Wrap(hs.LoginAPIPing))

	// expose plugin file system assets
	r.Get("/public/plugins/:pluginId/*", hs.getPluginAssets)

	if hs.Features.IsEnabled(featuremgmt.FlagSwaggerUi) {
		r.Get("/swagger-ui", swaggerUI)
	}

	// authed api
	r.Group("/api", func(apiRoute routing.RouteRegister) {
		// user (signed in)
		apiRoute.Group("/user", func(userRoute routing.RouteRegister) {
			userRoute.Get("/", routing.Wrap(hs.GetSignedInUser))
			userRoute.Put("/", routing.Wrap(hs.UpdateSignedInUser))
			userRoute.Post("/using/:id", routing.Wrap(hs.UserSetUsingOrg))
			userRoute.Get("/orgs", routing.Wrap(hs.GetSignedInUserOrgList))
			userRoute.Get("/teams", routing.Wrap(hs.GetSignedInUserTeamList))

			userRoute.Post("/stars/dashboard/:id", routing.Wrap(hs.StarDashboard))
			userRoute.Delete("/stars/dashboard/:id", routing.Wrap(hs.UnstarDashboard))

			userRoute.Put("/password", routing.Wrap(hs.ChangeUserPassword))
			userRoute.Get("/quotas", routing.Wrap(hs.GetUserQuotas))
			userRoute.Put("/helpflags/:id", routing.Wrap(hs.SetHelpFlag))
			// For dev purpose
			userRoute.Get("/helpflags/clear", routing.Wrap(hs.ClearHelpFlags))

			userRoute.Get("/preferences", routing.Wrap(hs.GetUserPreferences))
			userRoute.Put("/preferences", routing.Wrap(hs.UpdateUserPreferences))

			userRoute.Get("/auth-tokens", routing.Wrap(hs.GetUserAuthTokens))
			userRoute.Post("/revoke-auth-token", routing.Wrap(hs.RevokeUserAuthToken))
		}, reqSignedInNoAnonymous)

		apiRoute.Group("/users", func(usersRoute routing.RouteRegister) {
			userIDScope := ac.Scope("global", "users", "id", ac.Parameter(":id"))
			usersRoute.Get("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.searchUsersService.SearchUsers))
			usersRoute.Get("/search", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.searchUsersService.SearchUsersWithPaging))
			usersRoute.Get("/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserByID))
			usersRoute.Get("/:id/teams", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersTeamRead, userIDScope)), routing.Wrap(hs.GetUserTeams))
			usersRoute.Get("/:id/orgs", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, userIDScope)), routing.Wrap(hs.GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)), routing.Wrap(hs.GetUserByLoginOrEmail))
			usersRoute.Put("/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(hs.UpdateUser))
			usersRoute.Post("/:id/using/:orgId", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersWrite, userIDScope)), routing.Wrap(hs.UpdateUserActiveOrg))
		})

		// team (admin permission required)
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Post("/", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsCreate)), routing.Wrap(hs.CreateTeam))
			teamsRoute.Put("/:teamId", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.UpdateTeam))
			teamsRoute.Delete("/:teamId", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsDelete, ac.ScopeTeamsID)), routing.Wrap(hs.DeleteTeamByID))
			teamsRoute.Get("/:teamId/members", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsPermissionsRead, ac.ScopeTeamsID)), routing.Wrap(hs.GetTeamMembers))
			teamsRoute.Post("/:teamId/members", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsPermissionsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.AddTeamMember))
			teamsRoute.Put("/:teamId/members/:userId", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsPermissionsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.UpdateTeamMember))
			teamsRoute.Delete("/:teamId/members/:userId", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsPermissionsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.RemoveTeamMember))
			teamsRoute.Get("/:teamId/preferences", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsRead, ac.ScopeTeamsID)), routing.Wrap(hs.GetTeamPreferences))
			teamsRoute.Put("/:teamId/preferences", authorize(reqCanAccessTeams, ac.EvalPermission(ac.ActionTeamsWrite, ac.ScopeTeamsID)), routing.Wrap(hs.UpdateTeamPreferences))
		})

		// team without requirement of user to be org admin
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Get("/:teamId", authorize(reqSignedIn, ac.EvalPermission(ac.ActionTeamsRead, ac.ScopeTeamsID)), routing.Wrap(hs.GetTeamByID))
			teamsRoute.Get("/search", authorize(reqSignedIn, ac.EvalPermission(ac.ActionTeamsRead)), routing.Wrap(hs.SearchTeams))
		})

		// org information available to all users.
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/", authorize(reqSignedIn, ac.EvalPermission(ActionOrgsRead)), routing.Wrap(GetCurrentOrg))
			orgRoute.Get("/quotas", authorize(reqSignedIn, ac.EvalPermission(ActionOrgsQuotasRead)), routing.Wrap(hs.GetCurrentOrgQuotas))
		})

		// current org
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgRoute.Put("/", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsWrite)), routing.Wrap(hs.UpdateCurrentOrg))
			orgRoute.Put("/address", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsWrite)), routing.Wrap(hs.UpdateCurrentOrgAddress))
			orgRoute.Get("/users", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.GetOrgUsersForCurrentOrg))
			orgRoute.Get("/users/search", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.SearchOrgUsersWithPaging))
			orgRoute.Post("/users", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), quota("user"), routing.Wrap(hs.AddOrgUserToCurrentOrg))
			orgRoute.Patch("/users/:userId", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRoleUpdate, userIDScope)), routing.Wrap(hs.UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(hs.RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(hs.GetPendingOrgInvites))
			orgRoute.Post("/invites", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), quota("user"), routing.Wrap(hs.AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", authorize(reqOrgAdmin, ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(hs.RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsPreferencesRead)), routing.Wrap(hs.GetOrgPreferences))
			orgRoute.Put("/preferences", authorize(reqOrgAdmin, ac.EvalPermission(ActionOrgsPreferencesWrite)), routing.Wrap(hs.UpdateOrgPreferences))
		})

		// current org without requirement of user to be org admin
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/users/lookup", authorize(reqOrgAdminFolderAdminOrTeamAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)), routing.Wrap(hs.GetOrgUsersForCurrentOrgLookup))
		})

		// create new org
		apiRoute.Post("/orgs", authorizeInOrg(reqSignedIn, acmiddleware.UseGlobalOrg, ac.EvalPermission(ActionOrgsCreate)), quota("org"), routing.Wrap(hs.CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseGlobalOrg, ac.EvalPermission(ActionOrgsRead)), routing.Wrap(hs.SearchOrgs))

		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute routing.RouteRegister) {
			userIDScope := ac.Scope("users", "id", ac.Parameter(":userId"))
			orgsRoute.Get("/", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ActionOrgsRead)), routing.Wrap(GetOrgByID))
			orgsRoute.Put("/", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ActionOrgsWrite)), routing.Wrap(hs.UpdateOrg))
			orgsRoute.Put("/address", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ActionOrgsWrite)), routing.Wrap(hs.UpdateOrgAddress))
			orgsRoute.Delete("/", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ActionOrgsDelete)), routing.Wrap(hs.DeleteOrgByID))
			orgsRoute.Get("/users", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRead, ac.ScopeUsersAll)), routing.Wrap(hs.GetOrgUsers))
			orgsRoute.Post("/users", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersAdd, ac.ScopeUsersAll)), routing.Wrap(hs.AddOrgUser))
			orgsRoute.Patch("/users/:userId", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRoleUpdate, userIDScope)), routing.Wrap(hs.UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ac.ActionOrgUsersRemove, userIDScope)), routing.Wrap(hs.RemoveOrgUser))
			orgsRoute.Get("/quotas", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ActionOrgsQuotasRead)), routing.Wrap(hs.GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseOrgFromContextParams, ac.EvalPermission(ActionOrgsQuotasWrite)), routing.Wrap(hs.UpdateOrgQuota))
		})

		// orgs (admin routes)
		apiRoute.Get("/orgs/name/:name/", authorizeInOrg(reqGrafanaAdmin, acmiddleware.UseGlobalOrg, ac.EvalPermission(ActionOrgsRead)), routing.Wrap(hs.GetOrgByName))

		// auth api keys
		apiRoute.Group("/auth/keys", func(keysRoute routing.RouteRegister) {
			keysRoute.Get("/", routing.Wrap(hs.GetAPIKeys))
			keysRoute.Post("/", quota("api_key"), routing.Wrap(hs.AddAPIKey))
			keysRoute.Delete("/:id", routing.Wrap(hs.DeleteAPIKey))
		}, reqOrgAdmin)

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute routing.RouteRegister) {
			prefRoute.Post("/set-home-dash", routing.Wrap(hs.SetHomeDashboard))
		})

		// Data sources
		apiRoute.Group("/datasources", func(datasourceRoute routing.RouteRegister) {
			datasourceRoute.Get("/", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead)), routing.Wrap(hs.GetDataSources))
			datasourceRoute.Post("/", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesCreate)), quota("data_source"), routing.Wrap(hs.AddDataSource))
			datasourceRoute.Put("/:id", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesWrite, ScopeDatasourceID)), routing.Wrap(hs.UpdateDataSource))
			datasourceRoute.Delete("/:id", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesDelete, ScopeDatasourceID)), routing.Wrap(hs.DeleteDataSourceById))
			datasourceRoute.Delete("/uid/:uid", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesDelete, ScopeDatasourceUID)), routing.Wrap(hs.DeleteDataSourceByUID))
			datasourceRoute.Delete("/name/:name", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesDelete, ScopeDatasourceName)), routing.Wrap(hs.DeleteDataSourceByName))
			datasourceRoute.Get("/:id", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead)), routing.Wrap(hs.GetDataSourceById))
			datasourceRoute.Get("/uid/:uid", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead)), routing.Wrap(hs.GetDataSourceByUID))
			datasourceRoute.Get("/name/:name", authorize(reqOrgAdmin, ac.EvalPermission(ActionDatasourcesRead)), routing.Wrap(hs.GetDataSourceByName))
		})

		apiRoute.Get("/datasources/id/:name", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesIDRead, ScopeDatasourceName)), routing.Wrap(hs.GetDataSourceIdByName))

		apiRoute.Get("/plugins", routing.Wrap(hs.GetPluginList))
		apiRoute.Get("/plugins/:pluginId/settings", routing.Wrap(hs.GetPluginSettingByID))
		apiRoute.Get("/plugins/:pluginId/markdown/:name", routing.Wrap(hs.GetPluginMarkdown))
		apiRoute.Get("/plugins/:pluginId/health", routing.Wrap(hs.CheckHealth))
		apiRoute.Any("/plugins/:pluginId/resources", hs.CallResource)
		apiRoute.Any("/plugins/:pluginId/resources/*", hs.CallResource)
		apiRoute.Get("/plugins/errors", routing.Wrap(hs.GetPluginErrorsList))

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Post("/:pluginId/install", routing.Wrap(hs.InstallPlugin))
			pluginRoute.Post("/:pluginId/uninstall", routing.Wrap(hs.UninstallPlugin))
		}, reqGrafanaAdmin)

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Get("/:pluginId/dashboards/", routing.Wrap(hs.GetPluginDashboards))
			pluginRoute.Post("/:pluginId/settings", routing.Wrap(hs.UpdatePluginSetting))
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
			folderRoute.Post("/", routing.Wrap(hs.CreateFolder))

			folderRoute.Group("/:uid", func(folderUidRoute routing.RouteRegister) {
				folderUidRoute.Get("/", routing.Wrap(hs.GetFolderByUID))
				folderUidRoute.Put("/", routing.Wrap(hs.UpdateFolder))
				folderUidRoute.Delete("/", routing.Wrap(hs.DeleteFolder))

				folderUidRoute.Group("/permissions", func(folderPermissionRoute routing.RouteRegister) {
					folderPermissionRoute.Get("/", routing.Wrap(hs.GetFolderPermissionList))
					folderPermissionRoute.Post("/", routing.Wrap(hs.UpdateFolderPermissions))
				})
			})
		})

		// Dashboard
		apiRoute.Group("/dashboards", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/uid/:uid", routing.Wrap(hs.GetDashboard))
			dashboardRoute.Delete("/uid/:uid", routing.Wrap(hs.DeleteDashboardByUID))

			if hs.ThumbService != nil {
				dashboardRoute.Get("/uid/:uid/img/:kind/:theme", hs.ThumbService.GetImage)
				dashboardRoute.Post("/uid/:uid/img/:kind/:theme", hs.ThumbService.SetImage)
				dashboardRoute.Put("/uid/:uid/img/:kind/:theme", hs.ThumbService.UpdateThumbnailState)
			}

			dashboardRoute.Post("/calculate-diff", routing.Wrap(hs.CalculateDashboardDiff))
			dashboardRoute.Post("/trim", routing.Wrap(hs.TrimDashboard))

			dashboardRoute.Post("/db", routing.Wrap(hs.PostDashboard))
			dashboardRoute.Get("/home", routing.Wrap(hs.GetHomeDashboard))
			dashboardRoute.Get("/tags", hs.GetDashboardTags)

			dashboardRoute.Group("/id/:dashboardId", func(dashIdRoute routing.RouteRegister) {
				dashIdRoute.Get("/versions", routing.Wrap(hs.GetDashboardVersions))
				dashIdRoute.Get("/versions/:id", routing.Wrap(hs.GetDashboardVersion))
				dashIdRoute.Post("/restore", routing.Wrap(hs.RestoreDashboardVersion))

				dashIdRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", routing.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", routing.Wrap(hs.UpdateDashboardPermissions))
				})
			})
		})

		// Dashboard snapshots
		apiRoute.Group("/dashboard/snapshots", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/", routing.Wrap(hs.SearchDashboardSnapshots))
		})

		// Playlist
		apiRoute.Group("/playlists", func(playlistRoute routing.RouteRegister) {
			playlistRoute.Get("/", routing.Wrap(hs.SearchPlaylists))
			playlistRoute.Get("/:id", hs.ValidateOrgPlaylist, routing.Wrap(hs.GetPlaylist))
			playlistRoute.Get("/:id/items", hs.ValidateOrgPlaylist, routing.Wrap(hs.GetPlaylistItems))
			playlistRoute.Get("/:id/dashboards", hs.ValidateOrgPlaylist, routing.Wrap(hs.GetPlaylistDashboards))
			playlistRoute.Delete("/:id", reqEditorRole, hs.ValidateOrgPlaylist, routing.Wrap(hs.DeletePlaylist))
			playlistRoute.Put("/:id", reqEditorRole, hs.ValidateOrgPlaylist, routing.Wrap(hs.UpdatePlaylist))
			playlistRoute.Post("/", reqEditorRole, routing.Wrap(hs.CreatePlaylist))
		})

		// Search
		apiRoute.Get("/search/sorting", routing.Wrap(hs.ListSortOptions))
		apiRoute.Get("/search/", routing.Wrap(hs.Search))

		// metrics
		apiRoute.Post("/tsdb/query", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), routing.Wrap(hs.QueryMetrics))

		// DataSource w/ expressions
		apiRoute.Post("/ds/query", authorize(reqSignedIn, ac.EvalPermission(ActionDatasourcesQuery)), routing.Wrap(hs.QueryMetricsV2))

		apiRoute.Group("/alerts", func(alertsRoute routing.RouteRegister) {
			alertsRoute.Post("/test", routing.Wrap(hs.AlertTest))
			alertsRoute.Post("/:alertId/pause", reqEditorRole, routing.Wrap(hs.PauseAlert))
			alertsRoute.Get("/:alertId", hs.ValidateOrgAlert, routing.Wrap(hs.GetAlert))
			alertsRoute.Get("/", routing.Wrap(hs.GetAlerts))
			alertsRoute.Get("/states-for-dashboard", routing.Wrap(hs.GetAlertStatesForDashboard))
		})

		apiRoute.Get("/alert-notifiers", reqEditorRole, routing.Wrap(
			hs.GetAlertNotifiers(hs.Cfg.UnifiedAlerting.IsEnabled())),
		)

		apiRoute.Group("/alert-notifications", func(alertNotifications routing.RouteRegister) {
			alertNotifications.Get("/", routing.Wrap(hs.GetAlertNotifications))
			alertNotifications.Post("/test", routing.Wrap(hs.NotificationTest))
			alertNotifications.Post("/", routing.Wrap(hs.CreateAlertNotification))
			alertNotifications.Put("/:notificationId", routing.Wrap(hs.UpdateAlertNotification))
			alertNotifications.Get("/:notificationId", routing.Wrap(hs.GetAlertNotificationByID))
			alertNotifications.Delete("/:notificationId", routing.Wrap(hs.DeleteAlertNotification))
			alertNotifications.Get("/uid/:uid", routing.Wrap(hs.GetAlertNotificationByUID))
			alertNotifications.Put("/uid/:uid", routing.Wrap(hs.UpdateAlertNotificationByUID))
			alertNotifications.Delete("/uid/:uid", routing.Wrap(hs.DeleteAlertNotificationByUID))
		}, reqEditorRole)

		// alert notifications without requirement of user to be org editor
		apiRoute.Group("/alert-notifications", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/lookup", routing.Wrap(hs.GetAlertNotificationLookup))
		})

		apiRoute.Get("/annotations", authorize(reqSignedIn, ac.EvalPermission(ac.ActionAnnotationsRead, ac.ScopeAnnotationsAll)), routing.Wrap(GetAnnotations))
		apiRoute.Post("/annotations/mass-delete", reqOrgAdmin, routing.Wrap(DeleteAnnotations))

		apiRoute.Group("/annotations", func(annotationsRoute routing.RouteRegister) {
			annotationsRoute.Post("/", routing.Wrap(PostAnnotation))
			annotationsRoute.Delete("/:annotationId", routing.Wrap(DeleteAnnotationByID))
			annotationsRoute.Put("/:annotationId", routing.Wrap(UpdateAnnotation))
			annotationsRoute.Patch("/:annotationId", routing.Wrap(PatchAnnotation))
			annotationsRoute.Post("/graphite", reqEditorRole, routing.Wrap(PostGraphiteAnnotation))
			annotationsRoute.Get("/tags", authorize(reqSignedIn, ac.EvalPermission(ac.ActionAnnotationsTagsRead, ac.ScopeAnnotationsTagsAll)), routing.Wrap(GetAnnotationTags))
		})

		apiRoute.Post("/frontend-metrics", routing.Wrap(hs.PostFrontendMetrics))

		apiRoute.Group("/live", func(liveRoute routing.RouteRegister) {
			// the channel path is in the name
			liveRoute.Post("/publish", routing.Wrap(hs.Live.HandleHTTPPublish))

			// POST influx line protocol.
			liveRoute.Post("/push/:streamId", hs.LivePushGateway.Handle)

			// List available streams and fields
			liveRoute.Get("/list", routing.Wrap(hs.Live.HandleListHTTP))

			// Some channels may have info
			liveRoute.Get("/info/*", routing.Wrap(hs.Live.HandleInfoHTTP))

			if hs.Features.IsEnabled(featuremgmt.FlagLivePipeline) {
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
		apiRoute.Post("/short-urls", routing.Wrap(hs.createShortURL))
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		adminRoute.Get("/settings", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)), routing.Wrap(hs.AdminGetSettings))
		if hs.Features.IsEnabled(featuremgmt.FlagShowFeatureFlagsInUI) {
			adminRoute.Get("/settings/features", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)), hs.Features.HandleGetSettings)
		}
		adminRoute.Get("/stats", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionServerStatsRead)), routing.Wrap(hs.AdminGetStats))
		adminRoute.Post("/pause-all-alerts", reqGrafanaAdmin, routing.Wrap(hs.PauseAllAlerts))

		if hs.ThumbService != nil {
			adminRoute.Post("/crawler/start", reqGrafanaAdmin, routing.Wrap(hs.ThumbService.StartCrawler))
			adminRoute.Post("/crawler/stop", reqGrafanaAdmin, routing.Wrap(hs.ThumbService.StopCrawler))
			adminRoute.Get("/crawler/status", reqGrafanaAdmin, routing.Wrap(hs.ThumbService.CrawlerStatus))
		}

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

		adminUserRoute.Post("/", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersCreate)), routing.Wrap(hs.AdminCreateUser))
		adminUserRoute.Put("/:id/password", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersPasswordUpdate, userIDScope)), routing.Wrap(hs.AdminUpdateUserPassword))
		adminUserRoute.Put("/:id/permissions", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersPermissionsUpdate, userIDScope)), routing.Wrap(hs.AdminUpdateUserPermissions))
		adminUserRoute.Delete("/:id", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersDelete, userIDScope)), routing.Wrap(hs.AdminDeleteUser))
		adminUserRoute.Post("/:id/disable", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersDisable, userIDScope)), routing.Wrap(hs.AdminDisableUser))
		adminUserRoute.Post("/:id/enable", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersEnable, userIDScope)), routing.Wrap(hs.AdminEnableUser))
		adminUserRoute.Get("/:id/quotas", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersQuotasList, userIDScope)), routing.Wrap(hs.GetUserQuotas))
		adminUserRoute.Put("/:id/quotas/:target", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersQuotasUpdate, userIDScope)), routing.Wrap(hs.UpdateUserQuota))

		adminUserRoute.Post("/:id/logout", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersLogout, userIDScope)), routing.Wrap(hs.AdminLogoutUser))
		adminUserRoute.Get("/:id/auth-tokens", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersAuthTokenList, userIDScope)), routing.Wrap(hs.AdminGetUserAuthTokens))
		adminUserRoute.Post("/:id/revoke-auth-token", authorize(reqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersAuthTokenUpdate, userIDScope)), routing.Wrap(hs.AdminRevokeUserAuthToken))
	})

	// rendering
	r.Get("/render/*", reqSignedIn, hs.RenderToPng)

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, hs.ProxyGnetRequest)

	// Gravatar service.
	avatarCacheServer := avatar.NewCacheServer(hs.Cfg)
	r.Get("/avatar/:hash", avatarCacheServer.Handler)

	// Snapshots
	r.Post("/api/snapshots/", reqSnapshotPublicModeOrSignedIn, hs.CreateDashboardSnapshot)
	r.Get("/api/snapshot/shared-options/", reqSignedIn, GetSharingOptions)
	r.Get("/api/snapshots/:key", routing.Wrap(hs.GetDashboardSnapshot))
	r.Get("/api/snapshots-delete/:deleteKey", reqSnapshotPublicModeOrSignedIn, routing.Wrap(hs.DeleteDashboardSnapshotByDeleteKey))
	r.Delete("/api/snapshots/:key", reqEditorRole, routing.Wrap(hs.DeleteDashboardSnapshot))

	// Frontend logs
	sourceMapStore := frontendlogging.NewSourceMapStore(hs.Cfg, hs.pluginStaticRouteResolver, frontendlogging.ReadSourceMapFromFS)
	r.Post("/log", middleware.RateLimit(hs.Cfg.Sentry.EndpointRPS, hs.Cfg.Sentry.EndpointBurst, time.Now),
		routing.Wrap(NewFrontendLogMessageHandler(sourceMapStore)))
}
