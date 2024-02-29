package searchV2

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type SearchHTTPService interface {
	RegisterHTTPRoutes(storageRoute routing.RouteRegister)
}

type searchHTTPService struct {
	search SearchService
}

func ProvideSearchHTTPService(search SearchService) SearchHTTPService {
	return &searchHTTPService{search: search}
}

func (s *searchHTTPService) RegisterHTTPRoutes(storageRoute routing.RouteRegister) {
	storageRoute.Post("/", middleware.ReqSignedIn, routing.Wrap(s.doQuery))
}

func (s *searchHTTPService) doQuery(c *contextmodel.ReqContext) response.Response {
	searchReadinessCheckResp := s.search.IsReady(c.Req.Context(), c.SignedInUser.GetOrgID())
	if !searchReadinessCheckResp.IsReady {
		dashboardSearchNotServedRequestsCounter.With(prometheus.Labels{
			"reason": searchReadinessCheckResp.Reason,
		}).Inc()

		return response.JSON(http.StatusOK, &backend.DataResponse{
			Frames: []*data.Frame{{
				Name: "Loading",
			}},
			Error: nil,
		})
	}

	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "error reading bytes", err)
	}

	query := &DashboardQuery{}
	err = json.Unmarshal(body, query)
	if err != nil {
		return response.Error(http.StatusBadRequest, "error parsing body", err)
	}

	resp := s.search.doDashboardQuery(c.Req.Context(), c.SignedInUser, c.SignedInUser.GetOrgID(), *query)

	if resp.Error != nil {
		return response.Error(http.StatusInternalServerError, "error handling search request", resp.Error)
	}

	if len(resp.Frames) == 0 {
		msg := "invalid search response"
		return response.Error(http.StatusInternalServerError, msg, errors.New(msg))
	}

	bytes, err := resp.MarshalJSON()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "error marshalling response", err)
	}

	return response.JSON(http.StatusOK, bytes)
}
