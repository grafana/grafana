package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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

func (f *TestingApiHandler) handleRouteTestRuleConfig(c *contextmodel.ReqContext, body apimodels.TestRulePayload, dsUID string) response.Response {
	return f.svc.RouteTestRuleConfig(c, body, dsUID)
}

func (f *TestingApiHandler) handleRouteTestRuleGrafanaConfig(c *contextmodel.ReqContext, body apimodels.PostableExtendedRuleNodeExtended) response.Response {
	return f.svc.RouteTestGrafanaRuleConfig(c, body)
}

func (f *TestingApiHandler) handleRouteEvalQueries(c *contextmodel.ReqContext, body apimodels.EvalQueriesPayload) response.Response {
	return f.svc.RouteEvalQueries(c, body)
}

func (f *TestingApiHandler) handleBacktestConfig(ctx *contextmodel.ReqContext, conf apimodels.BacktestConfig) response.Response {
	return f.svc.BacktestAlertRule(ctx, conf)
}
