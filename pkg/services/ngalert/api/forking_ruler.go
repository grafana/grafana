package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// RulerApiHandler will validate and proxy requests to the correct backend type depending on the datasource.
type RulerApiHandler struct {
	LotexRuler      *LotexRuler
	GrafanaRuler    *RulerSrv
	DatasourceCache datasources.CacheService
}

func NewForkingRuler(datasourceCache datasources.CacheService, lotex *LotexRuler, grafana *RulerSrv) *RulerApiHandler {
	return &RulerApiHandler{
		LotexRuler:      lotex,
		GrafanaRuler:    grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *RulerApiHandler) handleRouteDeleteNamespaceRulesConfig(ctx *model.ReqContext, dsUID, namespace string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteDeleteNamespaceRulesConfig(ctx, namespace)
}

func (f *RulerApiHandler) handleRouteDeleteRuleGroupConfig(ctx *model.ReqContext, dsUID, namespace, group string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteDeleteRuleGroupConfig(ctx, namespace, group)
}

func (f *RulerApiHandler) handleRouteGetNamespaceRulesConfig(ctx *model.ReqContext, dsUID, namespace string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetNamespaceRulesConfig(ctx, namespace)
}

func (f *RulerApiHandler) handleRouteGetRulegGroupConfig(ctx *model.ReqContext, dsUID, namespace, group string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetRulegGroupConfig(ctx, namespace, group)
}

func (f *RulerApiHandler) handleRouteGetRulesConfig(ctx *model.ReqContext, dsUID string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetRulesConfig(ctx)
}

func (f *RulerApiHandler) handleRoutePostNameRulesConfig(ctx *model.ReqContext, conf apimodels.PostableRuleGroupConfig, dsUID, namespace string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	if conf.Type() != apimodels.LoTexRulerBackend {
		return errorToResponse(backendTypeDoesNotMatchPayloadTypeError(apimodels.LoTexRulerBackend, conf.Type().String()))
	}
	return t.RoutePostNameRulesConfig(ctx, conf, namespace)
}

func (f *RulerApiHandler) handleRouteDeleteNamespaceGrafanaRulesConfig(ctx *model.ReqContext, namespace string) response.Response {
	return f.GrafanaRuler.RouteDeleteAlertRules(ctx, namespace, "")
}

func (f *RulerApiHandler) handleRouteDeleteGrafanaRuleGroupConfig(ctx *model.ReqContext, namespace, groupName string) response.Response {
	return f.GrafanaRuler.RouteDeleteAlertRules(ctx, namespace, groupName)
}

func (f *RulerApiHandler) handleRouteGetNamespaceGrafanaRulesConfig(ctx *model.ReqContext, namespace string) response.Response {
	return f.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx, namespace)
}

func (f *RulerApiHandler) handleRouteGetGrafanaRuleGroupConfig(ctx *model.ReqContext, namespace, group string) response.Response {
	return f.GrafanaRuler.RouteGetRulesGroupConfig(ctx, namespace, group)
}

func (f *RulerApiHandler) handleRouteGetGrafanaRulesConfig(ctx *model.ReqContext) response.Response {
	return f.GrafanaRuler.RouteGetRulesConfig(ctx)
}

func (f *RulerApiHandler) handleRoutePostNameGrafanaRulesConfig(ctx *model.ReqContext, conf apimodels.PostableRuleGroupConfig, namespace string) response.Response {
	payloadType := conf.Type()
	if payloadType != apimodels.GrafanaBackend {
		return errorToResponse(backendTypeDoesNotMatchPayloadTypeError(apimodels.GrafanaBackend, conf.Type().String()))
	}
	return f.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf, namespace)
}

func (f *RulerApiHandler) getService(ctx *model.ReqContext) (*LotexRuler, error) {
	_, err := getDatasourceByUID(ctx, f.DatasourceCache, apimodels.LoTexRulerBackend)
	if err != nil {
		return nil, err
	}
	return f.LotexRuler, nil
}
