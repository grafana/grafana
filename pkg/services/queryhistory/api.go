package queryhistory

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (s *QueryHistoryService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/query-history", func(entities routing.RouteRegister) {
		entities.Post("/", middleware.ReqSignedIn, routing.Wrap(s.createHandler))
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.searchHandler))
		entities.Delete("/:uid", middleware.ReqSignedIn, routing.Wrap(s.deleteHandler))
		entities.Post("/star/:uid", middleware.ReqSignedIn, routing.Wrap(s.starHandler))
		entities.Delete("/star/:uid", middleware.ReqSignedIn, routing.Wrap(s.unstarHandler))
		entities.Patch("/:uid", middleware.ReqSignedIn, routing.Wrap(s.patchCommentHandler))
		// Remove migrate endpoint in Grafana v10 as breaking change
		entities.Post("/migrate", middleware.ReqSignedIn, routing.Wrap(s.migrateHandler))
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

func (s *QueryHistoryService) searchHandler(c *models.ReqContext) response.Response {
	timeRange := legacydata.NewDataTimeRange(c.Query("from"), c.Query("to"))

	query := SearchInQueryHistoryQuery{
		DatasourceUIDs: c.QueryStrings("datasourceUid"),
		SearchString:   c.Query("searchString"),
		OnlyStarred:    c.QueryBoolWithDefault("onlyStarred", false),
		Sort:           c.Query("sort"),
		Page:           c.QueryInt("page"),
		Limit:          c.QueryInt("limit"),
		From:           timeRange.GetFromAsSecondsEpoch(),
		To:             timeRange.GetToAsSecondsEpoch(),
	}

	result, err := s.SearchInQueryHistory(c.Req.Context(), c.SignedInUser, query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistorySearchResponse{Result: result})
}

func (s *QueryHistoryService) deleteHandler(c *models.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
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
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
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

func (s *QueryHistoryService) starHandler(c *models.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	query, err := s.StarQueryInQueryHistory(c.Req.Context(), c.SignedInUser, queryUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to star query in query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

func (s *QueryHistoryService) unstarHandler(c *models.ReqContext) response.Response {
	queryUID := web.Params(c.Req)[":uid"]
	if len(queryUID) > 0 && !util.IsValidShortUID(queryUID) {
		return response.Error(http.StatusNotFound, "Query in query history not found", nil)
	}

	query, err := s.UnstarQueryInQueryHistory(c.Req.Context(), c.SignedInUser, queryUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to unstar query in query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryResponse{Result: query})
}

func (s *QueryHistoryService) migrateHandler(c *models.ReqContext) response.Response {
	cmd := MigrateQueriesToQueryHistoryCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	totalCount, starredCount, err := s.MigrateQueriesToQueryHistory(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to migrate query history", err)
	}

	return response.JSON(http.StatusOK, QueryHistoryMigrationResponse{Message: "Query history successfully migrated", TotalCount: totalCount, StarredCount: starredCount})
}
