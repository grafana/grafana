package models

import (
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/prometheus/client_golang/prometheus"
)

type ReqContext struct {
	*web.Context
	*user.SignedInUser
	UserToken *usertoken.UserToken

	IsSignedIn     bool
	IsRenderCall   bool
	AllowAnonymous bool
	SkipCache      bool
	Logger         log.Logger
	// RequestNonce is a cryptographic request identifier for use with Content Security Policy.
	RequestNonce          string
	IsPublicDashboardView bool

	PerfmonTimer   prometheus.Summary
	LookupTokenErr error
}

// Handle handles and logs error by given status.
func (ctx *ReqContext) Handle(cfg *setting.Cfg, status int, title string, err error) {
	data := struct {
		Title     string
		AppTitle  string
		AppSubUrl string
		Theme     string
		ErrorMsg  error
	}{title, "Grafana", cfg.AppSubURL, "dark", nil}
	if err != nil {
		ctx.Logger.Error(title, "error", err)
		if setting.Env != setting.Prod {
			data.ErrorMsg = err
		}
	}

	ctx.HTML(status, cfg.ErrTemplateName, data)
}

func (ctx *ReqContext) IsApiRequest() bool {
	return strings.HasPrefix(ctx.Req.URL.Path, "/api")
}

func (ctx *ReqContext) JsonApiErr(status int, message string, err error) {
	resp := make(map[string]interface{})
	traceID := tracing.TraceIDFromContext(ctx.Req.Context(), false)

	if err != nil {
		resp["traceID"] = traceID
		ctx.Logger.Error(message, "error", err, "traceID", traceID)
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

func (ctx *ReqContext) HasUserRole(role org.RoleType) bool {
	return ctx.OrgRole.Includes(role)
}

func (ctx *ReqContext) HasHelpFlag(flag user.HelpFlags1) bool {
	return ctx.HelpFlags1.HasFlag(flag)
}

func (ctx *ReqContext) TimeRequest(timer prometheus.Summary) {
	ctx.PerfmonTimer = timer
}

// QueryBoolWithDefault extracts a value from the request query params and applies a bool default if not present.
func (ctx *ReqContext) QueryBoolWithDefault(field string, d bool) bool {
	f := ctx.Query(field)
	if f == "" {
		return d
	}

	return ctx.QueryBool(field)
}
