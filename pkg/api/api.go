package api

import (
	"github.com/Unknwon/macaron"
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

// Register adds http routes
func Register(m *macaron.Macaron) {
	reqSignedIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})
	reqAdmin := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true, ReqAdmin: true})

	// not logged in views
	m.Get("/", reqSignedIn, Index)
	m.Post("/logout", LogoutPost)
	m.Post("/login", LoginPost)
	m.Get("/login/:name", OAuthLogin)
	m.Get("/login", Index)

	// authed views
	m.Get("/account/", reqSignedIn, Index)
	m.Get("/account/datasources/", reqSignedIn, Index)
	m.Get("/admin", reqSignedIn, Index)
	m.Get("/dashboard/*", reqSignedIn, Index)

	// sign up
	m.Get("/signup", Index)
	m.Post("/api/account/signup", SignUp)

	// authed api
	m.Group("/api", func() {
		// account
		m.Group("/account", func() {
			m.Get("/", GetAccount)
			m.Put("/collaborators", AddCollaborator)
			m.Delete("/collaborators/:id", RemoveCollaborator)
			m.Post("/using/:id", SetUsingAccount)
			m.Get("/others", GetOtherAccounts)
		})
		// Token
		m.Group("/tokens", func() {
			m.Combo("/").Get(GetTokens).Put(AddToken).Post(UpdateToken)
			m.Delete("/:id", DeleteToken)
		})
		// Data sources
		m.Group("/datasources", func() {
			m.Combo("/").Get(GetDataSources).Put(AddDataSource).Post(UpdateDataSource)
			m.Delete("/:id", DeleteDataSource)
			m.Any("/proxy/:id/*", reqSignedIn, ProxyDataSourceRequest)
		})
		// Dashboard
		m.Group("/dashboard", func() {
			m.Combo("/:slug").Get(GetDashboard).Delete(DeleteDashboard)
			m.Post("/", PostDashboard)
		})
		// Search
		m.Get("/search/", Search)
		// metrics
		m.Get("/metrics/test", GetTestMetrics)
	}, reqSignedIn)

	// admin api
	m.Group("/api/admin", func() {
		m.Get("/accounts", AdminSearchAccounts)
	}, reqAdmin)

	// rendering
	m.Get("/render/*", reqSignedIn, RenderToPng)

	m.NotFound(NotFound)
}

func setIndexViewData(c *middleware.Context) error {
	settings, err := getFrontendSettings(c)
	if err != nil {
		return err
	}

	c.Data["User"] = dtos.NewCurrentUser(c.UserAccount)
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
