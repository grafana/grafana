package routes

import (
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/routes/apimodel"
)

func Index(ctx *middleware.Context) {
	ctx.Data["User"] = apimodel.NewCurrentUserDto(ctx.UserAccount)
	ctx.HTML(200, "index")
}

func NotFound(ctx *middleware.Context) {
	ctx.Handle(404, "index", nil)
}
