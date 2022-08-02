package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type PrometheusApiHandler struct {
	ProxySvc        *LotexProm
	GrafanaSvc      *PrometheusSrv
	DatasourceCache datasources.CacheService
}

// NewForkingProm implements a set of routes that proxy to various Prometheus-compatible backends.
func NewForkingProm(datasourceCache datasources.CacheService, proxy *LotexProm, grafana *PrometheusSrv) *PrometheusApiHandler {
	return &PrometheusApiHandler{
		ProxySvc:        proxy,
		GrafanaSvc:      grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *PrometheusApiHandler) handleRouteGetAlertStatuses(ctx *models.ReqContext, dsUID string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}

	switch t {
	case apimodels.LoTexRulerBackend:
		return f.ProxySvc.RouteGetAlertStatuses(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *PrometheusApiHandler) handleRouteGetRuleStatuses(ctx *models.ReqContext, dsUID string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}

	switch t {
	case apimodels.LoTexRulerBackend:
		return f.ProxySvc.RouteGetRuleStatuses(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *PrometheusApiHandler) handleRouteGetGrafanaAlertStatuses(ctx *models.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetAlertStatuses(ctx)
}

func (f *PrometheusApiHandler) handleRouteGetGrafanaRuleStatuses(ctx *models.ReqContext) response.Response {
	return f.GrafanaSvc.RouteGetRuleStatuses(ctx)
}
