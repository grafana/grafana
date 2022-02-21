package queryhistory

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (s *QueryHistoryService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/query-history", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(s.createHandler))
		entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(s.deleteHandler))
		entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(s.patchCommentHandler))
	})
}

func (s *QueryHistoryService) createHandler(c *models.ReqContext) response.Response {
	cmd := CreateQueryInQueryHistoryCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	query, err := s.CreateQueryInQueryHistory(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

func (s *QueryHistoryService) deleteHandler(c *models.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	id, err := s.DeleteQueryFromQueryHistory(c.Req.Context(), c.SignedInUser, queryUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete query from query history", err)
	}

	return response.JSON(http.StatusOK, DeleteQueryFromQueryHistoryResponse{
		Message: "Query deleted",
		ID:      id,
	})
}

func (s *QueryHistoryService) patchCommentHandler(c *models.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	cmd := PatchQueryCommentInQueryHistoryCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	query, err := s.PatchQueryCommentInQueryHistory(c.Req.Context(), c.SignedInUser, queryUID, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update comment of query in query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}
