package api

import (
	"github.com/go-macaron/binding"
	"github.com/wangy1931/grafana/pkg/api/avatar"
	"github.com/wangy1931/grafana/pkg/api/dtos"
	"github.com/wangy1931/grafana/pkg/api/live"
	"github.com/wangy1931/grafana/pkg/middleware"
	m "github.com/wangy1931/grafana/pkg/models"
	"gopkg.in/macaron.v1"
)

// Register adds http routes
func Register(r *macaron.Macaron) {
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqGrafanaAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	reqEditorRole := middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN)
	reqOrgAdmin := middleware.RoleAuth(m.ROLE_ADMIN)
	quota := middleware.Quota
	bind := binding.Bind

	//cloudwiz update
	r.Get("/systems", reqSignedIn, Index)
	r.Get("/summary", reqSignedIn, Index)
	r.Get("/service", reqSignedIn, Index)
	r.Get("/alerts", reqSignedIn, Index)
	r.Get("/alerts/edit/:id", reqSignedIn, Index)
	r.Get("/alerts/new", reqSignedIn, Index)
	r.Get("/alerts/status", reqSignedIn, Index)
	r.Get("/alerts/history", reqSignedIn, Index)
	r.Get("/alerts/association/:host/:distance/:metric*", reqSignedIn, Index)
	r.Get("/oncallerschedule", reqSignedIn, Index)
	r.Get("/oncallers", reqSignedIn, Index)
	r.Get("/oncallers/edit/:id", reqSignedIn, Index)
	r.Get("/oncallers/new", reqSignedIn, Index)
	r.Get("/anomaly", reqSignedIn, Index)
	r.Get("/anomaly/history", reqSignedIn, Index)
	r.Get("/anomaly/:clusterId", reqSignedIn, Index)
	r.Get("/decompose", reqSignedIn, Index)
	r.Get("/signupfree", reqSignedIn, Index)
	r.Get("/logs", reqSignedIn, Index)
	r.Get("/analysis", reqSignedIn, Index)
	r.Get("/association", reqSignedIn, Index)
	r.Get("/knowledgebase", reqSignedIn, Index)
	r.Get("/install", reqSignedIn, Index)
	r.Get("/health", reqSignedIn, Index)
	r.Get("/customer", reqSignedIn, Index)
	r.Get("/report", reqSignedIn, Index)
	r.Get("/cluster", reqSignedIn, Index)
	r.Get("/integrate", reqSignedIn, Index)
	r.Get("/setting/agent", reqSignedIn, Index)
	r.Get("/setting/service", reqSignedIn, Index)
	r.Get("/setting/filebeat", reqSignedIn, Index)
	r.Get("/service_v2", reqSignedIn, Index)
	r.Get("/service_dependency", reqSignedIn, Index)

	// cmdb
	r.Get("/cmdb/hostlist", reqSignedIn, Index)
	r.Get("/cmdb/hostlist/hostdetail", reqSignedIn, Index)
	r.Get("/cmdb/setup", reqSignedIn, Index)

	// not logged in views
	r.Get("/", reqSignedIn, Index)
	r.Get("/logout", Logout)
	r.Post("/login", quota("session"), bind(dtos.LoginCommand{}), wrap(LoginPost))
	r.Get("/login/:name", quota("session"), OAuthLogin)
	r.Get("/login", LoginView)
	r.Get("/invite/:code", Index)

	// authed views
	r.Get("/profile/", reqSignedIn, Index)
	r.Get("/org/", reqSignedIn, Index)
	r.Get("/org/new", reqSignedIn, Index)
	r.Get("/datasources/", reqSignedIn, Index)
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
	r.Get("/dashboard-solo/*", reqSignedIn, Index)

	r.Get("/playlists/", reqSignedIn, Index)
	r.Get("/playlists/*", reqSignedIn, Index)

  // alerts and oncallers
	r.Get("/alerts", reqSignedIn, Index)
	r.Get("/oncallers", reqSignedIn, Index)

	// sign up
  //TODO comment out before we will strong
	//r.Get("/signup", Index)
	//r.Get("/api/user/signup/options", wrap(GetSignUpOptions))
	//r.Post("/api/user/signup", quota("user"), bind(dtos.SignUpForm{}), wrap(SignUp))
	//r.Post("/api/user/signup/step2", bind(dtos.SignUpStep2Form{}), wrap(SignUpStep2))

  r.Post("/api/user/signup/propose",quota("user"), bind(dtos.ProposeUsers{}), wrap(ProposeToUse))

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
      r.Get("/system",wrap(GetCurrentUserSystem))
		})

		r.Group("/system", func() {
			r.Post("/pick", bind(m.AddOrUpdateSystemPick{}), wrap(AddOrUpdatePickSystem))
		})
		// users (admin permission required)
		r.Group("/users", func() {
			r.Get("/", wrap(SearchUsers))
			r.Get("/:id", wrap(GetUserById))
			r.Get("/:id/orgs", wrap(GetUserOrgList))
			r.Put("/:id", bind(m.UpdateUserCommand{}), wrap(UpdateUser))
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

			// system
			r.Put("/system", bind(dtos.UpdateSystems{}), wrap(UpdateSystems))
			r.Post("/system", bind(m.AddSystemsCommand{}), wrap(AddNewSystems))
			r.Get("/system", wrap(GetSystemsForCurrentOrg))
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
    //TODO you can check username -->get user system --> get key
    r.Get("/auth/keys/", wrap(GetApiKeys))
		r.Group("/auth/keys", func() {
			r.Get("/", wrap(GetApiKeys))
			r.Post("/", quota("api_key"), bind(m.AddApiKeyCommand{}), wrap(AddApiKey))
			r.Delete("/:id", wrap(DeleteApiKey))
		}, reqOrgAdmin)

		// Data sources
		r.Group("/datasources", func() {
			r.Get("/", GetDataSources)
			r.Post("/", quota("data_source"), bind(m.AddDataSourceCommand{}), AddDataSource)
			r.Put("/:id", bind(m.UpdateDataSourceCommand{}), UpdateDataSource)
			r.Delete("/:id", DeleteDataSource)
			r.Get("/:id", wrap(GetDataSourceById))
			r.Get("/name/:name", wrap(GetDataSourceByName))
		}, reqOrgAdmin)

		r.Get("/datasources/id/:name", wrap(GetDataSourceIdByName), reqSignedIn)

		r.Group("/plugins", func() {
			r.Get("/", wrap(GetPluginList))

			r.Get("/:pluginId/readme", wrap(GetPluginReadme))
			r.Get("/:pluginId/dashboards/", wrap(GetPluginDashboards))
			r.Get("/:pluginId/settings", wrap(GetPluginSettingById))
			r.Post("/:pluginId/settings", bind(m.UpdatePluginSettingCmd{}), wrap(UpdatePluginSetting))
		}, reqOrgAdmin)

		// Alert source
    r.Get("/customized_sources", GetCustomizedSource)

		r.Get("/frontend/settings/", GetFrontendSettings)
		r.Any("/datasources/proxy/:id/*", reqSignedIn, ProxyDataSourceRequest)
		r.Any("/datasources/proxy/:id", reqSignedIn, ProxyDataSourceRequest)

		// Dashboard
		r.Group("/dashboards", func() {
			r.Combo("/db/:slug").Get(GetDashboard).Delete(DeleteDashboard)
			r.Post("/db", reqEditorRole, bind(m.SaveDashboardCommand{}), PostDashboard)
			r.Get("/file/:file", GetDashboardFromJsonFile)
			r.Get("/home", GetHomeDashboard)
			r.Get("/tags", GetDashboardTags)
			r.Post("/import", bind(dtos.ImportDashboardCommand{}), wrap(ImportDashboard))
			r.Post("/system", reqEditorRole, bind(m.AddSystemDashboardCommand{}), AddOrUpdateSystemDashbord)
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
		r.Get("/metrics/test", GetTestMetrics)

		r.Group("/static", func() {
			//dashboard
			r.Get("/:name", GetStaticFile)
			//template
			r.Get("/template/:name",GetDashboardTemplate)
			//alertdef
			r.Get("/alertd/:name",GetAlertDef)
			// metric help message
			r.Get("/metric/:name", GetMetricHelpFile)
		})
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
		r.Get("/customer", wrap(GetAllCustomerUsers))
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, RenderToPng)

	// Gravatar service.
	avt := avatar.CacheServer()
	r.Get("/avatar/:hash", avt.ServeHTTP)

	// Websocket
	liveConn := live.New()
	r.Any("/ws", liveConn.Serve)

	// streams
	r.Post("/api/streams/push", reqSignedIn, bind(dtos.StreamMessage{}), liveConn.PushToStream)

	InitAppPluginRoutes(r)

}
