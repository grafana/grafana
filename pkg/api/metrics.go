package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

func checkDashboardAndPanel(ctx context.Context, dashboardId, panelId string) error {
	if dashboardId == "" || panelId == "" {
		return models.ErrDashboardOrPanelIdentifierNotSet
	}

	id, err := strconv.ParseInt(dashboardId, 10, 64)
	if err != nil {
		return models.ErrDashboardIdentifierInvalid
	}

	query := models.GetDashboardQuery{
		Id: id,
	}

	if err := bus.Dispatch(ctx, &query); err != nil {
		return err
	}

	// Dashboard has no properties. This would be weird, haven't written a test
	// for this yet, but would most likely be a bug and return an error from
	// bus.Dispatch
	if query.Result == nil {
		panic("missing result from dashboard query with no error")
	}

	dashboard := query.Result

	// dashboard saved but no panels
	if dashboard.Data == nil {
		return models.ErrDashboardCorrupt
	}

	pId, err := strconv.ParseInt(panelId, 10, 64)
	if err != nil {
		return models.ErrDashboardPanelIdentifierInvalid
	}

	// FIXME: parse the dashboard JSON in a more performant/structured way.
	panels := dashboard.Data.Get("panels")
	for i := 0; ; i++ {
		panel, ok := panels.CheckGetIndex(i)
		if !ok {
			break
		}

		if panel.Get("id").MustInt64(-1) == pId {
			return nil
		}
	}

	// no panel with that ID
	return models.ErrDashboardPanelNotFound
}

// QueryMetricsV2 returns query metrics.
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsFromDashboard(c *models.ReqContext) response.Response {
	if !hs.Features.IsEnabled(featuremgmt.FlagValidatedQueries) {
		return response.Respond(http.StatusNotFound, "404 page not found\n")
	}

	reqDTO := dtos.MetricRequest{}

	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	params := web.Params(c.Req)
	dashboardId := params[":dashboardId"]
	panelId := params[":panelId"]

	// 404 if dashboard or panel not found
	if err := checkDashboardAndPanel(c.Req.Context(), dashboardId, panelId); err != nil {
		c.Logger.Warn("Failed to find dashboard or panel for validated query", "err", err)
		var dashboardErr models.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(http.StatusNotFound, "Dashboard or panel not found", err)
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
