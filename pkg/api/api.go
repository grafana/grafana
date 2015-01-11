package api

import (
	"github.com/Unknwon/macaron"
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

func Register(m *macaron.Macaron) {
	auth := middleware.Auth()

	// index
	m.Get("/", auth, Index)
	m.Post("/logout", LogoutPost)
	m.Post("/login", LoginPost)

	// login
	m.Get("/login/:name", OAuthLogin)
	m.Get("/login", Index)

	// account
	m.Get("/account/", auth, Index)
	m.Get("/api/account/", auth, GetAccount)
	m.Post("/api/account/collaborators/add", auth, AddCollaborator)
	m.Post("/api/account/using/:id", auth, SetUsingAccount)
	m.Get("/api/account/others", auth, GetOtherAccounts)

	// data sources
	m.Get("/acount/datasources/", auth, Index)
	m.Get("/api/datasources/list", auth, GetDataSources)
	m.Put("/api/datasources", auth, AddDataSource)
	m.Post("/api/datasources", auth, UpdateDataSource)
	m.Delete("/api/datasources/:id", auth, DeleteDataSource)

	// system admin
	m.Get("/admin", auth, Index)

	// data source proxy
	m.Any("/api/datasources/proxy/:id/*", auth, ProxyDataSourceRequest)

	// user register
	m.Get("/register", Index)
	m.Post("/api/account", CreateAccount)

	// dashboards
	m.Get("/dashboard/*", auth, Index)
	m.Get("/api/dashboards/:slug", auth, GetDashboard)
	m.Get("/api/search/", auth, Search)
	m.Post("/api/dashboard/", auth, PostDashboard)
	m.Delete("/api/dashboard/:slug", auth, DeleteDashboard)

	// rendering
	m.Get("/render/*", auth, RenderToPng)

	// metrics
	m.Get("/api/metrics/test", auth, GetTestMetrics)

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
	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(404, "index")
}
