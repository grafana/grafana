package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"

	apiprometheus "github.com/grafana/grafana/pkg/services/ngalert/api/prometheus"
)

type PrometheusApiHandler struct {
	ProxySvc        *LotexProm
	GrafanaSvc      *apiprometheus.PrometheusSrv
	DatasourceCache datasources.CacheService
}

// NewForkingProm implements a set of routes that proxy to various Prometheus-compatible backends.
func NewForkingProm(datasourceCache datasources.CacheService, proxy *LotexProm, grafana *apiprometheus.PrometheusSrv) *PrometheusApiHandler {
	return &PrometheusApiHandler{
		ProxySvc:        proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *PrometheusApiHandler) handleRouteGetAlertStatuses(ctx *contextmodel.ReqContext, dsUID string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetAlertStatuses(ctx)
}

func (f *PrometheusApiHandler) handleRouteGetRuleStatuses(ctx *contextmodel.ReqContext, dsUID string) response.Response {
	t, err := f.getService(ctx)
	if err != nil {
		return errorToResponse(err)
	}
	return t.RouteGetRuleStatuses(ctx)
}

func (f *PrometheusApiHandler) handleRouteGetGrafanaAlertStatuses(ctx *contextmodel.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAlertStatuses(ctx)
}

func (f *PrometheusApiHandler) handleRouteGetGrafanaRuleStatuses(ctx *contextmodel.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetRuleStatuses(ctx)
}

func (f *PrometheusApiHandler) getService(ctx *contextmodel.ReqContext) (*LotexProm, error) {
	_, err := getDatasourceByUID(ctx, f.DatasourceCache, apimodels.LoTexRulerBackend)
	if err != nil {
		return nil, err
	}
	return f.ProxySvc, nil
}
