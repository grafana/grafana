package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

// POST /api/tsdb/transform
// This enpoint is tempory, will be part of v2 query endpoint.
func (hs *HTTPServer) Transform(c *m.ReqContext, reqDto dtos.MetricRequest) Response {
	if !setting.IsExpressionsEnabled() {
		return Error(404, "Expressions feature toggle is not enabled", nil)
	}
	if plugins.Transform == nil {
		return Error(http.StatusServiceUnavailable, "transform plugin is not loaded", nil)
	}

	timeRange := tsdb.NewTimeRange(reqDto.From, reqDto.To)

	if len(reqDto.Queries) == 0 {
		return Error(400, "No queries found in query", nil)
	}

	var datasourceID int64
	for _, query := range reqDto.Queries {
		name, err := query.Get("datasource").String()
		if err != nil {
			return Error(500, "datasource missing name", err)
		}
		datasourceID, err = query.Get("datasourceId").Int64()
		if err != nil {
			return Error(400, "GEL datasource missing ID", nil)
		}
		if name == "-- GEL --" {
			break
		}
	}

	ds, err := hs.DatasourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache)
	if err != nil {
		if err == m.ErrDataSourceAccessDenied {
			return Error(403, "Access denied to datasource", err)
		}
		return Error(500, "Unable to load datasource meta data", err)
	}

	request := &tsdb.TsdbQuery{TimeRange: timeRange, Debug: reqDto.Debug}

	for _, query := range reqDto.Queries {
		request.Queries = append(request.Queries, &tsdb.Query{
			RefId:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMs:    query.Get("intervalMs").MustInt64(1000),
			Model:         query,
			DataSource:    ds,
		})
	}

	resp, err := plugins.Transform.Transform(c.Req.Context(), ds, request)
	if err != nil {
		return Error(500, "Transform request error", err)
	}

	statusCode := 200
	for _, res := range resp.Results {
		if res.Error != nil {
			res.ErrorString = res.Error.Error()
			resp.Message = res.ErrorString
			statusCode = 400
		}
	}

	return JSON(statusCode, &resp)
}
