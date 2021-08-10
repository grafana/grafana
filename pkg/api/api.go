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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
	reqCanAccessTeams := middleware.AdminOrFeatureEnabled(hs.Cfg.EditorsCanAdmin)
	reqSnapshotPublicModeOrSignedIn := middleware.SnapshotPublicModeOrSignedIn(hs.Cfg)
	redirectFromLegacyPanelEditURL := middleware.RedirectFromLegacyPanelEditURL(hs.Cfg)
	authorize := acmiddleware.Middleware(hs.AccessControl)
	quota := middleware.Quota(hs.QuotaService)
	bind := binding.Bind

	r := hs.RouteRegister

	// not logged in views
	r.Get("/logout", hs.Logout)
	r.Post("/login", quota("session"), bind(dtos.LoginCommand{}), routing.Wrap(hs.LoginPost))
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
	r.Get("/datasources/", reqOrgAdmin, hs.Index)
	r.Get("/datasources/new", reqOrgAdmin, hs.Index)
	r.Get("/datasources/edit/*", reqOrgAdmin, hs.Index)
	r.Get("/org/users", authorize(reqOrgAdmin, accesscontrol.ActionOrgUsersRead, accesscontrol.ScopeUsersAll), hs.Index)
	r.Get("/org/users/new", reqOrgAdmin, hs.Index)
	r.Get("/org/users/invite", authorize(reqOrgAdmin, accesscontrol.ActionUsersCreate), hs.Index)
	r.Get("/org/teams", reqCanAccessTeams, hs.Index)
	r.Get("/org/teams/*", reqCanAccessTeams, hs.Index)
	r.Get("/org/apikeys/", reqOrgAdmin, hs.Index)
	r.Get("/dashboard/import/", reqSignedIn, hs.Index)
	r.Get("/configuration", reqGrafanaAdmin, hs.Index)
	r.Get("/admin", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/settings", authorize(reqGrafanaAdmin, accesscontrol.ActionSettingsRead), hs.Index)
	r.Get("/admin/users", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead, accesscontrol.ScopeGlobalUsersAll), hs.Index)
	r.Get("/admin/users/create", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersCreate), hs.Index)
	r.Get("/admin/users/edit/:id", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead), hs.Index)
	r.Get("/admin/orgs", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/orgs/edit/:id", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/stats", authorize(reqGrafanaAdmin, accesscontrol.ActionServerStatsRead), hs.Index)
	r.Get("/admin/ldap", authorize(reqGrafanaAdmin, accesscontrol.ActionLDAPStatusRead), hs.Index)

	r.Get("/styleguide", reqSignedIn, hs.Index)

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
	}, accesscontrol.ActionDatasourcesExplore), hs.Index)

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
	r.Get("/public/plugins/:pluginId/*", hs.GetPluginAssets)

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

			userRoute.Get("/preferences", routing.Wrap(GetUserPreferences))
			userRoute.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), routing.Wrap(UpdateUserPreferences))

			userRoute.Get("/auth-tokens", routing.Wrap(hs.GetUserAuthTokens))
			userRoute.Post("/revoke-auth-token", bind(models.RevokeAuthTokenCmd{}), routing.Wrap(hs.RevokeUserAuthToken))
		}, reqSignedInNoAnonymous)

		// users (admin permission required)
		apiRoute.Group("/users", func(usersRoute routing.RouteRegister) {
			const userIDScope = `global:users:{{ index . ":id" }}`
			usersRoute.Get("/", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead, accesscontrol.ScopeGlobalUsersAll), routing.Wrap(SearchUsers))
			usersRoute.Get("/search", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead, accesscontrol.ScopeGlobalUsersAll), routing.Wrap(SearchUsersWithPaging))
			usersRoute.Get("/:id", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead, userIDScope), routing.Wrap(GetUserByID))
			usersRoute.Get("/:id/teams", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersTeamRead, userIDScope), routing.Wrap(GetUserTeams))
			usersRoute.Get("/:id/orgs", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead, userIDScope), routing.Wrap(GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersRead, accesscontrol.ScopeGlobalUsersAll), routing.Wrap(GetUserByLoginOrEmail))
			usersRoute.Put("/:id", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersWrite, userIDScope), bind(models.UpdateUserCommand{}), routing.Wrap(UpdateUser))
			usersRoute.Post("/:id/using/:orgId", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersWrite, userIDScope), routing.Wrap(UpdateUserActiveOrg))
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
			orgRoute.Get("/", routing.Wrap(GetOrgCurrent))
			orgRoute.Get("/quotas", routing.Wrap(GetOrgQuotas))
		})

		// current org
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			const usersScope = `users:{{ index . ":userId" }}`
			orgRoute.Put("/", reqOrgAdmin, bind(dtos.UpdateOrgForm{}), routing.Wrap(UpdateOrgCurrent))
			orgRoute.Put("/address", reqOrgAdmin, bind(dtos.UpdateOrgAddressForm{}), routing.Wrap(UpdateOrgAddressCurrent))
			orgRoute.Get("/users", authorize(reqOrgAdmin, accesscontrol.ActionOrgUsersRead, accesscontrol.ScopeUsersAll), routing.Wrap(hs.GetOrgUsersForCurrentOrg))
			orgRoute.Get("/users/search", authorize(reqOrgAdmin, accesscontrol.ActionOrgUsersRead, accesscontrol.ScopeUsersAll), routing.Wrap(hs.SearchOrgUsersWithPaging))
			orgRoute.Post("/users", authorize(reqOrgAdmin, accesscontrol.ActionOrgUsersAdd, accesscontrol.ScopeUsersAll), quota("user"), bind(models.AddOrgUserCommand{}), routing.Wrap(AddOrgUserToCurrentOrg))
			orgRoute.Patch("/users/:userId", authorize(reqOrgAdmin, accesscontrol.ActionOrgUsersRoleUpdate, usersScope), bind(models.UpdateOrgUserCommand{}), routing.Wrap(UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", authorize(reqOrgAdmin, accesscontrol.ActionOrgUsersRemove, usersScope), routing.Wrap(RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", authorize(reqOrgAdmin, accesscontrol.ActionUsersCreate), routing.Wrap(GetPendingOrgInvites))
			orgRoute.Post("/invites", authorize(reqOrgAdmin, accesscontrol.ActionUsersCreate), quota("user"), bind(dtos.AddInviteForm{}), routing.Wrap(AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", authorize(reqOrgAdmin, accesscontrol.ActionUsersCreate), routing.Wrap(RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", reqOrgAdmin, routing.Wrap(GetOrgPreferences))
			orgRoute.Put("/preferences", reqOrgAdmin, bind(dtos.UpdatePrefsCmd{}), routing.Wrap(UpdateOrgPreferences))
		})

		// current org without requirement of user to be org admin
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/users/lookup", routing.Wrap(hs.GetOrgUsersForCurrentOrgLookup))
		})

		// create new org
		apiRoute.Post("/orgs", quota("org"), bind(models.CreateOrgCommand{}), routing.Wrap(CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", reqGrafanaAdmin, routing.Wrap(SearchOrgs))

		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute routing.RouteRegister) {
			const usersScope = `users:{{ index . ":userId" }}`
			orgsRoute.Get("/", reqGrafanaAdmin, routing.Wrap(GetOrgByID))
			orgsRoute.Put("/", reqGrafanaAdmin, bind(dtos.UpdateOrgForm{}), routing.Wrap(UpdateOrg))
			orgsRoute.Put("/address", reqGrafanaAdmin, bind(dtos.UpdateOrgAddressForm{}), routing.Wrap(UpdateOrgAddress))
			orgsRoute.Delete("/", reqGrafanaAdmin, routing.Wrap(DeleteOrgByID))
			orgsRoute.Get("/users", authorize(reqGrafanaAdmin, accesscontrol.ActionOrgUsersRead, accesscontrol.ScopeUsersAll), routing.Wrap(hs.GetOrgUsers))
			orgsRoute.Post("/users", authorize(reqGrafanaAdmin, accesscontrol.ActionOrgUsersAdd, accesscontrol.ScopeUsersAll), bind(models.AddOrgUserCommand{}), routing.Wrap(AddOrgUser))
			orgsRoute.Patch("/users/:userId", authorize(reqGrafanaAdmin, accesscontrol.ActionOrgUsersRoleUpdate, usersScope), bind(models.UpdateOrgUserCommand{}), routing.Wrap(UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", authorize(reqGrafanaAdmin, accesscontrol.ActionOrgUsersRemove, usersScope), routing.Wrap(RemoveOrgUser))
			orgsRoute.Get("/quotas", reqGrafanaAdmin, routing.Wrap(GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", reqGrafanaAdmin, bind(models.UpdateOrgQuotaCmd{}), routing.Wrap(UpdateOrgQuota))
		})

		// orgs (admin routes)
		apiRoute.Group("/orgs/name/:name", func(orgsRoute routing.RouteRegister) {
			orgsRoute.Get("/", routing.Wrap(hs.GetOrgByName))
		}, reqGrafanaAdmin)

		// auth api keys
		apiRoute.Group("/auth/keys", func(keysRoute routing.RouteRegister) {
			keysRoute.Get("/", routing.Wrap(GetAPIKeys))
			keysRoute.Post("/", quota("api_key"), bind(models.AddApiKeyCommand{}), routing.Wrap(hs.AddAPIKey))
			keysRoute.Delete("/:id", routing.Wrap(DeleteAPIKey))
		}, reqOrgAdmin)

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute routing.RouteRegister) {
			prefRoute.Post("/set-home-dash", bind(models.SavePreferencesCommand{}), routing.Wrap(SetHomeDashboard))
		})

		// Data sources
		apiRoute.Group("/datasources", func(datasourceRoute routing.RouteRegister) {
			datasourceRoute.Get("/", routing.Wrap(hs.GetDataSources))
			datasourceRoute.Post("/", quota("data_source"), bind(models.AddDataSourceCommand{}), routing.Wrap(AddDataSource))
			datasourceRoute.Put("/:id", bind(models.UpdateDataSourceCommand{}), routing.Wrap(hs.UpdateDataSource))
			datasourceRoute.Delete("/:id", routing.Wrap(hs.DeleteDataSourceById))
			datasourceRoute.Delete("/uid/:uid", routing.Wrap(hs.DeleteDataSourceByUID))
			datasourceRoute.Delete("/name/:name", routing.Wrap(hs.DeleteDataSourceByName))
			datasourceRoute.Get("/:id", routing.Wrap(GetDataSourceById))
			datasourceRoute.Get("/uid/:uid", routing.Wrap(GetDataSourceByUID))
			datasourceRoute.Get("/name/:name", routing.Wrap(GetDataSourceByName))
		}, reqOrgAdmin)

		apiRoute.Get("/datasources/id/:name", routing.Wrap(GetDataSourceIdByName), reqSignedIn)

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
		apiRoute.Any("/datasources/proxy/:id/*", reqSignedIn, hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/proxy/:id", reqSignedIn, hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/:id/resources", hs.CallDatasourceResource)
		apiRoute.Any("/datasources/:id/resources/*", hs.CallDatasourceResource)
		apiRoute.Any("/datasources/:id/health", routing.Wrap(hs.CheckDatasourceHealth))

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
		apiRoute.Post("/tsdb/query", bind(dtos.MetricRequest{}), routing.Wrap(hs.QueryMetrics))
		apiRoute.Get("/tsdb/testdata/gensql", reqGrafanaAdmin, routing.Wrap(GenerateSQLTestData))
		apiRoute.Get("/tsdb/testdata/random-walk", routing.Wrap(hs.GetTestDataRandomWalk))

		// DataSource w/ expressions
		apiRoute.Post("/ds/query", bind(dtos.MetricRequest{}), routing.Wrap(hs.QueryMetricsV2))

		apiRoute.Group("/alerts", func(alertsRoute routing.RouteRegister) {
			alertsRoute.Post("/test", bind(dtos.AlertTestCommand{}), routing.Wrap(hs.AlertTest))
			alertsRoute.Post("/:alertId/pause", reqEditorRole, bind(dtos.PauseAlertCommand{}), routing.Wrap(PauseAlert))
			alertsRoute.Get("/:alertId", ValidateOrgAlert, routing.Wrap(GetAlert))
			alertsRoute.Get("/", routing.Wrap(GetAlerts))
			alertsRoute.Get("/states-for-dashboard", routing.Wrap(GetAlertStatesForDashboard))
		})

		apiRoute.Get("/alert-notifiers", reqEditorRole, routing.Wrap(
			GetAlertNotifiers(hs.Alertmanager != nil && hs.Cfg.IsNgAlertEnabled())),
		)

		apiRoute.Group("/alert-notifications", func(alertNotifications routing.RouteRegister) {
			alertNotifications.Get("/", routing.Wrap(GetAlertNotifications))
			alertNotifications.Post("/test", bind(dtos.NotificationTestCommand{}), routing.Wrap(NotificationTest))
			alertNotifications.Post("/", bind(models.CreateAlertNotificationCommand{}), routing.Wrap(CreateAlertNotification))
			alertNotifications.Put("/:notificationId", bind(models.UpdateAlertNotificationCommand{}), routing.Wrap(UpdateAlertNotification))
			alertNotifications.Get("/:notificationId", routing.Wrap(GetAlertNotificationByID))
			alertNotifications.Delete("/:notificationId", routing.Wrap(DeleteAlertNotification))
			alertNotifications.Get("/uid/:uid", routing.Wrap(GetAlertNotificationByUID))
			alertNotifications.Put("/uid/:uid", bind(models.UpdateAlertNotificationWithUidCommand{}), routing.Wrap(UpdateAlertNotificationByUID))
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

			// POST influx line protocol
			liveRoute.Post("/push/:streamId", hs.LivePushGateway.Handle)

			// List available streams and fields
			liveRoute.Get("/list", routing.Wrap(hs.Live.HandleListHTTP))

			// Some channels may have info
			liveRoute.Get("/info/*", routing.Wrap(hs.Live.HandleInfoHTTP))
		})

		// short urls
		apiRoute.Post("/short-urls", bind(dtos.CreateShortURLCmd{}), routing.Wrap(hs.createShortURL))
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		adminRoute.Get("/settings", authorize(reqGrafanaAdmin, accesscontrol.ActionSettingsRead), routing.Wrap(hs.AdminGetSettings))
		adminRoute.Get("/stats", authorize(reqGrafanaAdmin, accesscontrol.ActionServerStatsRead), routing.Wrap(AdminGetStats))
		adminRoute.Post("/pause-all-alerts", reqGrafanaAdmin, bind(dtos.PauseAllAlertsCommand{}), routing.Wrap(PauseAllAlerts))

		adminRoute.Post("/provisioning/dashboards/reload", authorize(reqGrafanaAdmin, ActionProvisioningReload, ScopeProvisionersDashboards), routing.Wrap(hs.AdminProvisioningReloadDashboards))
		adminRoute.Post("/provisioning/plugins/reload", authorize(reqGrafanaAdmin, ActionProvisioningReload, ScopeProvisionersPlugins), routing.Wrap(hs.AdminProvisioningReloadPlugins))
		adminRoute.Post("/provisioning/datasources/reload", authorize(reqGrafanaAdmin, ActionProvisioningReload, ScopeProvisionersDatasources), routing.Wrap(hs.AdminProvisioningReloadDatasources))
		adminRoute.Post("/provisioning/notifications/reload", authorize(reqGrafanaAdmin, ActionProvisioningReload, ScopeProvisionersNotifications), routing.Wrap(hs.AdminProvisioningReloadNotifications))

		adminRoute.Post("/ldap/reload", authorize(reqGrafanaAdmin, accesscontrol.ActionLDAPConfigReload), routing.Wrap(hs.ReloadLDAPCfg))
		adminRoute.Post("/ldap/sync/:id", authorize(reqGrafanaAdmin, accesscontrol.ActionLDAPUsersSync), routing.Wrap(hs.PostSyncUserWithLDAP))
		adminRoute.Get("/ldap/:username", authorize(reqGrafanaAdmin, accesscontrol.ActionLDAPUsersRead), routing.Wrap(hs.GetUserFromLDAP))
		adminRoute.Get("/ldap/status", authorize(reqGrafanaAdmin, accesscontrol.ActionLDAPStatusRead), routing.Wrap(hs.GetLDAPStatus))
	})

	// Administering users
	r.Group("/api/admin/users", func(adminUserRoute routing.RouteRegister) {
		const userIDScope = `global:users:{{ index . ":id" }}`
		adminUserRoute.Post("/", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersCreate), bind(dtos.AdminCreateUserForm{}), routing.Wrap(hs.AdminCreateUser))
		adminUserRoute.Put("/:id/password", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersPasswordUpdate, userIDScope), bind(dtos.AdminUpdateUserPasswordForm{}), routing.Wrap(AdminUpdateUserPassword))
		adminUserRoute.Put("/:id/permissions", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersPermissionsUpdate, userIDScope), bind(dtos.AdminUpdateUserPermissionsForm{}), routing.Wrap(hs.AdminUpdateUserPermissions))
		adminUserRoute.Delete("/:id", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersDelete, userIDScope), routing.Wrap(AdminDeleteUser))
		adminUserRoute.Post("/:id/disable", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersDisable, userIDScope), routing.Wrap(hs.AdminDisableUser))
		adminUserRoute.Post("/:id/enable", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersEnable, userIDScope), routing.Wrap(AdminEnableUser))
		adminUserRoute.Get("/:id/quotas", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersQuotasList, userIDScope), routing.Wrap(GetUserQuotas))
		adminUserRoute.Put("/:id/quotas/:target", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersQuotasUpdate, userIDScope), bind(models.UpdateUserQuotaCmd{}), routing.Wrap(UpdateUserQuota))

		adminUserRoute.Post("/:id/logout", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersLogout, userIDScope), routing.Wrap(hs.AdminLogoutUser))
		adminUserRoute.Get("/:id/auth-tokens", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersAuthTokenList, userIDScope), routing.Wrap(hs.AdminGetUserAuthTokens))
		adminUserRoute.Post("/:id/revoke-auth-token", authorize(reqGrafanaAdmin, accesscontrol.ActionUsersAuthTokenUpdate, userIDScope), bind(models.RevokeAuthTokenCmd{}), routing.Wrap(hs.AdminRevokeUserAuthToken))
	})

	// rendering
	r.Get("/render/*", reqSignedIn, hs.RenderToPng)

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, ProxyGnetRequest)

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
	sourceMapStore := frontendlogging.NewSourceMapStore(hs.Cfg, hs.PluginManager, frontendlogging.ReadSourceMapFromFS)
	r.Post("/log", middleware.RateLimit(hs.Cfg.Sentry.EndpointRPS, hs.Cfg.Sentry.EndpointBurst, time.Now),
		bind(frontendlogging.FrontendSentryEvent{}), routing.Wrap(NewFrontendLogMessageHandler(sourceMapStore)))
}
