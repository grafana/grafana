package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

// QueryData endpoint for querying backend data source plugins.
// POST /api/ds/query
func (hs *HTTPServer) QueryData(c *models.ReqContext, reqDto dtos.QueryDataRequest) Response {
	if len(reqDto.Queries) == 0 {
		return Error(500, "No queries found in query", nil)
	}

	request := &tsdb.TsdbQuery{
		User: c.SignedInUser,
	}

	var ds *models.DataSource
	var err error
	for i, query := range reqDto.Queries {
		if i == 0 {
			request.TimeRange = tsdb.NewTimeRange(query.From, query.To)
			ds, err = hs.DatasourceCache.GetDatasource(query.DatasourceID, c.SignedInUser, c.SkipCache)
			if err != nil {
				if err == models.ErrDataSourceAccessDenied {
					return Error(403, "Access denied to datasource", err)
				}
				return Error(500, "Unable to load datasource meta data", err)
			}
		}

		maxDataPoints := int64(100)
		if query.MaxDataPoints != nil {
			maxDataPoints = *query.MaxDataPoints
		}

		intervalMS := int64(1000)
		if query.IntervalMS != nil {
			intervalMS = *query.IntervalMS
		}

		request.Queries = append(request.Queries, &tsdb.Query{
			RefId:         query.RefID,
			MaxDataPoints: maxDataPoints,
			IntervalMs:    intervalMS,
			Model:         query.Model,
			DataSource:    ds,
		})
	}

	resp, err := tsdb.HandleRequest(c.Req.Context(), ds, request)
	if err != nil {
		return Error(500, "Metric request error", err)
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

// TransformData experimental endpoint for transforming data.
// POST /api/ds/transform
func (hs *HTTPServer) TransformData(c *models.ReqContext, reqDto dtos.TransformDataRequest) Response {
	if !setting.IsExpressionsEnabled() {
		return Error(404, "Expressions feature toggle is not enabled", nil)
	}

	if plugins.Transform == nil {
		return Error(404, "No transform plugin available", nil)
	}

	if len(reqDto.Queries) == 0 {
		return Error(500, "No queries found in query", nil)
	}

	request := &tsdb.TsdbQuery{
		User: c.SignedInUser,
	}

	expr := false
	var ds *models.DataSource
	var err error
	for i, query := range reqDto.Queries {
		if query.DatasourceName == "" {
			return Error(500, "Datasource name is required", nil)
		}

		if query.DatasourceName == "__expr__" {
			expr = true
		}

		if i == 0 && !expr {
			request.TimeRange = tsdb.NewTimeRange(query.From, query.To)
			ds, err = hs.DatasourceCache.GetDatasource(query.DatasourceID, c.SignedInUser, c.SkipCache)
			if err != nil {
				if err == models.ErrDataSourceAccessDenied {
					return Error(403, "Access denied to datasource", err)
				}
				return Error(500, "Unable to load datasource meta data", err)
			}
		}

		maxDataPoints := int64(100)
		if query.MaxDataPoints != nil {
			maxDataPoints = *query.MaxDataPoints
		}

		intervalMS := int64(1000)
		if query.IntervalMS != nil {
			intervalMS = *query.IntervalMS
		}

		request.Queries = append(request.Queries, &tsdb.Query{
			RefId:         query.RefID,
			MaxDataPoints: maxDataPoints,
			IntervalMs:    intervalMS,
			Model:         query.Model,
			DataSource:    ds,
		})
	}

	if !expr {
		return Error(400, "No expression queries found", nil)
	}

	resp, err := plugins.Transform.Transform(c.Req.Context(), request)
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
