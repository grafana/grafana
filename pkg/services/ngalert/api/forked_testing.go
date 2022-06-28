package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedTestingApi always forwards requests to grafana backend
type ForkedTestingApi struct {
	svc *TestingApiSrv
}

// NewForkedTestingApi creates a new ForkedTestingApi instance
func NewForkedTestingApi(svc *TestingApiSrv) *ForkedTestingApi {
	return &ForkedTestingApi{
		svc: svc,
	}
}

func (f *ForkedTestingApi) forkRouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload, dsUID string) response.Response {
	return f.svc.RouteTestRuleConfig(c, body, dsUID)
}

func (f *ForkedTestingApi) forkRouteTestRuleGrafanaConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	return f.svc.RouteTestGrafanaRuleConfig(c, body)
}

func (f *ForkedTestingApi) forkRouteEvalQueries(c *models.ReqContext, body apimodels.EvalQueriesPayload) response.Response {
	return f.svc.RouteEvalQueries(c, body)
}
