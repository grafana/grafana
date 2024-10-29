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
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.generalLabelSuggestionHandler))
		entities.Get("/user", middleware.ReqSignedIn, routing.Wrap(s.userLabelSuggestionHandler))
		entities.Get("/datasource", middleware.ReqSignedIn, routing.Wrap(s.datasourceLabelSuggestionHandler))
	})
}

func (s *LabelSuggestionService) generalLabelSuggestionHandler(c *contextmodel.ReqContext) response.Response {

	result, err := s.getGeneralLabelSuggestion(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query history", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (s *LabelSuggestionService) datasourceLabelSuggestionHandler(c *contextmodel.ReqContext) response.Response {

	datasourceUID := c.QueryStrings("datasourceUid")

	result, err := s.getDatasourceLabelSuggestion(c.Req.Context(), datasourceUID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query history", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (s *LabelSuggestionService) userLabelSuggestionHandler(c *contextmodel.ReqContext) response.Response {

	result, err := s.getUserLabelSuggestion(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query history", err)
	}

	return response.JSON(http.StatusOK, result)
}
