package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/grafanads"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
)

// QueryMetricsV2 returns query metrics.
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsV2(c *models.ReqContext, reqDTO dtos.MetricRequest) response.Response {
	if len(reqDTO.Queries) == 0 {
		return response.Error(http.StatusBadRequest, "No queries found in query", nil)
	}

	timeRange := plugins.NewDataTimeRange(reqDTO.From, reqDTO.To)
	request := plugins.DataQuery{
		TimeRange: &timeRange,
		Debug:     reqDTO.Debug,
		User:      c.SignedInUser,
		Queries:   make([]plugins.DataSubQuery, 0, len(reqDTO.Queries)),
	}

	// Loop to see if we have an expression.
	prevType := ""
	var ds *models.DataSource
	for _, query := range reqDTO.Queries {
		dsType := query.Get("datasource").MustString("")
		if dsType == expr.DatasourceName {
			return hs.handleExpressions(c, reqDTO)
		}
		if prevType != "" && prevType != dsType {
			// For mixed datasource case, each data source is sent in a single request.
			// So only the datasource from the first query is needed. As all requests
			// should be the same data source.
			hs.log.Debug("Can't process query since it's missing data source ID")
			return response.Error(http.StatusBadRequest, "All queries must use the same datasource", nil)
		}

		if ds == nil {
			// require ID for everything
			dsID, err := query.Get("datasourceId").Int64()
			if err != nil {
				hs.log.Debug("Can't process query since it's missing data source ID")
				return response.Error(http.StatusBadRequest, "Query missing data source ID", nil)
			}
			if dsID == grafanads.DatasourceID {
				ds = grafanads.DataSourceModel(c.OrgId)
			} else {
				ds, err = hs.DataSourceCache.GetDatasource(dsID, c.SignedInUser, c.SkipCache)
				if err != nil {
					return hs.handleGetDataSourceError(err, dsID)
				}
			}
		}
		prevType = dsType
	}

	for _, query := range reqDTO.Queries {
		hs.log.Debug("Processing metrics query", "query", query)

		request.Queries = append(request.Queries, plugins.DataSubQuery{
			RefID:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMS:    query.Get("intervalMs").MustInt64(1000),
			QueryType:     query.Get("queryType").MustString(""),
			Model:         query,
			DataSource:    ds,
		})
	}

	err := hs.PluginRequestValidator.Validate(ds.Url, nil)
	if err != nil {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	req, err := hs.createRequest(ds, request)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Request formation error", err)
	}

	resp, err := hs.pluginClient.QueryData(c.Req.Context(), req)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Metric request error", err)
	}

	return toMacronResponse(resp)
}

func toMacronResponse(qdr *backend.QueryDataResponse) response.Response {
	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = http.StatusBadRequest
		}
	}

	return response.JSONStreaming(statusCode, qdr)
}

// handleExpressions handles POST /api/ds/query when there is an expression.
func (hs *HTTPServer) handleExpressions(c *models.ReqContext, reqDTO dtos.MetricRequest) response.Response {
	timeRange := plugins.NewDataTimeRange(reqDTO.From, reqDTO.To)
	request := plugins.DataQuery{
		TimeRange: &timeRange,
		Debug:     reqDTO.Debug,
		User:      c.SignedInUser,
		Queries:   make([]plugins.DataSubQuery, 0, len(reqDTO.Queries)),
	}

	for _, query := range reqDTO.Queries {
		hs.log.Debug("Processing metrics query", "query", query)
		name := query.Get("datasource").MustString("")

		datasourceID, err := query.Get("datasourceId").Int64()
		if err != nil {
			hs.log.Debug("Can't process query since it's missing data source ID")
			return response.Error(400, "Query missing data source ID", nil)
		}

		if name != expr.DatasourceName {
			// Expression requests have everything in one request, so need to check
			// all data source queries for possible permission / not found issues.
			if _, err = hs.DataSourceCache.GetDatasource(datasourceID, c.SignedInUser, c.SkipCache); err != nil {
				return hs.handleGetDataSourceError(err, datasourceID)
			}
		}

		request.Queries = append(request.Queries, plugins.DataSubQuery{
			RefID:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMS:    query.Get("intervalMs").MustInt64(1000),
			QueryType:     query.Get("queryType").MustString(""),
			Model:         query,
		})
	}

	exprService := expr.Service{
		Cfg:         hs.Cfg,
		DataService: hs.DataService,
	}
	qdr, err := exprService.WrapTransformData(c.Req.Context(), request)
	if err != nil {
		return response.Error(500, "expression request error", err)
	}
	return toMacronResponse(qdr)
}

func (hs *HTTPServer) handleGetDataSourceError(err error, datasourceID int64) *response.NormalResponse {
	hs.log.Debug("Encountered error getting data source", "err", err, "id", datasourceID)
	if errors.Is(err, models.ErrDataSourceAccessDenied) {
		return response.Error(403, "Access denied to data source", err)
	}
	if errors.Is(err, models.ErrDataSourceNotFound) {
		return response.Error(400, "Invalid data source ID", err)
	}
	return response.Error(500, "Unable to load data source metadata", err)
}

// QueryMetrics returns query metrics
// POST /api/tsdb/query
func (hs *HTTPServer) QueryMetrics(c *models.ReqContext, reqDto dtos.MetricRequest) response.Response {
	if len(reqDto.Queries) == 0 {
		return response.Error(http.StatusBadRequest, "No queries found in query", nil)
	}

	datasourceId, err := reqDto.Queries[0].Get("datasourceId").Int64()
	if err != nil {
		return response.Error(http.StatusBadRequest, "Query missing datasourceId", nil)
	}

	ds, err := hs.DataSourceCache.GetDatasource(datasourceId, c.SignedInUser, c.SkipCache)
	if err != nil {
		return hs.handleGetDataSourceError(err, datasourceId)
	}

	err = hs.PluginRequestValidator.Validate(ds.Url, nil)
	if err != nil {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	timeRange := plugins.NewDataTimeRange(reqDto.From, reqDto.To)
	request := plugins.DataQuery{
		TimeRange: &timeRange,
		Debug:     reqDto.Debug,
		User:      c.SignedInUser,
	}

	for _, query := range reqDto.Queries {
		request.Queries = append(request.Queries, plugins.DataSubQuery{
			RefID:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMS:    query.Get("intervalMs").MustInt64(1000),
			Model:         query,
			DataSource:    ds,
		})
	}

	resp, err := hs.DataService.HandleRequest(c.Req.Context(), ds, request)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Metric request error", err)
	}

	statusCode := http.StatusOK
	for _, res := range resp.Results {
		if res.Error != nil {
			res.ErrorString = res.Error.Error()
			resp.Message = res.ErrorString
			statusCode = http.StatusBadRequest
		}
	}

	return response.JSON(statusCode, &resp)
}

// nolint:staticcheck // plugins.DataQueryResponse deprecated
func (hs *HTTPServer) createRequest(ds *models.DataSource, query plugins.DataQuery) (*backend.QueryDataRequest, error) {
	instanceSettings, err := adapters.ModelToInstanceSettings(ds, hs.decryptSecureJsonDataFn())
	if err != nil {
		return nil, err
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgId,
			PluginID:                   ds.Type,
			User:                       adapters.BackendUserFromSignedInUser(query.User),
			DataSourceInstanceSettings: instanceSettings,
		},
		Queries: []backend.DataQuery{},
		Headers: query.Headers,
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		req.Queries = append(req.Queries, backend.DataQuery{
			RefID:         q.RefID,
			Interval:      time.Duration(q.IntervalMS) * time.Millisecond,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange: backend.TimeRange{
				From: query.TimeRange.GetFromAsTimeUTC(),
				To:   query.TimeRange.GetToAsTimeUTC(),
			},
			QueryType: q.QueryType,
			JSON:      modelJSON,
		})
	}

	return req, nil
}
