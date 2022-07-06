package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TestingApi always forwards requests to grafana backend
type TestingApi struct {
	svc *TestingApiSrv
}

func NewTestingApi(svc *TestingApiSrv) *TestingApi {
	return &TestingApi{
		svc: svc,
	}
}

func (f *TestingApi) handleRouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload, dsUID string) response.Response {
	return f.svc.RouteTestRuleConfig(c, body, dsUID)
}

func (f *TestingApi) handleRouteTestRuleGrafanaConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	return f.svc.RouteTestGrafanaRuleConfig(c, body)
}

func (f *TestingApi) handleRouteEvalQueries(c *models.ReqContext, body apimodels.EvalQueriesPayload) response.Response {
	return f.svc.RouteEvalQueries(c, body)
}
