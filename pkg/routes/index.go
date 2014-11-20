package routes

import (
	"github.com/Unknwon/macaron"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/routes/api"
	"github.com/torkelo/grafana-pro/pkg/routes/apimodel"
	"github.com/torkelo/grafana-pro/pkg/routes/login"
)

func Register(m *macaron.Macaron) {
	auth := middleware.Auth()

	// index
	m.Get("/", auth, Index)
	m.Post("/logout", login.LogoutPost)
	m.Post("/login", login.LoginPost)

	// login
	m.Get("/login", Index)
	m.Get("/login/:name", login.OAuthLogin)

	// user register
	m.Get("/register/*_", Index)
	m.Post("/api/account", api.CreateAccount)

	// dashboards
	m.Get("/dashboard/*", auth, Index)
	m.Get("/api/dashboards/:slug", auth, api.GetDashboard)
	m.Get("/api/search/", auth, api.Search)
	m.Post("/api/dashboard/", auth, api.PostDashboard)
	m.Delete("/api/dashboard/:slug", auth, api.DeleteDashboard)

	// rendering
	m.Get("/render/*", auth, api.RenderToPng)
}

func Index(ctx *middleware.Context) {
	ctx.Data["User"] = apimodel.NewCurrentUserDto(ctx.UserAccount)
	ctx.HTML(200, "index")
}

func NotFound(ctx *middleware.Context) {
	ctx.Handle(404, "index", nil)
}
