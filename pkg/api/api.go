package api

import (
	"github.com/Unknwon/macaron"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/macaron-contrib/binding"
)

// Register adds http routes
func Register(r *macaron.Macaron) {
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqGrafanaAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	reqEditorRole := middleware.RoleAuth(m.ROLE_EDITOR, m.ROLE_ADMIN)
	reqAccountAdmin := middleware.RoleAuth(m.ROLE_ADMIN)
	bind := binding.Bind

	// not logged in views
	r.Get("/", reqSignedIn, Index)
	r.Get("/logout", Logout)
	r.Post("/login", bind(dtos.LoginCommand{}), LoginPost)
	r.Get("/login/:name", OAuthLogin)
	r.Get("/login", LoginView)

	// authed views
	r.Get("/profile/", reqSignedIn, Index)
	r.Get("/org/", reqSignedIn, Index)
	r.Get("/datasources/", reqSignedIn, Index)
	r.Get("/org/users/", reqSignedIn, Index)
	r.Get("/org/apikeys/", reqSignedIn, Index)
	r.Get("/dashboard/import/", reqSignedIn, Index)
	r.Get("/admin/settings", reqGrafanaAdmin, Index)
	r.Get("/admin/users", reqGrafanaAdmin, Index)
	r.Get("/admin/users/create", reqGrafanaAdmin, Index)
	r.Get("/admin/users/edit/:id", reqGrafanaAdmin, Index)
	r.Get("/dashboard/*", reqSignedIn, Index)
	r.Get("/network/locations", reqSignedIn, Index)
	r.Get("/network/monitors", reqSignedIn, Index)
	r.Get("/network/sites", reqSignedIn, Index)
	// sign up
	r.Get("/signup", Index)
	r.Post("/api/user/signup", bind(m.CreateUserCommand{}), SignUp)

	// authed api
	r.Group("/api", func() {
		// user
		r.Group("/user", func() {
			r.Get("/", GetUser)
			r.Put("/", bind(m.UpdateUserCommand{}), UpdateUser)
			r.Post("/using/:id", UserSetUsingOrg)
			r.Get("/orgs", GetUserOrgList)
			r.Post("/stars/dashboard/:id", StarDashboard)
			r.Delete("/stars/dashboard/:id", UnstarDashboard)
			r.Put("/password", bind(m.ChangeUserPasswordCommand{}), ChangeUserPassword)
		})

		// Org
		r.Get("/", GetOrg)
		r.Group("/org", func() {
			r.Post("/", bind(m.CreateOrgCommand{}), CreateOrg)
			r.Put("/", bind(m.UpdateOrgCommand{}), UpdateOrg)
			r.Post("/users", bind(m.AddOrgUserCommand{}), AddOrgUser)
			r.Get("/users", GetOrgUsers)
			r.Delete("/users/:id", RemoveOrgUser)
		}, reqAccountAdmin)

		// auth api keys
		r.Group("/auth/keys", func() {
			r.Get("/", GetApiKeys)
			r.Post("/", bind(m.AddApiKeyCommand{}), AddApiKey)
			r.Delete("/:id", DeleteApiKey)
		}, reqAccountAdmin)

		// Data sources
		r.Group("/datasources", func() {
			r.Combo("/").Get(GetDataSources).Put(AddDataSource).Post(UpdateDataSource)
			r.Delete("/:id", DeleteDataSource)
			r.Get("/:id", GetDataSourceById)
		}, reqAccountAdmin)

		r.Get("/frontend/settings/", GetFrontendSettings)
		r.Any("/datasources/proxy/:id/*", reqSignedIn, ProxyDataSourceRequest)

		// Dashboard
		r.Group("/dashboards", func() {
			r.Combo("/db/:slug").Get(GetDashboard).Delete(DeleteDashboard)
			r.Post("/db", reqEditorRole, bind(m.SaveDashboardCommand{}), PostDashboard)
			r.Get("/home", GetHomeDashboard)
		})

		// Search
		r.Get("/search/", Search)

		// metrics
		r.Get("/metrics/test", GetTestMetrics)

		// locations
		r.Group("/locations", func() {
			r.Combo("/").
				Get(bind(m.GetLocationsQuery{}), GetLocations).
				Put(AddLocation).
				Post(UpdateLocation)
			r.Get("/:id", GetLocationById)
			r.Delete("/:id", DeleteLocation)
		})

		// Monitors
		r.Group("/monitors", func() {
			r.Combo("/").
				Get(bind(m.GetMonitorsQuery{}), GetMonitors).
				Put(AddMonitor).Post(UpdateMonitor)
			r.Get("/:id", GetMonitorById)
			r.Delete("/:id", DeleteMonitor)
		})
		// sites
		r.Group("/sites", func() {
			r.Combo("/").Get(GetSites).Put(AddSite).Post(UpdateSite)
			r.Get("/:id", GetSiteById)
			r.Delete("/:id", DeleteSite)
		})

		r.Get("/monitor_types", GetMonitorTypes)
		
		//Events
		r.Get("/events", bind(m.GetEventsQuery{}), GetEvents)

		//Get Graph data from Graphite.
		r.Any("/graphite/*", GraphiteProxy)

	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func() {
		r.Get("/settings", AdminGetSettings)
		r.Get("/users", AdminSearchUsers)
		r.Get("/users/:id", AdminGetUser)
		r.Post("/users", bind(dtos.AdminCreateUserForm{}), AdminCreateUser)
		r.Put("/users/:id/details", bind(dtos.AdminUpdateUserForm{}), AdminUpdateUser)
		r.Put("/users/:id/password", bind(dtos.AdminUpdateUserPasswordForm{}), AdminUpdateUserPassword)
		r.Put("/users/:id/permissions", bind(dtos.AdminUpdateUserPermissionsForm{}), AdminUpdateUserPermissions)
		r.Delete("/users/:id", AdminDeleteUser)
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, RenderToPng)

	r.NotFound(NotFound)
}
