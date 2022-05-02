package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

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

func (hs *HTTPServer) handleQueryMetricsError(err error) *response.NormalResponse {
	if errors.Is(err, models.ErrDataSourceAccessDenied) {
		return response.Error(http.StatusForbidden, "Access denied to data source", err)
	}
	if errors.Is(err, models.ErrDataSourceNotFound) {
		return response.Error(http.StatusNotFound, "Data source not found", err)
	}
	var badQuery *query.ErrBadQuery
	if errors.As(err, &badQuery) {
		return response.Error(http.StatusBadRequest, util.Capitalize(badQuery.Message), err)
	}

	if errors.Is(err, backendplugin.ErrPluginNotRegistered) {
		return response.Error(http.StatusNotFound, "Plugin not found", err)
	}

	return response.Error(http.StatusInternalServerError, "Query data error", err)
}

func parseDashboardQueryParams(params map[string]string) (models.GetDashboardQuery, int64, error) {
	query := models.GetDashboardQuery{}

	if params[":orgId"] == "" || params[":dashboardUid"] == "" || params[":panelId"] == "" {
		return query, 0, models.ErrDashboardOrPanelIdentifierNotSet
	}

	orgId, err := strconv.ParseInt(params[":orgId"], 10, 64)
	if err != nil {
		return query, 0, models.ErrDashboardPanelIdentifierInvalid
	}

	panelId, err := strconv.ParseInt(params[":panelId"], 10, 64)
	if err != nil {
		return query, 0, models.ErrDashboardPanelIdentifierInvalid
	}

	query.Uid = params[":dashboardUid"]
	query.OrgId = orgId

	return query, panelId, nil
}

func checkDashboardAndPanel(ctx context.Context, ss sqlstore.Store, query models.GetDashboardQuery, panelId int64) error {
	// Query the dashboard
	if err := ss.GetDashboard(ctx, &query); err != nil {
		return err
	}

	if query.Result == nil {
		return models.ErrDashboardCorrupt
	}

	// dashboard saved but no panels
	dashboard := query.Result
	if dashboard.Data == nil {
		return models.ErrDashboardCorrupt
	}

	// FIXME: parse the dashboard JSON in a more performant/structured way.
	panels := dashboard.Data.Get("panels")

	for i := 0; ; i++ {
		panel, ok := panels.CheckGetIndex(i)
		if !ok {
			break
		}

		if panel.Get("id").MustInt64(-1) == panelId {
			return nil
		}
	}

	// no panel with that ID
	return models.ErrDashboardPanelNotFound
}

// QueryMetricsFromDashboard returns query metrics.
// POST /dashboards/org/:orgId/uid/:dashboardUid/panels/:panelId/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsFromDashboard(c *models.ReqContext) response.Response {
	// check feature flag
	if !hs.Features.IsEnabled(featuremgmt.FlagValidatedQueries) {
		return response.Respond(http.StatusNotFound, "404 page not found\n")
	}

	// build query
	reqDTO := dtos.MetricRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	params := web.Params(c.Req)
	getDashboardQuery, panelId, err := parseDashboardQueryParams(params)

	// check dashboard: inside the statement is the happy path. we should maybe
	// refactor this as it's not super obvious
	if err == nil {
		err = checkDashboardAndPanel(c.Req.Context(), hs.SQLStore, getDashboardQuery, panelId)
	}

	// 404 if dashboard or panel not found
	if err != nil {
		c.Logger.Warn("Failed to find dashboard or panel for validated query", "err", err)
		var dashboardErr models.DashboardErr
		if ok := errors.As(err, &dashboardErr); ok {
			return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
		}
		return response.Error(http.StatusNotFound, "Dashboard or panel not found", err)
	}

	// return panel data
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
// Deprecated: use QueryMetricsV2 instead.
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
