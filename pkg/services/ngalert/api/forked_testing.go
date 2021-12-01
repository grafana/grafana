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

func (srv *ForkedTestingApi) forkRouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	return srv.grafana.RouteTestRuleConfig(c, body)
}

func (srv *ForkedTestingApi) forkRouteEvalQueries(c *models.ReqContext, body apimodels.EvalQueriesPayload) response.Response {
	return srv.grafana.RouteEvalQueries(c, body)
}
