package queryrecommend

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (s *QueryRecommendService) registerAPIEndpoints() {
	s.RouteRegister.Group("/api/query-recommend", func(entities routing.RouteRegister) {
		entities.Get("/", middleware.ReqSignedIn, routing.Wrap(s.recommendHandler))
		entities.Get("/generate", middleware.ReqSignedIn, routing.Wrap(s.generateHandler))
	})
}

// swagger:route GET /query-recommend query_recommend recommendQueries
//
// Query history search.
//
// Returns a list of queries in the query history that matches the search criteria.
// Query history search supports pagination. Use the `limit` parameter to control the maximum number of queries returned; the default limit is 100.
// You can also use the `page` query parameter to fetch queries from any page other than the first one.
//
// Responses:
// 200: getQueryRecommendResponse
// 401: unauthorisedError
// 500: internalServerError
func (s *QueryRecommendService) recommendHandler(c *contextmodel.ReqContext) response.Response {

	result, err := s.GetQueryRecommendation(c.Req.Context(), c.Query("datasourceUid"), c.Query("metrics"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get query recommendation", err)
	}

	return response.JSON(http.StatusOK, QueryRecommendResponse{Result: result})
}

func (s *QueryRecommendService) generateHandler(c *contextmodel.ReqContext) response.Response {

	err := s.ComputeQueryRecommendation(c.Req.Context(), c.Query("datasourceUid"))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to generate recommendation", err)
	}

	return response.JSON(http.StatusOK, QueryGenerateRecommendResponse{
		Message: "Query recommendation generated for datasource " + c.Query("datasourceUid"),
	})
}
