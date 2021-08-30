package models

import (
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"gopkg.in/macaron.v1"
)

type ReqContext struct {
	*macaron.Context
	*SignedInUser
	UserToken *UserToken

	IsSignedIn     bool
	IsRenderCall   bool
	AllowAnonymous bool
	SkipCache      bool
	Logger         log.Logger
	// RequestNonce is a cryptographic request identifier for use with Content Security Policy.
	RequestNonce string
}

// Handle handles and logs error by given status.
func (ctx *ReqContext) Handle(cfg *setting.Cfg, status int, title string, err error) {
	if err != nil {
		ctx.Logger.Error(title, "error", err)
		if setting.Env != setting.Prod {
			ctx.Data["ErrorMsg"] = err
		}
	}

	ctx.Data["Title"] = title
	ctx.Data["AppSubUrl"] = cfg.AppSubURL
	ctx.Data["Theme"] = "dark"

	ctx.HTML(status, cfg.ErrTemplateName, ctx.Data)
}

func (ctx *ReqContext) IsApiRequest() bool {
	return strings.HasPrefix(ctx.Req.URL.Path, "/api")
}

func (ctx *ReqContext) JsonApiErr(status int, message string, err error) {
	resp := make(map[string]interface{})

	if err != nil {
		ctx.Logger.Error(message, "error", err)
		if setting.Env != setting.Prod {
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

func (ctx *ReqContext) HasUserRole(role RoleType) bool {
	return ctx.OrgRole.Includes(role)
}

func (ctx *ReqContext) HasHelpFlag(flag HelpFlags1) bool {
	return ctx.HelpFlags1.HasFlag(flag)
}

func (ctx *ReqContext) TimeRequest(timer prometheus.Summary) {
	ctx.Data["perfmon.timer"] = timer
}

// QueryBoolWithDefault extracts a value from the request query params and applies a bool default if not present.
func (ctx *ReqContext) QueryBoolWithDefault(field string, d bool) bool {
	f := ctx.Query(field)
	if f == "" {
		return d
	}

	return ctx.QueryBool(field)
}
