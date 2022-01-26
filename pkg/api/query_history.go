package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func ValidateQueryHistoryEnabled(c *models.ReqContext) {
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
