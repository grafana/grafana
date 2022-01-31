package queryhistory

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (s *QueryHistoryService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/query-history", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(s.createHandler))
	})
}

func (s *QueryHistoryService) createHandler(c *models.ReqContext) response.Response {
	cmd := CreateQueryInQueryHistoryCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	err := s.CreateQueryInQueryHistory(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return response.Error(500, "Failed to create query history", err)
	}

	return response.Success("Query successfully added to query history")
}
