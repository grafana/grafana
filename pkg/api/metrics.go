package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

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

// QueryMetricsV2 returns query metrics.
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsV2(c *models.ReqContext) response.Response {
	reqDTO := dtos.MetricRequest{}
	if err := web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	reqDTO.HTTPRequest = c.Req

	resp, err := hs.queryDataService.QueryData(c.Req.Context(), c.SignedInUser, c.SkipCache, reqDTO, true)
	if err != nil {
		return hs.handleQueryMetricsError(err)
	}
	return hs.toJsonStreamingResponse(resp)
}

func (hs *HTTPServer) toJsonStreamingResponse(qdr *backend.QueryDataResponse) response.Response {
	if !hs.Features.IsEnabled(featuremgmt.FlagDatasourceQueryMultiStatus) {
		statusCode := http.StatusOK
		for _, res := range qdr.Responses {
			if res.Error != nil {
				statusCode = http.StatusBadRequest
			}
		}
		return response.JSONStreaming(statusCode, qdr)
	}

	statusCode := http.StatusOK
	res := map[string]queryResponse{}
	for refID, resp := range qdr.Responses {
		qr := queryResponse{Frames: resp.Frames, Error: resp.Error, Status: http.StatusOK}
		if resp.Error != nil {
			statusCode = http.StatusMultiStatus
			qr.Status = http.StatusBadRequest

			if resp.ErrorDetails == nil {
				resp.ErrorDetails = &backend.ErrorDetails{
					Status: backend.InferErrorStatus(resp.Error),
				}
			}
			switch resp.ErrorDetails.Status {
			case backend.Unauthorized:
				qr.Status = http.StatusUnauthorized
			case backend.Unknown:
				qr.Status = http.StatusInternalServerError
			case backend.ConnectionError:
				qr.Status = http.StatusBadGateway
			case backend.Timeout:
				qr.Status = http.StatusGatewayTimeout
			default:
				qr.Status = http.StatusBadRequest
			}
		}
		res[refID] = qr
	}
	return response.JSONStreaming(statusCode, &metricsResponse{Results: res})
}
