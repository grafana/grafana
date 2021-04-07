package api

import (
	"fmt"
	"net/http"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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
		return response.Error(500, err.Error(), nil)
	}

	return p.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				endpoints.alerts,
			),
		},
		jsonExtractor(&apimodels.AlertResponse{}),
	)
}

func (p *LotexProm) RouteGetRuleStatuses(ctx *models.ReqContext) response.Response {
	endpoints, err := p.getEndpoints(ctx)
	if err != nil {
		return response.Error(500, err.Error(), nil)
	}

	return p.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				endpoints.rules,
			),
		},
		jsonExtractor(&apimodels.RuleResponse{}),
	)
}

func (p *LotexProm) getEndpoints(ctx *models.ReqContext) (*promEndpoints, error) {
	ds, err := p.DataProxy.DatasourceCache.GetDatasource(ctx.ParamsInt64("Recipient"), ctx.SignedInUser, ctx.SkipCache)
	if err != nil {
		return nil, err
	}
	routes, ok := dsTypeToLotexRoutes[ds.Type]
	if !ok {
		return nil, fmt.Errorf("unexpected datasource type. expecting loki or prometheus")
	}
	return &routes, nil
}
