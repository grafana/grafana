 package api

import (
	"github.com/Unknwon/macaron"
	"github.com/wangy1931/grafana/pkg/api/dtos"
	"github.com/wangy1931/grafana/pkg/middleware"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/macaron-contrib/binding"
)

// Register adds http routes
func Register(r *macaron.Macaron) {
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqGrafanaAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	reqEditorRole := middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN)
	regOrgAdmin := middleware.RoleAuth(m.ROLE_ADMIN)
	quota := middleware.Quota
	bind := binding.Bind

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
	r.Get("/admin/settings", reqGrafanaAdmin, Index)
	r.Get("/admin/users", reqGrafanaAdmin, Index)
	r.Get("/admin/users/create", reqGrafanaAdmin, Index)
	r.Get("/admin/users/edit/:id", reqGrafanaAdmin, Index)
	r.Get("/admin/orgs", reqGrafanaAdmin, Index)
	r.Get("/admin/orgs/edit/:id", reqGrafanaAdmin, Index)

	r.Get("/dashboard/*", reqSignedIn, Index)
	r.Get("/dashboard-solo/*", reqSignedIn, Index)

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
	r.Post("/api/snapshots/", bind(m.CreateDashboardSnapshotCommand{}), CreateDashboardSnapshot)
	r.Get("/dashboard/snapshot/*", Index)

	r.Get("/api/snapshots/:key", GetDashboardSnapshot)
	r.Get("/api/snapshots-delete/:key", DeleteDashboardSnapshot)

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
		}, regOrgAdmin)

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

		// auth api keys
    //TODO you can check username -->get user system --> get key
    r.Get("/auth/keys/", wrap(GetApiKeys))
		r.Group("/auth/keys", func() {
			r.Post("/", quota("api_key"), bind(m.AddApiKeyCommand{}), wrap(AddApiKey))
			r.Delete("/:id", wrap(DeleteApiKey))
		}, regOrgAdmin)

		// Data sources
		r.Group("/datasources", func() {
			r.Get("/", GetDataSources)
			r.Post("/", quota("data_source"), bind(m.AddDataSourceCommand{}), AddDataSource)
			r.Put("/:id", bind(m.UpdateDataSourceCommand{}), UpdateDataSource)
			r.Delete("/:id", DeleteDataSource)
			r.Get("/:id", wrap(GetDataSourceById))
			r.Get("/plugins", GetDataSourcePlugins)
		}, regOrgAdmin)

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
      r.Post("/system", reqEditorRole, bind(m.AddSystemDashboardCommand{}), AddOrUpdateSystemDashbord)
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
		r.Get("/customer", wrap(GetAllCustomerUsers))
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, RenderToPng)

	r.NotFound(NotFoundHandler)
}
