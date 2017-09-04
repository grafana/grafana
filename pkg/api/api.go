package api

import (
	"github.com/go-macaron/binding"
	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Register adds http routes
func (hs *HttpServer) registerRoutes() {
	r := hs.macaron
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqGrafanaAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	reqEditorRole := middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN)
	reqOrgAdmin := middleware.RoleAuth(m.ROLE_ADMIN)
	quota := middleware.Quota
	bind := binding.Bind

	// automatically set HEAD for every GET
	r.SetAutoHead(true)

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

	r.Get("/metrics", promhttp.Handler())

	// authed api
	r.Group("/api", func() {

		// user (signed in)
		r.Group("/user", func() {
			r.Get("/", wrap(GetSignedInUser))
			r.Put("/", bind(m.UpdateUserCommand{}), wrap(UpdateSignedInUser))
			r.Post("/using/:id", wrap(UserSetUsingOrg))
			r.Get("/orgs", wrap(GetSignedInUserOrgList))

			r.Post("/stars/dashboard/:id", wrap(StarDashboard))
			r.Delete("/stars/dashboard/:id", wrap(UnstarDashboard))

			r.Put("/password", bind(m.ChangeUserPasswordCommand{}), wrap(ChangeUserPassword))
			r.Get("/quotas", wrap(GetUserQuotas))
			r.Put("/helpflags/:id", wrap(SetHelpFlag))
			// For dev purpose
			r.Get("/helpflags/clear", wrap(ClearHelpFlags))

			r.Get("/preferences", wrap(GetUserPreferences))
			r.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), wrap(UpdateUserPreferences))
		})

		// users (admin permission required)
		r.Group("/users", func() {
			r.Get("/", wrap(SearchUsers))
			r.Get("/search", wrap(SearchUsersWithPaging))
			r.Get("/:id", wrap(GetUserById))
			r.Get("/:id/orgs", wrap(GetUserOrgList))
			// query parameters /users/lookup?loginOrEmail=admin@example.com
			r.Get("/lookup", wrap(GetUserByLoginOrEmail))
			r.Put("/:id", bind(m.UpdateUserCommand{}), wrap(UpdateUser))
			r.Post("/:id/using/:orgId", wrap(UpdateUserActiveOrg))
		}, reqGrafanaAdmin)

		// org information available to all users.
		r.Group("/org", func() {
			r.Get("/", wrap(GetOrgCurrent))
			r.Get("/quotas", wrap(GetOrgQuotas))
		})

		// current org
		r.Group("/org", func() {
			r.Put("/", bind(dtos.UpdateOrgForm{}), wrap(UpdateOrgCurrent))
			r.Put("/address", bind(dtos.UpdateOrgAddressForm{}), wrap(UpdateOrgAddressCurrent))
			r.Post("/users", quota("user"), bind(m.AddOrgUserCommand{}), wrap(AddOrgUserToCurrentOrg))
			r.Get("/users", wrap(GetOrgUsersForCurrentOrg))
			r.Patch("/users/:userId", bind(m.UpdateOrgUserCommand{}), wrap(UpdateOrgUserForCurrentOrg))
			r.Delete("/users/:userId", wrap(RemoveOrgUserForCurrentOrg))

			// invites
			r.Get("/invites", wrap(GetPendingOrgInvites))
			r.Post("/invites", quota("user"), bind(dtos.AddInviteForm{}), wrap(AddOrgInvite))
			r.Patch("/invites/:code/revoke", wrap(RevokeInvite))

			// prefs
			r.Get("/preferences", wrap(GetOrgPreferences))
			r.Put("/preferences", bind(dtos.UpdatePrefsCmd{}), wrap(UpdateOrgPreferences))
		}, reqOrgAdmin)

		// create new org
		r.Post("/orgs", quota("org"), bind(m.CreateOrgCommand{}), wrap(CreateOrg))

		// search all orgs
		r.Get("/orgs", reqGrafanaAdmin, wrap(SearchOrgs))

		// orgs (admin routes)
		r.Group("/orgs/:orgId", func() {
			r.Get("/", wrap(GetOrgById))
			r.Put("/", bind(dtos.UpdateOrgForm{}), wrap(UpdateOrg))
			r.Put("/address", bind(dtos.UpdateOrgAddressForm{}), wrap(UpdateOrgAddress))
			r.Delete("/", wrap(DeleteOrgById))
			r.Get("/users", wrap(GetOrgUsers))
			r.Post("/users", bind(m.AddOrgUserCommand{}), wrap(AddOrgUser))
			r.Patch("/users/:userId", bind(m.UpdateOrgUserCommand{}), wrap(UpdateOrgUser))
			r.Delete("/users/:userId", wrap(RemoveOrgUser))
			r.Get("/quotas", wrap(GetOrgQuotas))
			r.Put("/quotas/:target", bind(m.UpdateOrgQuotaCmd{}), wrap(UpdateOrgQuota))
		}, reqGrafanaAdmin)

		// orgs (admin routes)
		r.Group("/orgs/name/:name", func() {
			r.Get("/", wrap(GetOrgByName))
		}, reqGrafanaAdmin)

		// auth api keys
		r.Group("/auth/keys", func() {
			r.Get("/", wrap(GetApiKeys))
			r.Post("/", quota("api_key"), bind(m.AddApiKeyCommand{}), wrap(AddApiKey))
			r.Delete("/:id", wrap(DeleteApiKey))
		}, reqOrgAdmin)

		// Preferences
		r.Group("/preferences", func() {
			r.Post("/set-home-dash", bind(m.SavePreferencesCommand{}), wrap(SetHomeDashboard))
		})

		// Data sources
		r.Group("/datasources", func() {
			r.Get("/", wrap(GetDataSources))
			r.Post("/", quota("data_source"), bind(m.AddDataSourceCommand{}), AddDataSource)
			r.Put("/:id", bind(m.UpdateDataSourceCommand{}), wrap(UpdateDataSource))
			r.Delete("/:id", DeleteDataSourceById)
			r.Delete("/name/:name", DeleteDataSourceByName)
			r.Get("/:id", wrap(GetDataSourceById))
			r.Get("/name/:name", wrap(GetDataSourceByName))
		}, reqOrgAdmin)

		r.Get("/datasources/id/:name", wrap(GetDataSourceIdByName), reqSignedIn)

		r.Get("/plugins", wrap(GetPluginList))
		r.Get("/plugins/:pluginId/settings", wrap(GetPluginSettingById))
		r.Get("/plugins/:pluginId/markdown/:name", wrap(GetPluginMarkdown))

		r.Group("/plugins", func() {
			r.Get("/:pluginId/dashboards/", wrap(GetPluginDashboards))
			r.Post("/:pluginId/settings", bind(m.UpdatePluginSettingCmd{}), wrap(UpdatePluginSetting))
		}, reqOrgAdmin)

		r.Get("/frontend/settings/", GetFrontendSettings)
		r.Any("/datasources/proxy/:id/*", reqSignedIn, hs.ProxyDataSourceRequest)
		r.Any("/datasources/proxy/:id", reqSignedIn, hs.ProxyDataSourceRequest)

		// Dashboard
		r.Group("/dashboards", func() {
			r.Get("/db/:slug", GetDashboard)
			r.Delete("/db/:slug", reqEditorRole, DeleteDashboard)

			r.Get("/id/:dashboardId/versions", wrap(GetDashboardVersions))
			r.Get("/id/:dashboardId/versions/:id", wrap(GetDashboardVersion))
			r.Post("/id/:dashboardId/restore", reqEditorRole, bind(dtos.RestoreDashboardVersionCommand{}), wrap(RestoreDashboardVersion))

			r.Post("/calculate-diff", bind(dtos.CalculateDiffOptions{}), wrap(CalculateDashboardDiff))

			r.Post("/db", reqEditorRole, bind(m.SaveDashboardCommand{}), wrap(PostDashboard))
			r.Get("/file/:file", GetDashboardFromJsonFile)
			r.Get("/home", wrap(GetHomeDashboard))
			r.Get("/tags", GetDashboardTags)
			r.Post("/import", bind(dtos.ImportDashboardCommand{}), wrap(ImportDashboard))
		})

		// Dashboard snapshots
		r.Group("/dashboard/snapshots", func() {
			r.Get("/", wrap(SearchDashboardSnapshots))
		})

		// Playlist
		r.Group("/playlists", func() {
			r.Get("/", wrap(SearchPlaylists))
			r.Get("/:id", ValidateOrgPlaylist, wrap(GetPlaylist))
			r.Get("/:id/items", ValidateOrgPlaylist, wrap(GetPlaylistItems))
			r.Get("/:id/dashboards", ValidateOrgPlaylist, wrap(GetPlaylistDashboards))
			r.Delete("/:id", reqEditorRole, ValidateOrgPlaylist, wrap(DeletePlaylist))
			r.Put("/:id", reqEditorRole, bind(m.UpdatePlaylistCommand{}), ValidateOrgPlaylist, wrap(UpdatePlaylist))
			r.Post("/", reqEditorRole, bind(m.CreatePlaylistCommand{}), wrap(CreatePlaylist))
		})

		// Search
		r.Get("/search/", Search)

		// metrics
		r.Post("/tsdb/query", bind(dtos.MetricRequest{}), wrap(QueryMetrics))
		r.Get("/tsdb/testdata/scenarios", wrap(GetTestDataScenarios))
		r.Get("/tsdb/testdata/gensql", reqGrafanaAdmin, wrap(GenerateSqlTestData))
		r.Get("/tsdb/testdata/random-walk", wrap(GetTestDataRandomWalk))

		// metrics
		//r.Get("/metrics", wrap(GetInternalMetrics))

		r.Group("/alerts", func() {
			r.Post("/test", bind(dtos.AlertTestCommand{}), wrap(AlertTest))
			r.Post("/:alertId/pause", bind(dtos.PauseAlertCommand{}), wrap(PauseAlert), reqEditorRole)
			r.Get("/:alertId", ValidateOrgAlert, wrap(GetAlert))
			r.Get("/", wrap(GetAlerts))
			r.Get("/states-for-dashboard", wrap(GetAlertStatesForDashboard))
		})

		r.Get("/alert-notifications", wrap(GetAlertNotifications))
		r.Get("/alert-notifiers", wrap(GetAlertNotifiers))

		r.Group("/alert-notifications", func() {
			r.Post("/test", bind(dtos.NotificationTestCommand{}), wrap(NotificationTest))
			r.Post("/", bind(m.CreateAlertNotificationCommand{}), wrap(CreateAlertNotification))
			r.Put("/:notificationId", bind(m.UpdateAlertNotificationCommand{}), wrap(UpdateAlertNotification))
			r.Get("/:notificationId", wrap(GetAlertNotificationById))
			r.Delete("/:notificationId", wrap(DeleteAlertNotification))
		}, reqEditorRole)

		r.Get("/annotations", wrap(GetAnnotations))
		r.Post("/annotations/mass-delete", reqOrgAdmin, bind(dtos.DeleteAnnotationsCmd{}), wrap(DeleteAnnotations))

		r.Group("/annotations", func() {
			r.Post("/", bind(dtos.PostAnnotationsCmd{}), wrap(PostAnnotation))
		}, reqEditorRole)

		// error test
		r.Get("/metrics/error", wrap(GenerateError))

	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func() {
		r.Get("/settings", AdminGetSettings)
		r.Post("/users", bind(dtos.AdminCreateUserForm{}), AdminCreateUser)
		r.Put("/users/:id/password", bind(dtos.AdminUpdateUserPasswordForm{}), AdminUpdateUserPassword)
		r.Put("/users/:id/permissions", bind(dtos.AdminUpdateUserPermissionsForm{}), AdminUpdateUserPermissions)
		r.Delete("/users/:id", AdminDeleteUser)
		r.Get("/users/:id/quotas", wrap(GetUserQuotas))
		r.Put("/users/:id/quotas/:target", bind(m.UpdateUserQuotaCmd{}), wrap(UpdateUserQuota))
		r.Get("/stats", AdminGetStats)
		r.Post("/pause-all-alerts", bind(dtos.PauseAllAlertsCommand{}), wrap(PauseAllAlerts))
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, RenderToPng)

	// grafana.net proxy
	r.Any("/api/gnet/*", reqSignedIn, ProxyGnetRequest)

	// Gravatar service.
	avt := avatar.CacheServer()
	r.Get("/avatar/:hash", avt.ServeHTTP)

	// Websocket
	r.Any("/ws", hs.streamManager.Serve)

	// streams
	//r.Post("/api/streams/push", reqSignedIn, bind(dtos.StreamMessage{}), liveConn.PushToStream)

	InitAppPluginRoutes(r)

	r.NotFound(NotFoundHandler)
}
