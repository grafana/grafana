// Package api contains API logic.
package api

import (
	"time"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/api/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
)

var plog = log.New("api")

// registerRoutes registers all API HTTP routes.
func (hs *HTTPServer) registerRoutes() {
	reqSignedIn := middleware.ReqSignedIn
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin
	reqEditorRole := middleware.ReqEditorRole
	reqOrgAdmin := middleware.ReqOrgAdmin
	reqCanAccessTeams := middleware.AdminOrFeatureEnabled(hs.Cfg.EditorsCanAdmin)
	reqSnapshotPublicModeOrSignedIn := middleware.SnapshotPublicModeOrSignedIn(hs.Cfg)
	redirectFromLegacyDashboardURL := middleware.RedirectFromLegacyDashboardURL()
	redirectFromLegacyDashboardSoloURL := middleware.RedirectFromLegacyDashboardSoloURL(hs.Cfg)
	redirectFromLegacyPanelEditURL := middleware.RedirectFromLegacyPanelEditURL(hs.Cfg)
	quota := middleware.Quota(hs.QuotaService)
	bind := binding.Bind

	r := hs.RouteRegister

	// not logged in views
	r.Get("/logout", hs.Logout)
	r.Post("/login", quota("session"), bind(dtos.LoginCommand{}), utils.Wrap(hs.LoginPost))
	r.Get("/login/:name", quota("session"), hs.OAuthLogin)
	r.Get("/login", hs.LoginView)
	r.Get("/invite/:code", hs.Index)

	// authed views
	r.Get("/", reqSignedIn, hs.Index)
	r.Get("/profile/", reqSignedIn, hs.Index)
	r.Get("/profile/password", reqSignedIn, hs.Index)
	r.Get("/.well-known/change-password", redirectToChangePassword)
	r.Get("/profile/switch-org/:id", reqSignedIn, hs.ChangeActiveOrgAndRedirectToHome)
	r.Get("/org/", reqOrgAdmin, hs.Index)
	r.Get("/org/new", reqGrafanaAdmin, hs.Index)
	r.Get("/datasources/", reqOrgAdmin, hs.Index)
	r.Get("/datasources/new", reqOrgAdmin, hs.Index)
	r.Get("/datasources/edit/*", reqOrgAdmin, hs.Index)
	r.Get("/org/users", reqOrgAdmin, hs.Index)
	r.Get("/org/users/new", reqOrgAdmin, hs.Index)
	r.Get("/org/users/invite", reqOrgAdmin, hs.Index)
	r.Get("/org/teams", reqCanAccessTeams, hs.Index)
	r.Get("/org/teams/*", reqCanAccessTeams, hs.Index)
	r.Get("/org/apikeys/", reqOrgAdmin, hs.Index)
	r.Get("/dashboard/import/", reqSignedIn, hs.Index)
	r.Get("/configuration", reqGrafanaAdmin, hs.Index)
	r.Get("/admin", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/settings", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/users", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/users/create", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/users/edit/:id", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/orgs", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/orgs/edit/:id", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/stats", reqGrafanaAdmin, hs.Index)
	r.Get("/admin/ldap", reqGrafanaAdmin, hs.Index)

	r.Get("/styleguide", reqSignedIn, hs.Index)

	r.Get("/plugins", reqSignedIn, hs.Index)
	r.Get("/plugins/:id/", reqSignedIn, hs.Index)
	r.Get("/plugins/:id/edit", reqSignedIn, hs.Index) // deprecated
	r.Get("/plugins/:id/page/:page", reqSignedIn, hs.Index)
	r.Get("/a/:id/*", reqSignedIn, hs.Index) // App Root Page

	r.Get("/d/:uid/:slug", reqSignedIn, redirectFromLegacyPanelEditURL, hs.Index)
	r.Get("/d/:uid", reqSignedIn, redirectFromLegacyPanelEditURL, hs.Index)
	r.Get("/dashboard/db/:slug", reqSignedIn, redirectFromLegacyDashboardURL, hs.Index)
	r.Get("/dashboard/script/*", reqSignedIn, hs.Index)
	r.Get("/dashboard/new", reqSignedIn, hs.Index)
	r.Get("/dashboard-solo/snapshot/*", hs.Index)
	r.Get("/d-solo/:uid/:slug", reqSignedIn, hs.Index)
	r.Get("/d-solo/:uid", reqSignedIn, hs.Index)
	r.Get("/dashboard-solo/db/:slug", reqSignedIn, redirectFromLegacyDashboardSoloURL, hs.Index)
	r.Get("/dashboard-solo/script/*", reqSignedIn, hs.Index)
	r.Get("/import/dashboard", reqSignedIn, hs.Index)
	r.Get("/dashboards/", reqSignedIn, hs.Index)
	r.Get("/dashboards/*", reqSignedIn, hs.Index)
	r.Get("/goto/:uid", reqSignedIn, hs.redirectFromShortURL, hs.Index)

	r.Get("/explore", reqSignedIn, middleware.EnsureEditorOrViewerCanEdit, hs.Index)

	r.Get("/playlists/", reqSignedIn, hs.Index)
	r.Get("/playlists/*", reqSignedIn, hs.Index)
	r.Get("/alerting/", reqEditorRole, hs.Index)
	r.Get("/alerting/*", reqEditorRole, hs.Index)

	// sign up
	r.Get("/verify", hs.Index)
	r.Get("/signup", hs.Index)
	r.Get("/api/user/signup/options", utils.Wrap(GetSignUpOptions))
	r.Post("/api/user/signup", quota("user"), bind(dtos.SignUpForm{}), utils.Wrap(SignUp))
	r.Post("/api/user/signup/step2", bind(dtos.SignUpStep2Form{}), utils.Wrap(hs.SignUpStep2))

	// invited
	r.Get("/api/user/invite/:code", utils.Wrap(GetInviteInfoByCode))
	r.Post("/api/user/invite/complete", bind(dtos.CompleteInviteForm{}), utils.Wrap(hs.CompleteInvite))

	// reset password
	r.Get("/user/password/send-reset-email", hs.Index)
	r.Get("/user/password/reset", hs.Index)

	r.Post("/api/user/password/send-reset-email", bind(dtos.SendResetPasswordEmailForm{}), utils.Wrap(SendResetPasswordEmail))
	r.Post("/api/user/password/reset", bind(dtos.ResetUserPasswordForm{}), utils.Wrap(ResetPassword))

	// dashboard snapshots
	r.Get("/dashboard/snapshot/*", hs.Index)
	r.Get("/dashboard/snapshots/", reqSignedIn, hs.Index)

	// api renew session based on cookie
	r.Get("/api/login/ping", quota("session"), utils.Wrap(hs.LoginAPIPing))

	// authed api
	r.Group("/api", func(apiRoute routing.RouteRegister) {
		// user (signed in)
		apiRoute.Group("/user", func(userRoute routing.RouteRegister) {
			userRoute.Get("/", utils.Wrap(GetSignedInUser))
			userRoute.Put("/", bind(models.UpdateUserCommand{}), utils.Wrap(UpdateSignedInUser))
			userRoute.Post("/using/:id", utils.Wrap(UserSetUsingOrg))
			userRoute.Get("/orgs", utils.Wrap(GetSignedInUserOrgList))
			userRoute.Get("/teams", utils.Wrap(GetSignedInUserTeamList))

			userRoute.Post("/stars/dashboard/:id", utils.Wrap(StarDashboard))
			userRoute.Delete("/stars/dashboard/:id", utils.Wrap(UnstarDashboard))

			userRoute.Put("/password", bind(models.ChangeUserPasswordCommand{}), utils.Wrap(ChangeUserPassword))
			userRoute.Get("/quotas", utils.Wrap(GetUserQuotas))
			userRoute.Put("/helpflags/:id", utils.Wrap(SetHelpFlag))
			// For dev purpose
			userRoute.Get("/helpflags/clear", utils.Wrap(ClearHelpFlags))

			userRoute.Get("/preferences", utils.Wrap(GetUserPreferences))
			userRoute.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), utils.Wrap(UpdateUserPreferences))

			userRoute.Get("/auth-tokens", utils.Wrap(hs.GetUserAuthTokens))
			userRoute.Post("/revoke-auth-token", bind(models.RevokeAuthTokenCmd{}), utils.Wrap(hs.RevokeUserAuthToken))
		})

		// users (admin permission required)
		apiRoute.Group("/users", func(usersRoute routing.RouteRegister) {
			usersRoute.Get("/", utils.Wrap(SearchUsers))
			usersRoute.Get("/search", utils.Wrap(SearchUsersWithPaging))
			usersRoute.Get("/:id", utils.Wrap(GetUserByID))
			usersRoute.Get("/:id/teams", utils.Wrap(GetUserTeams))
			usersRoute.Get("/:id/orgs", utils.Wrap(GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", utils.Wrap(GetUserByLoginOrEmail))
			usersRoute.Put("/:id", bind(models.UpdateUserCommand{}), utils.Wrap(UpdateUser))
			usersRoute.Post("/:id/using/:orgId", utils.Wrap(UpdateUserActiveOrg))
		}, reqGrafanaAdmin)

		// team (admin permission required)
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Post("/", bind(models.CreateTeamCommand{}), utils.Wrap(hs.CreateTeam))
			teamsRoute.Put("/:teamId", bind(models.UpdateTeamCommand{}), utils.Wrap(hs.UpdateTeam))
			teamsRoute.Delete("/:teamId", utils.Wrap(hs.DeleteTeamByID))
			teamsRoute.Get("/:teamId/members", utils.Wrap(hs.GetTeamMembers))
			teamsRoute.Post("/:teamId/members", bind(models.AddTeamMemberCommand{}), utils.Wrap(hs.AddTeamMember))
			teamsRoute.Put("/:teamId/members/:userId", bind(models.UpdateTeamMemberCommand{}), utils.Wrap(hs.UpdateTeamMember))
			teamsRoute.Delete("/:teamId/members/:userId", utils.Wrap(hs.RemoveTeamMember))
			teamsRoute.Get("/:teamId/preferences", utils.Wrap(hs.GetTeamPreferences))
			teamsRoute.Put("/:teamId/preferences", bind(dtos.UpdatePrefsCmd{}), utils.Wrap(hs.UpdateTeamPreferences))
		}, reqCanAccessTeams)

		// team without requirement of user to be org admin
		apiRoute.Group("/teams", func(teamsRoute routing.RouteRegister) {
			teamsRoute.Get("/:teamId", utils.Wrap(hs.GetTeamByID))
			teamsRoute.Get("/search", utils.Wrap(hs.SearchTeams))
		})

		// org information available to all users.
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/", utils.Wrap(GetOrgCurrent))
			orgRoute.Get("/quotas", utils.Wrap(GetOrgQuotas))
		})

		// current org
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Put("/", bind(dtos.UpdateOrgForm{}), utils.Wrap(UpdateOrgCurrent))
			orgRoute.Put("/address", bind(dtos.UpdateOrgAddressForm{}), utils.Wrap(UpdateOrgAddressCurrent))
			orgRoute.Get("/users", utils.Wrap(hs.GetOrgUsersForCurrentOrg))
			orgRoute.Post("/users", quota("user"), bind(models.AddOrgUserCommand{}), utils.Wrap(AddOrgUserToCurrentOrg))
			orgRoute.Patch("/users/:userId", bind(models.UpdateOrgUserCommand{}), utils.Wrap(UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", utils.Wrap(RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", utils.Wrap(GetPendingOrgInvites))
			orgRoute.Post("/invites", quota("user"), bind(dtos.AddInviteForm{}), utils.Wrap(AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", utils.Wrap(RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", utils.Wrap(GetOrgPreferences))
			orgRoute.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), utils.Wrap(UpdateOrgPreferences))
		}, reqOrgAdmin)

		// current org without requirement of user to be org admin
		apiRoute.Group("/org", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/users/lookup", utils.Wrap(hs.GetOrgUsersForCurrentOrgLookup))
		})

		// create new org
		apiRoute.Post("/orgs", quota("org"), bind(models.CreateOrgCommand{}), utils.Wrap(CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", reqGrafanaAdmin, utils.Wrap(SearchOrgs))

		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute routing.RouteRegister) {
			orgsRoute.Get("/", utils.Wrap(GetOrgByID))
			orgsRoute.Put("/", bind(dtos.UpdateOrgForm{}), utils.Wrap(UpdateOrg))
			orgsRoute.Put("/address", bind(dtos.UpdateOrgAddressForm{}), utils.Wrap(UpdateOrgAddress))
			orgsRoute.Delete("/", utils.Wrap(DeleteOrgByID))
			orgsRoute.Get("/users", utils.Wrap(hs.GetOrgUsers))
			orgsRoute.Post("/users", bind(models.AddOrgUserCommand{}), utils.Wrap(AddOrgUser))
			orgsRoute.Patch("/users/:userId", bind(models.UpdateOrgUserCommand{}), utils.Wrap(UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", utils.Wrap(RemoveOrgUser))
			orgsRoute.Get("/quotas", utils.Wrap(GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", bind(models.UpdateOrgQuotaCmd{}), utils.Wrap(UpdateOrgQuota))
		}, reqGrafanaAdmin)

		// orgs (admin routes)
		apiRoute.Group("/orgs/name/:name", func(orgsRoute routing.RouteRegister) {
			orgsRoute.Get("/", utils.Wrap(hs.GetOrgByName))
		}, reqGrafanaAdmin)

		// auth api keys
		apiRoute.Group("/auth/keys", func(keysRoute routing.RouteRegister) {
			keysRoute.Get("/", utils.Wrap(GetAPIKeys))
			keysRoute.Post("/", quota("api_key"), bind(models.AddApiKeyCommand{}), utils.Wrap(hs.AddAPIKey))
			keysRoute.Delete("/:id", utils.Wrap(DeleteAPIKey))
		}, reqOrgAdmin)

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute routing.RouteRegister) {
			prefRoute.Post("/set-home-dash", bind(models.SavePreferencesCommand{}), utils.Wrap(SetHomeDashboard))
		})

		// Data sources
		apiRoute.Group("/datasources", func(datasourceRoute routing.RouteRegister) {
			datasourceRoute.Get("/", utils.Wrap(hs.GetDataSources))
			datasourceRoute.Post("/", quota("data_source"), bind(models.AddDataSourceCommand{}), utils.Wrap(AddDataSource))
			datasourceRoute.Put("/:id", bind(models.UpdateDataSourceCommand{}), utils.Wrap(UpdateDataSource))
			datasourceRoute.Delete("/:id", utils.Wrap(DeleteDataSourceById))
			datasourceRoute.Delete("/uid/:uid", utils.Wrap(DeleteDataSourceByUID))
			datasourceRoute.Delete("/name/:name", utils.Wrap(DeleteDataSourceByName))
			datasourceRoute.Get("/:id", utils.Wrap(GetDataSourceById))
			datasourceRoute.Get("/uid/:uid", utils.Wrap(GetDataSourceByUID))
			datasourceRoute.Get("/name/:name", utils.Wrap(GetDataSourceByName))
		}, reqOrgAdmin)

		apiRoute.Get("/datasources/id/:name", utils.Wrap(GetDataSourceIdByName), reqSignedIn)

		apiRoute.Get("/plugins", utils.Wrap(hs.GetPluginList))
		apiRoute.Get("/plugins/:pluginId/settings", utils.Wrap(GetPluginSettingByID))
		apiRoute.Get("/plugins/:pluginId/markdown/:name", utils.Wrap(GetPluginMarkdown))
		apiRoute.Get("/plugins/:pluginId/health", utils.Wrap(hs.CheckHealth))
		apiRoute.Any("/plugins/:pluginId/resources", hs.CallResource)
		apiRoute.Any("/plugins/:pluginId/resources/*", hs.CallResource)
		apiRoute.Any("/plugins/errors", utils.Wrap(hs.GetPluginErrorsList))

		apiRoute.Group("/plugins", func(pluginRoute routing.RouteRegister) {
			pluginRoute.Get("/:pluginId/dashboards/", utils.Wrap(GetPluginDashboards))
			pluginRoute.Post("/:pluginId/settings", bind(models.UpdatePluginSettingCmd{}), utils.Wrap(UpdatePluginSetting))
			pluginRoute.Get("/:pluginId/metrics", utils.Wrap(hs.CollectPluginMetrics))
		}, reqOrgAdmin)

		apiRoute.Get("/frontend/settings/", hs.GetFrontendSettings)
		apiRoute.Any("/datasources/proxy/:id/*", reqSignedIn, hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/proxy/:id", reqSignedIn, hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/:id/resources", hs.CallDatasourceResource)
		apiRoute.Any("/datasources/:id/resources/*", hs.CallDatasourceResource)
		apiRoute.Any("/datasources/:id/health", utils.Wrap(hs.CheckDatasourceHealth))

		// Folders
		apiRoute.Group("/folders", func(folderRoute routing.RouteRegister) {
			folderRoute.Get("/", utils.Wrap(GetFolders))
			folderRoute.Get("/id/:id", utils.Wrap(GetFolderByID))
			folderRoute.Post("/", bind(models.CreateFolderCommand{}), utils.Wrap(hs.CreateFolder))

			folderRoute.Group("/:uid", func(folderUidRoute routing.RouteRegister) {
				folderUidRoute.Get("/", utils.Wrap(GetFolderByUID))
				folderUidRoute.Put("/", bind(models.UpdateFolderCommand{}), utils.Wrap(UpdateFolder))
				folderUidRoute.Delete("/", utils.Wrap(DeleteFolder))

				folderUidRoute.Group("/permissions", func(folderPermissionRoute routing.RouteRegister) {
					folderPermissionRoute.Get("/", utils.Wrap(hs.GetFolderPermissionList))
					folderPermissionRoute.Post("/", bind(dtos.UpdateDashboardAclCommand{}), utils.Wrap(hs.UpdateFolderPermissions))
				})
			})
		})

		// Dashboard
		apiRoute.Group("/dashboards", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/uid/:uid", utils.Wrap(hs.GetDashboard))
			dashboardRoute.Delete("/uid/:uid", utils.Wrap(DeleteDashboardByUID))

			dashboardRoute.Get("/db/:slug", utils.Wrap(hs.GetDashboard))
			dashboardRoute.Delete("/db/:slug", utils.Wrap(DeleteDashboardBySlug))

			dashboardRoute.Post("/calculate-diff", bind(dtos.CalculateDiffOptions{}), utils.Wrap(CalculateDashboardDiff))

			dashboardRoute.Post("/db", bind(models.SaveDashboardCommand{}), utils.Wrap(hs.PostDashboard))
			dashboardRoute.Get("/home", utils.Wrap(hs.GetHomeDashboard))
			dashboardRoute.Get("/tags", GetDashboardTags)
			dashboardRoute.Post("/import", bind(dtos.ImportDashboardCommand{}), utils.Wrap(ImportDashboard))

			dashboardRoute.Group("/id/:dashboardId", func(dashIdRoute routing.RouteRegister) {
				dashIdRoute.Get("/versions", utils.Wrap(GetDashboardVersions))
				dashIdRoute.Get("/versions/:id", utils.Wrap(GetDashboardVersion))
				dashIdRoute.Post("/restore", bind(dtos.RestoreDashboardVersionCommand{}), utils.Wrap(hs.RestoreDashboardVersion))

				dashIdRoute.Group("/permissions", func(dashboardPermissionRoute routing.RouteRegister) {
					dashboardPermissionRoute.Get("/", utils.Wrap(hs.GetDashboardPermissionList))
					dashboardPermissionRoute.Post("/", bind(dtos.UpdateDashboardAclCommand{}), utils.Wrap(hs.UpdateDashboardPermissions))
				})
			})
		})

		// Dashboard snapshots
		apiRoute.Group("/dashboard/snapshots", func(dashboardRoute routing.RouteRegister) {
			dashboardRoute.Get("/", utils.Wrap(SearchDashboardSnapshots))
		})

		// Playlist
		apiRoute.Group("/playlists", func(playlistRoute routing.RouteRegister) {
			playlistRoute.Get("/", utils.Wrap(SearchPlaylists))
			playlistRoute.Get("/:id", ValidateOrgPlaylist, utils.Wrap(GetPlaylist))
			playlistRoute.Get("/:id/items", ValidateOrgPlaylist, utils.Wrap(GetPlaylistItems))
			playlistRoute.Get("/:id/dashboards", ValidateOrgPlaylist, utils.Wrap(GetPlaylistDashboards))
			playlistRoute.Delete("/:id", reqEditorRole, ValidateOrgPlaylist, utils.Wrap(DeletePlaylist))
			playlistRoute.Put("/:id", reqEditorRole, bind(models.UpdatePlaylistCommand{}), ValidateOrgPlaylist, utils.Wrap(UpdatePlaylist))
			playlistRoute.Post("/", reqEditorRole, bind(models.CreatePlaylistCommand{}), utils.Wrap(CreatePlaylist))
		})

		// Search
		apiRoute.Get("/search/sorting", utils.Wrap(hs.ListSortOptions))
		apiRoute.Get("/search/", utils.Wrap(Search))

		// metrics
		apiRoute.Post("/tsdb/query", bind(dtos.MetricRequest{}), utils.Wrap(hs.QueryMetrics))
		apiRoute.Get("/tsdb/testdata/scenarios", utils.Wrap(GetTestDataScenarios))
		apiRoute.Get("/tsdb/testdata/gensql", reqGrafanaAdmin, utils.Wrap(GenerateSQLTestData))
		apiRoute.Get("/tsdb/testdata/random-walk", utils.Wrap(GetTestDataRandomWalk))

		// DataSource w/ expressions
		apiRoute.Post("/ds/query", bind(dtos.MetricRequest{}), utils.Wrap(hs.QueryMetricsV2))

		apiRoute.Group("/alerts", func(alertsRoute routing.RouteRegister) {
			alertsRoute.Post("/test", bind(dtos.AlertTestCommand{}), utils.Wrap(AlertTest))
			alertsRoute.Post("/:alertId/pause", reqEditorRole, bind(dtos.PauseAlertCommand{}), utils.Wrap(PauseAlert))
			alertsRoute.Get("/:alertId", ValidateOrgAlert, utils.Wrap(GetAlert))
			alertsRoute.Get("/", utils.Wrap(GetAlerts))
			alertsRoute.Get("/states-for-dashboard", utils.Wrap(GetAlertStatesForDashboard))
		})

		apiRoute.Get("/alert-notifiers", reqEditorRole, utils.Wrap(GetAlertNotifiers))

		apiRoute.Group("/alert-notifications", func(alertNotifications routing.RouteRegister) {
			alertNotifications.Get("/", utils.Wrap(GetAlertNotifications))
			alertNotifications.Post("/test", bind(dtos.NotificationTestCommand{}), utils.Wrap(NotificationTest))
			alertNotifications.Post("/", bind(models.CreateAlertNotificationCommand{}), utils.Wrap(CreateAlertNotification))
			alertNotifications.Put("/:notificationId", bind(models.UpdateAlertNotificationCommand{}), utils.Wrap(UpdateAlertNotification))
			alertNotifications.Get("/:notificationId", utils.Wrap(GetAlertNotificationByID))
			alertNotifications.Delete("/:notificationId", utils.Wrap(DeleteAlertNotification))
			alertNotifications.Get("/uid/:uid", utils.Wrap(GetAlertNotificationByUID))
			alertNotifications.Put("/uid/:uid", bind(models.UpdateAlertNotificationWithUidCommand{}), utils.Wrap(UpdateAlertNotificationByUID))
			alertNotifications.Delete("/uid/:uid", utils.Wrap(DeleteAlertNotificationByUID))
		}, reqEditorRole)

		// alert notifications without requirement of user to be org editor
		apiRoute.Group("/alert-notifications", func(orgRoute routing.RouteRegister) {
			orgRoute.Get("/lookup", utils.Wrap(GetAlertNotificationLookup))
		})

		apiRoute.Get("/annotations", utils.Wrap(GetAnnotations))
		apiRoute.Post("/annotations/mass-delete", reqOrgAdmin, bind(dtos.DeleteAnnotationsCmd{}), utils.Wrap(DeleteAnnotations))

		apiRoute.Group("/annotations", func(annotationsRoute routing.RouteRegister) {
			annotationsRoute.Post("/", bind(dtos.PostAnnotationsCmd{}), utils.Wrap(PostAnnotation))
			annotationsRoute.Delete("/:annotationId", utils.Wrap(DeleteAnnotationByID))
			annotationsRoute.Put("/:annotationId", bind(dtos.UpdateAnnotationsCmd{}), utils.Wrap(UpdateAnnotation))
			annotationsRoute.Patch("/:annotationId", bind(dtos.PatchAnnotationsCmd{}), utils.Wrap(PatchAnnotation))
			annotationsRoute.Post("/graphite", reqEditorRole, bind(dtos.PostGraphiteAnnotationsCmd{}), utils.Wrap(PostGraphiteAnnotation))
		})

		// error test
		r.Get("/metrics/error", utils.Wrap(GenerateError))

		// short urls
		apiRoute.Post("/short-urls", bind(dtos.CreateShortURLCmd{}), utils.Wrap(hs.createShortURL))
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute routing.RouteRegister) {
		adminRoute.Get("/settings", utils.Wrap(AdminGetSettings))
		adminRoute.Post("/users", bind(dtos.AdminCreateUserForm{}), utils.Wrap(AdminCreateUser))
		adminRoute.Put("/users/:id/password", bind(dtos.AdminUpdateUserPasswordForm{}), utils.Wrap(AdminUpdateUserPassword))
		adminRoute.Put("/users/:id/permissions", bind(dtos.AdminUpdateUserPermissionsForm{}), utils.Wrap(AdminUpdateUserPermissions))
		adminRoute.Delete("/users/:id", utils.Wrap(AdminDeleteUser))
		adminRoute.Post("/users/:id/disable", utils.Wrap(hs.AdminDisableUser))
		adminRoute.Post("/users/:id/enable", utils.Wrap(AdminEnableUser))
		adminRoute.Get("/users/:id/quotas", utils.Wrap(GetUserQuotas))
		adminRoute.Put("/users/:id/quotas/:target", bind(models.UpdateUserQuotaCmd{}), utils.Wrap(UpdateUserQuota))
		adminRoute.Get("/stats", utils.Wrap(AdminGetStats))
		adminRoute.Post("/pause-all-alerts", bind(dtos.PauseAllAlertsCommand{}), utils.Wrap(PauseAllAlerts))

		adminRoute.Post("/users/:id/logout", utils.Wrap(hs.AdminLogoutUser))
		adminRoute.Get("/users/:id/auth-tokens", utils.Wrap(hs.AdminGetUserAuthTokens))
		adminRoute.Post("/users/:id/revoke-auth-token", bind(models.RevokeAuthTokenCmd{}), utils.Wrap(hs.AdminRevokeUserAuthToken))

		adminRoute.Post("/provisioning/dashboards/reload", utils.Wrap(hs.AdminProvisioningReloadDashboards))
		adminRoute.Post("/provisioning/plugins/reload", utils.Wrap(hs.AdminProvisioningReloadPlugins))
		adminRoute.Post("/provisioning/datasources/reload", utils.Wrap(hs.AdminProvisioningReloadDatasources))
		adminRoute.Post("/provisioning/notifications/reload", utils.Wrap(hs.AdminProvisioningReloadNotifications))
		adminRoute.Post("/ldap/reload", utils.Wrap(hs.ReloadLDAPCfg))
		adminRoute.Post("/ldap/sync/:id", utils.Wrap(hs.PostSyncUserWithLDAP))
		adminRoute.Get("/ldap/:username", utils.Wrap(hs.GetUserFromLDAP))
		adminRoute.Get("/ldap/status", utils.Wrap(hs.GetLDAPStatus))
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, hs.RenderToPng)

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, ProxyGnetRequest)

	// Gravatar service.
	avatarCacheServer := avatar.NewCacheServer()
	r.Get("/avatar/:hash", avatarCacheServer.Handler)

	// Snapshots
	r.Post("/api/snapshots/", reqSnapshotPublicModeOrSignedIn, bind(models.CreateDashboardSnapshotCommand{}), CreateDashboardSnapshot)
	r.Get("/api/snapshot/shared-options/", reqSignedIn, GetSharingOptions)
	r.Get("/api/snapshots/:key", utils.Wrap(GetDashboardSnapshot))
	r.Get("/api/snapshots-delete/:deleteKey", reqSnapshotPublicModeOrSignedIn, utils.Wrap(DeleteDashboardSnapshotByDeleteKey))
	r.Delete("/api/snapshots/:key", reqEditorRole, utils.Wrap(DeleteDashboardSnapshot))

	// Frontend logs
	r.Post("/log", middleware.RateLimit(hs.Cfg.Sentry.EndpointRPS, hs.Cfg.Sentry.EndpointBurst, time.Now), bind(frontendSentryEvent{}), utils.Wrap(hs.logFrontendMessage))
}
