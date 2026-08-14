package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
)

type promEndpoints struct {
	rules, alerts string
}

var (
	prometheusEndpoints = promEndpoints{
		rules:  "/api/v1/rules",
		alerts: "/api/v1/alerts",
	}
	lokiEndpoints = promEndpoints{
		rules:  "/prometheus/api/v1/rules",
		alerts: "/prometheus/api/v1/alerts",
	}
)

type LotexProm struct {
	log log.Logger
	*AlertingProxy
}

func NewLotexProm(proxy *AlertingProxy, log log.Logger) *LotexProm {
	return &LotexProm{
		log:           log,
		AlertingProxy: proxy,
	}
}

func (p *LotexProm) RouteGetAlertStatuses(ctx *contextmodel.ReqContext) response.Response {
	endpoints, err := p.getEndpoints(ctx)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return p.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			endpoints.alerts,
		),
		nil,
		jsonExtractor(&apimodels.AlertResponse{}),
		nil,
	)
}

func (p *LotexProm) RouteGetRuleStatuses(ctx *contextmodel.ReqContext) response.Response {
	endpoints, err := p.getEndpoints(ctx)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return p.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			endpoints.rules,
		),
		nil,
		jsonExtractor(&apimodels.RuleResponse{}),
		nil,
	)
}

func (p *LotexProm) getEndpoints(ctx *contextmodel.ReqContext) (*promEndpoints, error) {
	datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
	if datasourceUID == "" {
		return nil, fmt.Errorf("datasource UID is invalid")
	}

	ds, err := p.DataProxy.DataSourceCache.GetDatasourceByUID(ctx.Req.Context(), datasourceUID, ctx.SignedInUser, ctx.SkipDSCache)
	if err != nil {
		return nil, err
	}

	if ds.URL == "" {
		return nil, fmt.Errorf("URL for this data source is empty")
	}

	var routes promEndpoints
	switch {
	case isPrometheusCompatible(ds.Type):
		routes = prometheusEndpoints
	case ds.Type == datasources.DS_LOKI:
		routes = lokiEndpoints
	default:
		return nil, unexpectedDatasourceTypeError(ds.Type, "loki, prometheus, amazon prometheus, azure prometheus")
	}

	return &routes, nil
}
