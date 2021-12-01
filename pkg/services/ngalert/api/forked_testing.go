package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedTestingApi always forwards requests to grafana backend
type ForkedTestingApi struct {
	grafana TestingApiService
}

// NewForkedTestingApi creates a new ForkedTestingApi instance
func NewForkedTestingApi(grafana TestingApiService) *ForkedTestingApi {
	return &ForkedTestingApi{
		grafana: grafana,
	}
}

func (f *ForkedTestingApi) forkRouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	return f.grafana.RouteTestRuleConfig(c, body)
}

func (f *ForkedTestingApi) forkRouteEvalQueries(c *models.ReqContext, body apimodels.EvalQueriesPayload) response.Response {
	return f.grafana.RouteEvalQueries(c, body)
}
