package api

import (
	"net/http"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

const (
	promRulesPath  = "/prometheus/api/v1/rules"
	promAlertsPath = "/prometheus/api/v1/alerts"
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

func (p *LotexProm) RouteGetAlertStatuses(ctx *models.ReqContext) response.Response {
	return p.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				promAlertsPath,
			),
		},
		jsonExtractor(&apimodels.AlertResponse{}),
	)
}

func (p *LotexProm) RouteGetRuleStatuses(ctx *models.ReqContext) response.Response {
	return p.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				promRulesPath,
			),
		},
		jsonExtractor(&apimodels.RuleResponse{}),
	)
}
