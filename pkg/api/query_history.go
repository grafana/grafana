package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func ValidateQueryHistoryEnabled(c *models.ReqContext) {
	fmt.Println(setting.QueryHistoryMaxAge)
	if !setting.QueryHistoryEnabled {
		c.JsonApiErr(http.StatusBadRequest, "query history is not enabled", nil)
	}
}

func (hs *HTTPServer) addToQueryHistory(c *models.ReqContext) response.Response {
	cmd := dtos.AddToQueryHistoryCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	hs.log.Debug("Received request to add query to query history", "query", cmd.Queries, "datasource", cmd.DatasourceUid)

	_, err := hs.QueryHistoryService.AddToQueryHistory(c.Req.Context(), c.SignedInUser, cmd.Queries, cmd.DatasourceUid)
	if err != nil {
		return response.Error(500, "Failed to create query history", err)
	}

	return response.Success("Query successfully added to query history")
}

func (hs *HTTPServer) searchInQueryHistory(c *models.ReqContext) response.Response {
	page := c.QueryInt("page")
	if page <= 0 {
		page = 1
	}

	sort := c.Query("sort")
	if sort == "" {
		sort = "time-desc"
	}

	query := models.QueryHistorySearch{
		DatasourceUids: c.QueryStrings("datasourceUids"),
		SearchString:   c.Query("searchString"),
		OnlyStarred:    c.QueryBoolWithDefault("onlyStarred", false),
		Sort:           sort,
		Page:           page,
		Limit:          100,
	}

	queryHistory, err := hs.QueryHistoryService.ListQueryHistory(c.Req.Context(), c.SignedInUser, &query)
	if err != nil {
		return response.Error(500, "Failed to get query history", err)
	}

	return response.JSON(200, queryHistory)
}

func (hs *HTTPServer) deleteQueryFromQueryHistory(c *models.ReqContext) response.Response {
	queryUid := web.Params(c.Req)[":uid"]

	err := hs.QueryHistoryService.DeleteQuery(c.Req.Context(), c.SignedInUser, queryUid)
	if err != nil {
		return response.Error(500, "Failed to delete query from history", err)
	}

	return response.Success("Query successfully deleted from query history")
}

func (hs *HTTPServer) updateQueryInQueryHistory(c *models.ReqContext) response.Response {
	cmd := dtos.UpdateQueryInQueryHistoryCmd{}
	queryUid := web.Params(c.Req)[":uid"]

	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	query, err := hs.QueryHistoryService.GetQueryByUid(c.Req.Context(), c.SignedInUser, queryUid)
	err = hs.QueryHistoryService.UpdateComment(c.Req.Context(), c.SignedInUser, query, cmd.Comment)
	if err != nil {
		return response.Error(500, "Failed to update comment in query history", err)
	}

	return response.Success("Query comment successfully updated in query history")
}

func (hs *HTTPServer) starQueryInQueryHistory(c *models.ReqContext) response.Response {
	queryUid := web.Params(c.Req)[":uid"]

	err := hs.QueryHistoryService.StarQuery(c.Req.Context(), c.SignedInUser, queryUid)
	if err != nil {
		return response.Error(500, "Failed to star query in query history", err)
	}

	return response.Success("Query successfully starred")
}

func (hs *HTTPServer) unstarQueryInQueryHistory(c *models.ReqContext) response.Response {
	queryUid := web.Params(c.Req)[":uid"]

	err := hs.QueryHistoryService.UnstarQuery(c.Req.Context(), c.SignedInUser, queryUid)
	if err != nil {
		return response.Error(500, "Failed to unstar query in query history", err)
	}

	return response.Success("Query successfully unstarred")
}
