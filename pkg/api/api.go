package api

import (
	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

// Register adds http routes
func (hs *HttpServer) registerRoutes() {
	macaronR := hs.macaron
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqGrafanaAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	reqEditorRole := middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN)
	reqOrgAdmin := middleware.RoleAuth(m.ROLE_ADMIN)
	quota := middleware.Quota
	bind := binding.Bind

	// automatically set HEAD for every GET
	macaronR.SetAutoHead(true)

	r := newRouteRegister(middleware.RequestMetrics, middleware.RequestTracing)

	// not logged in views
	r.Get("/", reqSignedIn, Index)
	r.Get("/logout", Logout)
	r.Post("/login", quota("session"), bind(dtos.LoginCommand{}), wrap(LoginPost))
	r.Get("/login/:name", quota("session"), OAuthLogin)
	r.Get("/login", LoginView)
	r.Get("/invite/:code", Index)

	// authed views
	r.Get("/profile/", reqSignedIn, Index)
	r.Get("/profile/password", reqSignedIn, Index)
	r.Get("/profile/switch-org/:id", reqSignedIn, ChangeActiveOrgAndRedirectToHome)
	r.Get("/org/", reqSignedIn, Index)
	r.Get("/org/new", reqSignedIn, Index)
	r.Get("/datasources/", reqSignedIn, Index)
	r.Get("/datasources/new", reqSignedIn, Index)
	r.Get("/datasources/edit/*", reqSignedIn, Index)
	r.Get("/org/users/", reqSignedIn, Index)
	r.Get("/org/apikeys/", reqSignedIn, Index)
	r.Get("/dashboard/import/", reqSignedIn, Index)
	r.Get("/admin", reqGrafanaAdmin, Index)
	r.Get("/admin/settings", reqGrafanaAdmin, Index)
	r.Get("/admin/users", reqGrafanaAdmin, Index)
	r.Get("/admin/users/create", reqGrafanaAdmin, Index)
	r.Get("/admin/users/edit/:id", reqGrafanaAdmin, Index)
	r.Get("/admin/orgs", reqGrafanaAdmin, Index)
	r.Get("/admin/orgs/edit/:id", reqGrafanaAdmin, Index)
	r.Get("/admin/stats", reqGrafanaAdmin, Index)

	r.Get("/styleguide", reqSignedIn, Index)

	r.Get("/plugins", reqSignedIn, Index)
	r.Get("/plugins/:id/edit", reqSignedIn, Index)
	r.Get("/plugins/:id/page/:page", reqSignedIn, Index)

	r.Get("/dashboard/*", reqSignedIn, Index)
	r.Get("/dashboard-solo/snapshot/*", Index)
	r.Get("/dashboard-solo/*", reqSignedIn, Index)
	r.Get("/import/dashboard", reqSignedIn, Index)
	r.Get("/dashboards/*", reqSignedIn, Index)

	r.Get("/playlists/", reqSignedIn, Index)
	r.Get("/playlists/*", reqSignedIn, Index)
	r.Get("/alerting/", reqSignedIn, Index)
	r.Get("/alerting/*", reqSignedIn, Index)

	// sign up
	r.Get("/signup", Index)
	r.Get("/api/user/signup/options", wrap(GetSignUpOptions))
	r.Post("/api/user/signup", quota("user"), bind(dtos.SignUpForm{}), wrap(SignUp))
	r.Post("/api/user/signup/step2", bind(dtos.SignUpStep2Form{}), wrap(SignUpStep2))

	// invited
	r.Get("/api/user/invite/:code", wrap(GetInviteInfoByCode))
	r.Post("/api/user/invite/complete", bind(dtos.CompleteInviteForm{}), wrap(CompleteInvite))

	// reset password
	r.Get("/user/password/send-reset-email", Index)
	r.Get("/user/password/reset", Index)

	r.Post("/api/user/password/send-reset-email", bind(dtos.SendResetPasswordEmailForm{}), wrap(SendResetPasswordEmail))
	r.Post("/api/user/password/reset", bind(dtos.ResetUserPasswordForm{}), wrap(ResetPassword))

	// dashboard snapshots
	r.Get("/dashboard/snapshot/*", Index)
	r.Get("/dashboard/snapshots/", reqSignedIn, Index)

	// api for dashboard snapshots
	r.Post("/api/snapshots/", bind(m.CreateDashboardSnapshotCommand{}), CreateDashboardSnapshot)
	r.Get("/api/snapshot/shared-options/", GetSharingOptions)
	r.Get("/api/snapshots/:key", GetDashboardSnapshot)
	r.Get("/api/snapshots-delete/:key", reqEditorRole, DeleteDashboardSnapshot)

	// api renew session based on remember cookie
	r.Get("/api/login/ping", quota("session"), LoginApiPing)

	// authed api
	r.Group("/api", func(apiRoute RouteRegister) {

		// user (signed in)
		apiRoute.Group("/user", func(userRoute RouteRegister) {
			userRoute.Get("/", wrap(GetSignedInUser))
			userRoute.Put("/", bind(m.UpdateUserCommand{}), wrap(UpdateSignedInUser))
			userRoute.Post("/using/:id", wrap(UserSetUsingOrg))
			userRoute.Get("/orgs", wrap(GetSignedInUserOrgList))

			userRoute.Post("/stars/dashboard/:id", wrap(StarDashboard))
			userRoute.Delete("/stars/dashboard/:id", wrap(UnstarDashboard))

			userRoute.Put("/password", bind(m.ChangeUserPasswordCommand{}), wrap(ChangeUserPassword))
			userRoute.Get("/quotas", wrap(GetUserQuotas))
			userRoute.Put("/helpflags/:id", wrap(SetHelpFlag))
			// For dev purpose
			userRoute.Get("/helpflags/clear", wrap(ClearHelpFlags))

			userRoute.Get("/preferences", wrap(GetUserPreferences))
			userRoute.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), wrap(UpdateUserPreferences))
		})

		// users (admin permission required)
		apiRoute.Group("/users", func(usersRoute RouteRegister) {
			usersRoute.Get("/", wrap(SearchUsers))
			usersRoute.Get("/search", wrap(SearchUsersWithPaging))
			usersRoute.Get("/:id", wrap(GetUserById))
			usersRoute.Get("/:id/orgs", wrap(GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			usersRoute.Get("/lookup", wrap(GetUserByLoginOrEmail))
			usersRoute.Put("/:id", bind(m.UpdateUserCommand{}), wrap(UpdateUser))
			usersRoute.Post("/:id/using/:orgId", wrap(UpdateUserActiveOrg))
		}, reqGrafanaAdmin)

		// org information available to all users.
		apiRoute.Group("/org", func(orgRoute RouteRegister) {
			orgRoute.Get("/", wrap(GetOrgCurrent))
			orgRoute.Get("/quotas", wrap(GetOrgQuotas))
		})

		// current org
		apiRoute.Group("/org", func(orgRoute RouteRegister) {
			orgRoute.Put("/", bind(dtos.UpdateOrgForm{}), wrap(UpdateOrgCurrent))
			orgRoute.Put("/address", bind(dtos.UpdateOrgAddressForm{}), wrap(UpdateOrgAddressCurrent))
			orgRoute.Post("/users", quota("user"), bind(m.AddOrgUserCommand{}), wrap(AddOrgUserToCurrentOrg))
			orgRoute.Get("/users", wrap(GetOrgUsersForCurrentOrg))
			orgRoute.Patch("/users/:userId", bind(m.UpdateOrgUserCommand{}), wrap(UpdateOrgUserForCurrentOrg))
			orgRoute.Delete("/users/:userId", wrap(RemoveOrgUserForCurrentOrg))

			// invites
			orgRoute.Get("/invites", wrap(GetPendingOrgInvites))
			orgRoute.Post("/invites", quota("user"), bind(dtos.AddInviteForm{}), wrap(AddOrgInvite))
			orgRoute.Patch("/invites/:code/revoke", wrap(RevokeInvite))

			// prefs
			orgRoute.Get("/preferences", wrap(GetOrgPreferences))
			orgRoute.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), wrap(UpdateOrgPreferences))
		}, reqOrgAdmin)

		// create new org
		apiRoute.Post("/orgs", quota("org"), bind(m.CreateOrgCommand{}), wrap(CreateOrg))

		// search all orgs
		apiRoute.Get("/orgs", reqGrafanaAdmin, wrap(SearchOrgs))

		// orgs (admin routes)
		apiRoute.Group("/orgs/:orgId", func(orgsRoute RouteRegister) {
			orgsRoute.Get("/", wrap(GetOrgById))
			orgsRoute.Put("/", bind(dtos.UpdateOrgForm{}), wrap(UpdateOrg))
			orgsRoute.Put("/address", bind(dtos.UpdateOrgAddressForm{}), wrap(UpdateOrgAddress))
			orgsRoute.Delete("/", wrap(DeleteOrgById))
			orgsRoute.Get("/users", wrap(GetOrgUsers))
			orgsRoute.Post("/users", bind(m.AddOrgUserCommand{}), wrap(AddOrgUser))
			orgsRoute.Patch("/users/:userId", bind(m.UpdateOrgUserCommand{}), wrap(UpdateOrgUser))
			orgsRoute.Delete("/users/:userId", wrap(RemoveOrgUser))
			orgsRoute.Get("/quotas", wrap(GetOrgQuotas))
			orgsRoute.Put("/quotas/:target", bind(m.UpdateOrgQuotaCmd{}), wrap(UpdateOrgQuota))
		}, reqGrafanaAdmin)

		// orgs (admin routes)
		apiRoute.Group("/orgs/name/:name", func(orgsRoute RouteRegister) {
			orgsRoute.Get("/", wrap(GetOrgByName))
		}, reqGrafanaAdmin)

		// auth api keys
		apiRoute.Group("/auth/keys", func(keysRoute RouteRegister) {
			keysRoute.Get("/", wrap(GetApiKeys))
			keysRoute.Post("/", quota("api_key"), bind(m.AddApiKeyCommand{}), wrap(AddApiKey))
			keysRoute.Delete("/:id", wrap(DeleteApiKey))
		}, reqOrgAdmin)

		// Preferences
		apiRoute.Group("/preferences", func(prefRoute RouteRegister) {
			prefRoute.Post("/set-home-dash", bind(m.SavePreferencesCommand{}), wrap(SetHomeDashboard))
		})

		// Data sources
		apiRoute.Group("/datasources", func(datasourceRoute RouteRegister) {
			datasourceRoute.Get("/", wrap(GetDataSources))
			datasourceRoute.Post("/", quota("data_source"), bind(m.AddDataSourceCommand{}), wrap(AddDataSource))
			datasourceRoute.Put("/:id", bind(m.UpdateDataSourceCommand{}), wrap(UpdateDataSource))
			datasourceRoute.Delete("/:id", wrap(DeleteDataSourceById))
			datasourceRoute.Delete("/name/:name", wrap(DeleteDataSourceByName))
			datasourceRoute.Get("/:id", wrap(GetDataSourceById))
			datasourceRoute.Get("/name/:name", wrap(GetDataSourceByName))
		}, reqOrgAdmin)

		apiRoute.Get("/datasources/id/:name", wrap(GetDataSourceIdByName), reqSignedIn)

		apiRoute.Get("/plugins", wrap(GetPluginList))
		apiRoute.Get("/plugins/:pluginId/settings", wrap(GetPluginSettingById))
		apiRoute.Get("/plugins/:pluginId/markdown/:name", wrap(GetPluginMarkdown))

		apiRoute.Group("/plugins", func(pluginRoute RouteRegister) {
			pluginRoute.Get("/:pluginId/dashboards/", wrap(GetPluginDashboards))
			pluginRoute.Post("/:pluginId/settings", bind(m.UpdatePluginSettingCmd{}), wrap(UpdatePluginSetting))
		}, reqOrgAdmin)

		apiRoute.Get("/frontend/settings/", GetFrontendSettings)
		apiRoute.Any("/datasources/proxy/:id/*", reqSignedIn, hs.ProxyDataSourceRequest)
		apiRoute.Any("/datasources/proxy/:id", reqSignedIn, hs.ProxyDataSourceRequest)

		// Dashboard
		apiRoute.Group("/dashboards", func(dashboardRoute RouteRegister) {
			dashboardRoute.Get("/db/:slug", GetDashboard)
			dashboardRoute.Delete("/db/:slug", reqEditorRole, DeleteDashboard)

			dashboardRoute.Get("/id/:dashboardId/versions", wrap(GetDashboardVersions))
			dashboardRoute.Get("/id/:dashboardId/versions/:id", wrap(GetDashboardVersion))
			dashboardRoute.Post("/id/:dashboardId/restore", reqEditorRole, bind(dtos.RestoreDashboardVersionCommand{}), wrap(RestoreDashboardVersion))

			dashboardRoute.Post("/calculate-diff", bind(dtos.CalculateDiffOptions{}), wrap(CalculateDashboardDiff))

			dashboardRoute.Post("/db", reqEditorRole, bind(m.SaveDashboardCommand{}), wrap(PostDashboard))
			dashboardRoute.Get("/home", wrap(GetHomeDashboard))
			dashboardRoute.Get("/tags", GetDashboardTags)
			dashboardRoute.Post("/import", bind(dtos.ImportDashboardCommand{}), wrap(ImportDashboard))
		})

		// Dashboard snapshots
		apiRoute.Group("/dashboard/snapshots", func(dashboardRoute RouteRegister) {
			dashboardRoute.Get("/", wrap(SearchDashboardSnapshots))
		})

		// Playlist
		apiRoute.Group("/playlists", func(playlistRoute RouteRegister) {
			playlistRoute.Get("/", wrap(SearchPlaylists))
			playlistRoute.Get("/:id", ValidateOrgPlaylist, wrap(GetPlaylist))
			playlistRoute.Get("/:id/items", ValidateOrgPlaylist, wrap(GetPlaylistItems))
			playlistRoute.Get("/:id/dashboards", ValidateOrgPlaylist, wrap(GetPlaylistDashboards))
			playlistRoute.Delete("/:id", reqEditorRole, ValidateOrgPlaylist, wrap(DeletePlaylist))
			playlistRoute.Put("/:id", reqEditorRole, bind(m.UpdatePlaylistCommand{}), ValidateOrgPlaylist, wrap(UpdatePlaylist))
			playlistRoute.Post("/", reqEditorRole, bind(m.CreatePlaylistCommand{}), wrap(CreatePlaylist))
		})

		// Search
		apiRoute.Get("/search/", Search)

		// metrics
		apiRoute.Post("/tsdb/query", bind(dtos.MetricRequest{}), wrap(QueryMetrics))
		apiRoute.Get("/tsdb/testdata/scenarios", wrap(GetTestDataScenarios))
		apiRoute.Get("/tsdb/testdata/gensql", reqGrafanaAdmin, wrap(GenerateSqlTestData))
		apiRoute.Get("/tsdb/testdata/random-walk", wrap(GetTestDataRandomWalk))

		apiRoute.Group("/alerts", func(alertsRoute RouteRegister) {
			alertsRoute.Post("/test", bind(dtos.AlertTestCommand{}), wrap(AlertTest))
			alertsRoute.Post("/:alertId/pause", reqEditorRole, bind(dtos.PauseAlertCommand{}), wrap(PauseAlert))
			alertsRoute.Get("/:alertId", ValidateOrgAlert, wrap(GetAlert))
			alertsRoute.Get("/", wrap(GetAlerts))
			alertsRoute.Get("/states-for-dashboard", wrap(GetAlertStatesForDashboard))
		})

		apiRoute.Get("/alert-notifications", wrap(GetAlertNotifications))
		apiRoute.Get("/alert-notifiers", wrap(GetAlertNotifiers))

		apiRoute.Group("/alert-notifications", func(alertNotifications RouteRegister) {
			alertNotifications.Post("/test", bind(dtos.NotificationTestCommand{}), wrap(NotificationTest))
			alertNotifications.Post("/", bind(m.CreateAlertNotificationCommand{}), wrap(CreateAlertNotification))
			alertNotifications.Put("/:notificationId", bind(m.UpdateAlertNotificationCommand{}), wrap(UpdateAlertNotification))
			alertNotifications.Get("/:notificationId", wrap(GetAlertNotificationById))
			alertNotifications.Delete("/:notificationId", wrap(DeleteAlertNotification))
		}, reqEditorRole)

		apiRoute.Get("/annotations", wrap(GetAnnotations))
		apiRoute.Post("/annotations/mass-delete", reqOrgAdmin, bind(dtos.DeleteAnnotationsCmd{}), wrap(DeleteAnnotations))

		apiRoute.Group("/annotations", func(annotationsRoute RouteRegister) {
			annotationsRoute.Post("/", bind(dtos.PostAnnotationsCmd{}), wrap(PostAnnotation))
			annotationsRoute.Delete("/:annotationId", wrap(DeleteAnnotationById))
			annotationsRoute.Put("/:annotationId", bind(dtos.UpdateAnnotationsCmd{}), wrap(UpdateAnnotation))
			annotationsRoute.Delete("/region/:regionId", wrap(DeleteAnnotationRegion))
			annotationsRoute.Post("/graphite", bind(dtos.PostGraphiteAnnotationsCmd{}), wrap(PostGraphiteAnnotation))
		}, reqEditorRole)

		// error test
		r.Get("/metrics/error", wrap(GenerateError))

	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func(adminRoute RouteRegister) {
		adminRoute.Get("/settings", AdminGetSettings)
		adminRoute.Post("/users", bind(dtos.AdminCreateUserForm{}), AdminCreateUser)
		adminRoute.Put("/users/:id/password", bind(dtos.AdminUpdateUserPasswordForm{}), AdminUpdateUserPassword)
		adminRoute.Put("/users/:id/permissions", bind(dtos.AdminUpdateUserPermissionsForm{}), AdminUpdateUserPermissions)
		adminRoute.Delete("/users/:id", AdminDeleteUser)
		adminRoute.Get("/users/:id/quotas", wrap(GetUserQuotas))
		adminRoute.Put("/users/:id/quotas/:target", bind(m.UpdateUserQuotaCmd{}), wrap(UpdateUserQuota))
		adminRoute.Get("/stats", AdminGetStats)
		adminRoute.Post("/pause-all-alerts", bind(dtos.PauseAllAlertsCommand{}), wrap(PauseAllAlerts))
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, RenderToPng)

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, ProxyGnetRequest)

	// Gravatar service.
	avatarCacheServer := avatar.NewCacheServer()
	r.Get("/avatar/:hash", avatarCacheServer.Handler)

	// Websocket
	r.Any("/ws", hs.streamManager.Serve)

	// streams
	//r.Post("/api/streams/push", reqSignedIn, bind(dtos.StreamMessage{}), liveConn.PushToStream)

	r.Register(macaronR)

	InitAppPluginRoutes(macaronR)

	macaronR.NotFound(NotFoundHandler)
}
