package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) handleQueryMetricsError(err error) *response.NormalResponse {
	if errors.Is(err, models.ErrDataSourceAccessDenied) {
		return response.Error(http.StatusForbidden, "Access denied to data source", err)
	}
	var badQuery *query.ErrBadQuery
	if errors.As(err, &badQuery) {
		return response.Error(http.StatusBadRequest, util.Capitalize(badQuery.Message), err)
	}
	return response.Error(http.StatusInternalServerError, "Query data error", err)
}

// QueryMetricsV2 returns query metrics.
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsV2(c *models.ReqContext) response.Response {
	reqDTO := dtos.MetricRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	resp, err := hs.queryDataService.QueryData(c.Req.Context(), c.SignedInUser, c.SkipCache, reqDTO, true)
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	return toJsonStreamingResponse(resp)
}

// WOOPS! you wrote all these tests to query a datasource. You still need to do
// that, but you should be querying a dashboard not a datasource. Try again!
// logic should still be about the same though. :p, from Jeff to Jeff.
// 1. query the dashboard with GetDashboardsQuery
// 2. stub respond for GetDashBoardsQuery
// 2. figure out how to get the dashboard panels
// 3. figure out how to query the panelId from the dashboard json
func dashboardAndPanelExist(c *models.ReqContext, dashboardId, panelId string) bool {
	id, err := strconv.ParseInt(dashboardId, 10, 64)
	if err != nil {
		return false //response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	query := models.GetDashboardQuery{
		Id: id,
	}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		return false
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		///return response.Error(404, "Data source not found", nil)
		//}
		//if errors.Is(err, models.ErrDataSourceIdentifierNotSet) {
		//return response.Error(400, "Datasource id is missing", nil)
		//}
		//return response.Error(500, "Failed to query datasources", err)
	}

	// Dashboard has no properties. This would be weird, haven't written a test
	// for this yet, but would most likely be a bug and return an error from
	// bus.Dispatch
	if query.Result == nil {
		return false
	}

	dashboard := query.Result

	// dashboard saved but no panels
	if dashboard.Data == nil {
		return false
	}

	// not entirely sure this is how we determine a panelId.
	_, exists := dashboard.Data.Get("results").CheckGet(panelId)
	if exists {
		return true
	}

	// no panel with that ID
	return false
}

// QueryMetricsV2 returns query metrics.
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsFromDashboard(c *models.ReqContext) response.Response {
	reqDTO := dtos.MetricRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	params := web.Params(c.Req)
	dashboardId := params[":dashboardId"]
	panelId := params[":panelId"]

	if dashboardId == "" || panelId == "" {
		// TODO: Is this an appropriate status code?
		return response.Error(http.StatusForbidden, "missing dashboard or panel ID", nil)
	}

	// 404 if dashboard or panel not found
	if !dashboardAndPanelExist(c, dashboardId, panelId) {
		return response.Error(http.StatusNotFound, "Dashboard or panel not found", nil)
	}

	resp, err := hs.queryDataService.QueryData(c.Req.Context(), c.SignedInUser, c.SkipCache, reqDTO, true)
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	return toJsonStreamingResponse(resp)
}

// QueryMetrics returns query metrics
// POST /api/tsdb/query
//nolint: staticcheck // legacydata.DataResponse deprecated
//nolint: staticcheck // legacydata.DataQueryResult deprecated
func (hs *HTTPServer) QueryMetrics(c *models.ReqContext) response.Response {
	reqDto := dtos.MetricRequest{}
	if err := web.Bind(c.Req, &reqDto); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	sdkResp, err := hs.queryDataService.QueryData(c.Req.Context(), c.SignedInUser, c.SkipCache, reqDto, false)
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}

	legacyResp := legacydata.DataResponse{
		Results: map[string]legacydata.DataQueryResult{},
	}

	for refID, res := range sdkResp.Responses {
		dqr := legacydata.DataQueryResult{
			RefID: refID,
		}

		if res.Error != nil {
			dqr.Error = res.Error
		}

		if res.Frames != nil {
			dqr.Dataframes = legacydata.NewDecodedDataFrames(res.Frames)
		}

		legacyResp.Results[refID] = dqr
	}

	statusCode := http.StatusOK
	for _, res := range legacyResp.Results {
		if res.Error != nil {
			res.ErrorString = res.Error.Error()
			legacyResp.Message = res.ErrorString
			statusCode = http.StatusBadRequest
		}
	}

	return response.JSON(statusCode, &legacyResp)
}

func toJsonStreamingResponse(qdr *backend.QueryDataResponse) response.Response {
	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = http.StatusBadRequest
		}
	}

	return response.JSONStreaming(statusCode, qdr)
}
