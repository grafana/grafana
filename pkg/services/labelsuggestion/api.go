package labelsuggestion

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (s *LabelSuggestionService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/suggest-labels", func(entities routing.RouteRegister) {
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.labelSuggestionHandler))
	})
}

func (s *LabelSuggestionService) labelSuggestionHandler(c *contextmodel.ReqContext) response.Response {

	datasourceUID := c.Query("datasourceUid")

	result, err := s.GetLabelSuggestion(c.Req.Context(), c.SignedInUser, datasourceUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query history", err)
	}

	return response.JSON(http.StatusOK, result)
}
