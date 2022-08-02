package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type ForkedPrometheusApi struct {
	ProxySvc        *LotexProm
	GrafanaSvc      *PrometheusSrv
	DatasourceCache datasources.CacheService
}

// NewForkedProm implements a set of routes that proxy to various Prometheus-compatible backends.
func NewForkedProm(datasourceCache datasources.CacheService, proxy *LotexProm, grafana *PrometheusSrv) *ForkedPrometheusApi {
	return &ForkedPrometheusApi{
		ProxySvc:        proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *ForkedPrometheusApi) forkRouteGetAlertStatuses(ctx *models.ReqContext, dsUID string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetAlertStatuses(ctx)
}

func (f *ForkedPrometheusApi) forkRouteGetRuleStatuses(ctx *models.ReqContext, dsUID string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetRuleStatuses(ctx)
}

func (f *ForkedPrometheusApi) forkRouteGetGrafanaAlertStatuses(ctx *models.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAlertStatuses(ctx)
}

func (f *ForkedPrometheusApi) forkRouteGetGrafanaRuleStatuses(ctx *models.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetRuleStatuses(ctx)
}

func (f *ForkedPrometheusApi) getService(ctx *models.ReqContext) (*LotexProm, error) {
	_, err := getDatasourceByUID(ctx, f.DatasourceCache, apimodels.LoTexRulerBackend)
	if err != nil {
		return nil, err
	}
	return f.ProxySvc, nil
}
