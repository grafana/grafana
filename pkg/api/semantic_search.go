package api

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/storage/unified/resource/semantic"
)

func (hs *HTTPServer) SemanticSearch(c *contextmodel.ReqContext) response.Response {
	if hs.SemanticSearchService == nil {
		return response.Error(http.StatusNotFound, "Semantic search is not configured", nil)
	}

	var req semantic.SearchRequest
	if err := json.NewDecoder(c.Req.Body).Decode(&req); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	resp, err := hs.SemanticSearchService.Search(c.Req.Context(), req)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Semantic search failed", err)
	}

	return response.JSON(http.StatusOK, resp)
}
