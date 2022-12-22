package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TestingApiHandler always forwards requests to grafana backend
type TestingApiHandler struct {
	svc *TestingApiSrv
}

func NewTestingApi(svc *TestingApiSrv) *TestingApiHandler {
	return &TestingApiHandler{
		svc: svc,
	}
}

func (f *TestingApiHandler) handleRouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload, dsUID string) response.Response {
	return f.svc.RouteTestRuleConfig(c, body, dsUID)
}

func (f *TestingApiHandler) handleRouteTestRuleGrafanaConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	return f.svc.RouteTestGrafanaRuleConfig(c, body)
}

func (f *TestingApiHandler) handleRouteEvalQueries(c *models.ReqContext, body apimodels.EvalQueriesPayload) response.Response {
	return f.svc.RouteEvalQueries(c, body)
}

func (f *TestingApiHandler) handleBacktestingConfig(ctx *models.ReqContext, conf apimodels.BacktestConfig) response.Response {
	return f.svc.BacktestAlertRule(ctx, conf)
}
