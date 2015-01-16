package api

import (
	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/binding"
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

// Register adds http routes
func Register(r *macaron.Macaron) {
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqGrafanaAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqGrafanaAdmin: true})
	bind := binding.Bind

	// not logged in views
	r.Get("/", reqSignedIn, Index)
	r.Post("/logout", LogoutPost)
	r.Post("/login", LoginPost)
	r.Get("/login/:name", OAuthLogin)
	r.Get("/login", Index)

	// authed views
	r.Get("/account/", reqSignedIn, Index)
	r.Get("/account/datasources/", reqSignedIn, Index)
	r.Get("/account/collaborators/", reqSignedIn, Index)
	r.Get("/account/apikeys/", reqSignedIn, Index)
	r.Get("/admin", reqSignedIn, Index)
	r.Get("/dashboard/*", reqSignedIn, Index)
	r.Get("/location", reqSignedIn, Index)
	r.Get("/monitor", reqSignedIn, Index)


	// sign up
	r.Get("/signup", Index)
	r.Post("/api/account/signup", SignUp)

	// authed api
	r.Group("/api", func() {
		// account
		r.Group("/account", func() {
			r.Get("/", GetAccount)
			r.Post("/", UpdateAccount)
			r.Put("/collaborators", bind(m.AddCollaboratorCommand{}), AddCollaborator)
			r.Get("/collaborators", GetCollaborators)
			r.Delete("/collaborators/:id", RemoveCollaborator)
			r.Post("/using/:id", SetUsingAccount)
			r.Get("/others", GetOtherAccounts)
		})
		// Token
		r.Group("/tokens", func() {
			r.Combo("/").
				Get(GetTokens).
				Put(bind(m.AddTokenCommand{}), AddToken).
				Post(bind(m.UpdateTokenCommand{}), UpdateToken)
			r.Delete("/:id", DeleteToken)
		})
		// Data sources
		r.Group("/datasources", func() {
			r.Combo("/").Get(GetDataSources).Put(AddDataSource).Post(UpdateDataSource)
			r.Delete("/:id", DeleteDataSource)
			r.Any("/proxy/:id/*", reqSignedIn, ProxyDataSourceRequest)
		})
		// Dashboard
		r.Group("/dashboard", func() {
			r.Combo("/:slug").Get(GetDashboard).Delete(DeleteDashboard)
			r.Post("/", bind(m.SaveDashboardCommand{}), PostDashboard)
		})
		// Search
		r.Get("/search/", Search)
		// metrics

		r.Get("/metrics/test", GetTestMetrics)

		// locations
		r.Group("/locations", func() {
			r.Combo("/").Get(GetLocations).Put(AddLocation).Post(UpdateLocation)
			r.Get("/:slug", GetLocationBySlug)
			r.Delete("/:id", DeleteLocation)
		})
		
		// Monitors
		r.Group("/monitors", func() {
			r.Combo("/").Get(GetMonitors).Put(AddMonitor).Post(UpdateMonitor)
			r.Get("/:id", GetMonitorById)
			r.Delete("/:id", DeleteMonitor)
		})
		r.Get("/monitor_types", GetMonitorTypes)
	}, reqSignedIn)

	// admin api
	r.Group("/api/admin", func() {
		r.Get("/accounts", AdminSearchAccounts)
	}, reqGrafanaAdmin)

	// rendering
	r.Get("/render/*", reqSignedIn, RenderToPng)

	r.NotFound(NotFound)
}

func setIndexViewData(c *middleware.Context) error {
	settings, err := getFrontendSettings(c)
	if err != nil {
		return err
	}

	currentUser := &dtos.CurrentUser{}

	if c.IsSignedIn {
		currentUser = &dtos.CurrentUser{
			Login:            c.UserLogin,
			Email:            c.UserEmail,
			Name:             c.UserName,
			UsingAccountName: c.UsingAccountName,
			GravatarUrl:      dtos.GetGravatarUrl(c.UserEmail),
			IsGrafanaAdmin:   c.IsGrafanaAdmin,
			Role:             c.UserRole,
		}
	}

	c.Data["User"] = currentUser
	c.Data["Settings"] = settings
	c.Data["AppUrl"] = setting.AppUrl
	c.Data["AppSubUrl"] = setting.AppSubUrl

	return nil
}

func Index(c *middleware.Context) {
	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(200, "index")
}

func NotFound(c *middleware.Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(200, "Not found", nil)
		return
	}

	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(404, "index")
}
