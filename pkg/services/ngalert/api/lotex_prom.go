package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type promEndpoints struct {
	rules, alerts string
}

var dsTypeToLotexRoutes = map[string]promEndpoints{
	"prometheus": {
		rules:  "/api/v1/rules",
		alerts: "/api/v1/alerts",
	},
	"loki": {
		rules:  "/prometheus/api/v1/rules",
		alerts: "/prometheus/api/v1/alerts",
	},
}

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

func (p *LotexProm) RouteGetAlertStatuses(ctx *models.ReqContext) response.Response {
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

func (p *LotexProm) RouteGetRuleStatuses(ctx *models.ReqContext) response.Response {
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

func (p *LotexProm) getEndpoints(ctx *models.ReqContext) (*promEndpoints, error) {
	ds, err := p.DataProxy.DataSourceCache.GetDatasource(ctx.ParamsInt64(":Recipient"), ctx.SignedInUser, ctx.SkipCache)
	if err != nil {
		return nil, err
	}

	if ds.Url == "" {
		return nil, fmt.Errorf("URL for this data source is empty")
	}

	routes, ok := dsTypeToLotexRoutes[ds.Type]
	if !ok {
		return nil, fmt.Errorf("unexpected datasource type. expecting loki or prometheus")
	}
	return &routes, nil
}
