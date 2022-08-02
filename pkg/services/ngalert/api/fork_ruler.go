package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedRulerApi will validate and proxy requests to the correct backend type depending on the datasource.
type ForkedRulerApi struct {
	LotexRuler      *LotexRuler
	GrafanaRuler    *RulerSrv
	DatasourceCache datasources.CacheService
}

// NewForkedRuler implements a set of routes that proxy to various Cortex Ruler-compatible backends.
func NewForkedRuler(datasourceCache datasources.CacheService, lotex *LotexRuler, grafana *RulerSrv) *ForkedRulerApi {
	return &ForkedRulerApi{
		LotexRuler:      lotex,
		GrafanaRuler:    grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *ForkedRulerApi) forkRouteDeleteNamespaceRulesConfig(ctx *models.ReqContext, dsUID, namespace string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteDeleteNamespaceRulesConfig(ctx, namespace)
}

func (f *ForkedRulerApi) forkRouteDeleteRuleGroupConfig(ctx *models.ReqContext, dsUID, namespace, group string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteDeleteRuleGroupConfig(ctx, namespace, group)
}

func (f *ForkedRulerApi) forkRouteGetNamespaceRulesConfig(ctx *models.ReqContext, dsUID, namespace string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetNamespaceRulesConfig(ctx, namespace)
}

func (f *ForkedRulerApi) forkRouteGetRulegGroupConfig(ctx *models.ReqContext, dsUID, namespace, group string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetRulegGroupConfig(ctx, namespace, group)
}

func (f *ForkedRulerApi) forkRouteGetRulesConfig(ctx *models.ReqContext, dsUID string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetRulesConfig(ctx)
}

func (f *ForkedRulerApi) forkRoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig, dsUID, namespace string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	if conf.Type() != apimodels.LoTexRulerBackend {
		return errorToResponse(backendTypeDoesNotMatchPayloadTypeError(apimodels.LoTexRulerBackend, conf.Type().String()))
	}
	return t.RoutePostNameRulesConfig(ctx, conf, namespace)
}

func (f *ForkedRulerApi) forkRouteDeleteNamespaceGrafanaRulesConfig(ctx *models.ReqContext, namespace string) response.Response {
	return f.GrafanaRuler.RouteDeleteAlertRules(ctx, namespace, "")
}

func (f *ForkedRulerApi) forkRouteDeleteGrafanaRuleGroupConfig(ctx *models.ReqContext, namespace, groupName string) response.Response {
	return f.GrafanaRuler.RouteDeleteAlertRules(ctx, namespace, groupName)
}

func (f *ForkedRulerApi) forkRouteGetNamespaceGrafanaRulesConfig(ctx *models.ReqContext, namespace string) response.Response {
	return f.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx, namespace)
}

func (f *ForkedRulerApi) forkRouteGetGrafanaRuleGroupConfig(ctx *models.ReqContext, namespace, group string) response.Response {
	return f.GrafanaRuler.RouteGetRulesGroupConfig(ctx, namespace, group)
}

func (f *ForkedRulerApi) forkRouteGetGrafanaRulesConfig(ctx *models.ReqContext) response.Response {
	return f.GrafanaRuler.RouteGetRulesConfig(ctx)
}

func (f *ForkedRulerApi) forkRoutePostNameGrafanaRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig, namespace string) response.Response {
	payloadType := conf.Type()
	if payloadType != apimodels.GrafanaBackend {
		return errorToResponse(backendTypeDoesNotMatchPayloadTypeError(apimodels.GrafanaBackend, conf.Type().String()))
	}
	return f.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf, namespace)
}

func (f *ForkedRulerApi) getService(ctx *models.ReqContext) (*LotexRuler, error) {
	_, err := getDatasourceByUID(ctx, f.DatasourceCache, apimodels.LoTexRulerBackend)
	if err != nil {
		return nil, err
	}
	return f.LotexRuler, nil
}
