package routes

import "github.com/torkelo/grafana-pro/pkg/middleware"

func Index(ctx *middleware.Context) {
	ctx.HTML(200, "index")
}

func NotFound(ctx *middleware.Context) {
	ctx.Data["Title"] = "Page Not Found"
	ctx.Handle(404, "index", nil)
}
