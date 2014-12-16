package api

import (
	"github.com/Unknwon/macaron"
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/middleware"
)

func Register(m *macaron.Macaron) {
	auth := middleware.Auth()

	// index
	m.Get("/", auth, Index)
	m.Post("/logout", LogoutPost)
	m.Post("/login", LoginPost)

	// login
	m.Get("/login", Index)
	m.Get("/login/:name", OAuthLogin)

	// account
	m.Get("/account/", auth, Index)
	m.Get("/api/account/", auth, GetAccount)
	m.Post("/api/account/collaborators/add", auth, AddCollaborator)
	m.Post("/api/account/using/:id", auth, SetUsingAccount)
	m.Get("/api/account/others", auth, GetOtherAccounts)

	// datasources
	m.Get("/admin/datasources/", auth, Index)
	m.Get("/api/admin/datasource/list", auth, GetDataSources)
	m.Post("/api/admin/datasource/add", auth, AddDataSource)

	// user register
	m.Get("/register/*_", Index)
	m.Post("/api/account", CreateAccount)

	// dashboards
	m.Get("/dashboard/*", auth, Index)
	m.Get("/api/dashboards/:slug", auth, GetDashboard)
	m.Get("/api/search/", auth, Search)
	m.Post("/api/dashboard/", auth, PostDashboard)
	m.Delete("/api/dashboard/:slug", auth, DeleteDashboard)

	// rendering
	m.Get("/render/*", auth, RenderToPng)
}

func Index(ctx *middleware.Context) {
	ctx.Data["User"] = dtos.NewCurrentUser(ctx.UserAccount)
	ctx.HTML(200, "index")
}

func NotFound(ctx *middleware.Context) {
	ctx.Handle(404, "index", nil)
}
