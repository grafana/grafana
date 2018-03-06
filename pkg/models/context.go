package models

import (
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
)

type Context struct {
	*macaron.Context
	*SignedInUser

	Session session.SessionStore

	IsSignedIn     bool
	IsRenderCall   bool
	AllowAnonymous bool
	Logger         log.Logger
}

// Handle handles and logs error by given status.
func (ctx *Context) Handle(status int, title string, err error) {
	if err != nil {
		ctx.Logger.Error(title, "error", err)
		if setting.Env != setting.PROD {
			ctx.Data["ErrorMsg"] = err
		}
	}

	ctx.Data["Title"] = title
	ctx.Data["AppSubUrl"] = setting.AppSubUrl
	ctx.Data["Theme"] = "dark"

	ctx.HTML(status, "error")
}

func (ctx *Context) JsonOK(message string) {
	resp := make(map[string]interface{})
	resp["message"] = message
	ctx.JSON(200, resp)
}

func (ctx *Context) IsApiRequest() bool {
	return strings.HasPrefix(ctx.Req.URL.Path, "/api")
}

func (ctx *Context) JsonApiErr(status int, message string, err error) {
	resp := make(map[string]interface{})

	if err != nil {
		ctx.Logger.Error(message, "error", err)
		if setting.Env != setting.PROD {
			resp["error"] = err.Error()
		}
	}

	switch status {
	case 404:
		resp["message"] = "Not Found"
	case 500:
		resp["message"] = "Internal Server Error"
	}

	if message != "" {
		resp["message"] = message
	}

	ctx.JSON(status, resp)
}

func (ctx *Context) HasUserRole(role RoleType) bool {
	return ctx.OrgRole.Includes(role)
}

func (ctx *Context) HasHelpFlag(flag HelpFlags1) bool {
	return ctx.HelpFlags1.HasFlag(flag)
}

func (ctx *Context) TimeRequest(timer prometheus.Summary) {
	ctx.Data["perfmon.timer"] = timer
}
