package api

import (
	"io"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ConvertPrometheusApiHandler struct {
	svc *ConvertPrometheusSrv
}

func NewConvertPrometheusApi(svc *ConvertPrometheusSrv) *ConvertPrometheusApiHandler {
	return &ConvertPrometheusApiHandler{
		svc: svc,
	}
}

// mimirtool
func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusGetRules(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteConvertPrometheusGetRules(ctx)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusDeleteNamespace(ctx *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return f.svc.RouteConvertPrometheusDeleteNamespace(ctx, namespaceTitle)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusDeleteRuleGroup(ctx *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return f.svc.RouteConvertPrometheusDeleteRuleGroup(ctx, namespaceTitle, group)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusGetNamespace(ctx *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return f.svc.RouteConvertPrometheusGetNamespace(ctx, namespaceTitle)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusGetRuleGroup(ctx *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return f.svc.RouteConvertPrometheusGetRuleGroup(ctx, namespaceTitle, group)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusPostRuleGroup(ctx *contextmodel.ReqContext, namespaceTitle string) response.Response {
	body, err := io.ReadAll(ctx.Req.Body)
	if err != nil {
		return errorToResponse(err)
	}
	defer func() { _ = ctx.Req.Body.Close() }()

	var promGroup apimodels.PrometheusRuleGroup
	if err := yaml.Unmarshal(body, &promGroup); err != nil {
		return errorToResponse(err)
	}

	return f.svc.RouteConvertPrometheusPostRuleGroup(ctx, namespaceTitle, promGroup)
}

// cortextool
func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexGetRules(ctx *contextmodel.ReqContext) response.Response {
	return f.handleRouteConvertPrometheusGetRules(ctx)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexDeleteNamespace(ctx *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return f.handleRouteConvertPrometheusDeleteNamespace(ctx, namespaceTitle)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexDeleteRuleGroup(ctx *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return f.handleRouteConvertPrometheusDeleteRuleGroup(ctx, namespaceTitle, group)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexGetNamespace(ctx *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return f.handleRouteConvertPrometheusGetNamespace(ctx, namespaceTitle)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexGetRuleGroup(ctx *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return f.handleRouteConvertPrometheusGetRuleGroup(ctx, namespaceTitle, group)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexPostRuleGroup(ctx *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return f.handleRouteConvertPrometheusPostRuleGroup(ctx, namespaceTitle)
}
