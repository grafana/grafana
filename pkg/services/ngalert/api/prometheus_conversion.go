package api

import (
	"encoding/json"
	"io"
	"mime"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var errorUnsupportedMediaType = errutil.UnsupportedMediaType("alerting.unsupportedMediaType")

// parseJSONOrYAML unmarshals body into target based on content-type, defaulting to YAML
func parseJSONOrYAML(ctx *contextmodel.ReqContext, target interface{}) error {
	var m string

	body, err := io.ReadAll(ctx.Req.Body)
	if err != nil {
		return err
	}
	defer func() { _ = ctx.Req.Body.Close() }()

	contentType := ctx.Req.Header.Get("content-type")

	// Parse content-type only if it's not empty,
	// otherwise we'll assume it's yaml
	if contentType != "" {
		m, _, err = mime.ParseMediaType(contentType)
		if err != nil {
			return err
		}
	}

	switch m {
	case "application/yaml", "":
		// mimirtool does not send content-type, so if it's empty, we assume it's yaml
		return yaml.Unmarshal(body, target)
	case "application/json":
		return json.Unmarshal(body, target)
	default:
		return errorUnsupportedMediaType.Errorf("unsupported media type: %s, only application/yaml and application/json are supported", m)
	}
}

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
	var promGroup apimodels.PrometheusRuleGroup
	if err := parseJSONOrYAML(ctx, &promGroup); err != nil {
		return errorToResponse(err)
	}

	return f.svc.RouteConvertPrometheusPostRuleGroup(ctx, namespaceTitle, promGroup)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusPostRuleGroups(ctx *contextmodel.ReqContext) response.Response {
	var promNamespaces map[string][]apimodels.PrometheusRuleGroup
	if err := parseJSONOrYAML(ctx, &promNamespaces); err != nil {
		return errorToResponse(err)
	}

	return f.svc.RouteConvertPrometheusPostRuleGroups(ctx, promNamespaces)
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

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusCortexPostRuleGroups(ctx *contextmodel.ReqContext) response.Response {
	return f.handleRouteConvertPrometheusPostRuleGroups(ctx)
}

// alertmanager
func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusPostAlertmanagerConfig(ctx *contextmodel.ReqContext) response.Response {
	var config apimodels.AlertmanagerUserConfig
	if err := parseJSONOrYAML(ctx, &config); err != nil {
		return errorToResponse(err)
	}

	return f.svc.RouteConvertPrometheusPostAlertmanagerConfig(ctx, config)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusGetAlertmanagerConfig(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteConvertPrometheusGetAlertmanagerConfig(ctx)
}

func (f *ConvertPrometheusApiHandler) handleRouteConvertPrometheusDeleteAlertmanagerConfig(ctx *contextmodel.ReqContext) response.Response {
	return f.svc.RouteConvertPrometheusDeleteAlertmanagerConfig(ctx)
}
