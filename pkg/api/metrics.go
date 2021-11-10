package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
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

	// Parse the queries
	hasExpression := false
	datasources := make(map[string]*models.DataSource, len(reqDTO.Queries))
	for _, query := range reqDTO.Queries {
		ds, errRsp := hs.getDataSourceFromQuery(c, query, datasources)
		if errRsp != nil {
			return errRsp
		}
		if ds == nil {
			return response.Error(http.StatusBadRequest, "Datasource not found for query", nil)
		}

		datasources[ds.Uid] = ds
		if expr.IsDataSource(ds.Uid) {
			hasExpression = true
		}

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

	if hasExpression {
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

	ds := request.Queries[0].DataSource
	if len(datasources) > 1 {
		// We do not (yet) support mixed query type
		return response.Error(http.StatusBadRequest, "All queries must use the same datasource", nil)
	}

	err := hs.PluginRequestValidator.Validate(ds.Url, nil)
	if err != nil {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	req, err := hs.createRequest(c.Req.Context(), ds, request)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Request formation error", err)
	}

	resp, err := hs.pluginClient.QueryData(c.Req.Context(), req)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Metric request error", err)
	}

	return toMacronResponse(resp)
}

func (hs *HTTPServer) getDataSourceFromQuery(c *models.ReqContext, query *simplejson.Json, history map[string]*models.DataSource) (*models.DataSource, response.Response) {
	var err error
	uid := query.Get("datasource").Get("uid").MustString()

	// before 8.3 special types could be sent as datasource (expr)
	if uid == "" {
		uid = query.Get("datasource").MustString()
	}

	// check cache value
	ds, ok := history[uid]
	if ok {
		return ds, nil
	}

	if expr.IsDataSource(uid) {
		return expr.DataSourceModel(), nil
	}

	if uid == grafanads.DatasourceUID {
		return grafanads.DataSourceModel(c.OrgId), nil
	}

	// use datasourceId if it exists
	id := query.Get("datasourceId").MustInt64(0)
	if id > 0 {
		ds, err = hs.DataSourceCache.GetDatasource(id, c.SignedInUser, c.SkipCache)
		if err != nil {
			return nil, hs.handleGetDataSourceError(err, id)
		}
		return ds, nil
	}

	if uid != "" {
		ds, err = hs.DataSourceCache.GetDatasourceByUID(uid, c.SignedInUser, c.SkipCache)
		if err != nil {
			return nil, hs.handleGetDataSourceError(err, uid)
		}
		return ds, nil
	}

	return nil, response.Error(http.StatusBadRequest, "Query missing data source ID/UID", nil)
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

func (hs *HTTPServer) handleGetDataSourceError(err error, datasourceRef interface{}) *response.NormalResponse {
	hs.log.Debug("Encountered error getting data source", "err", err, "ref", datasourceRef)
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
func (hs *HTTPServer) createRequest(ctx context.Context, ds *models.DataSource,
	query plugins.DataQuery) (*backend.QueryDataRequest, error) {
	instanceSettings, err := adapters.ModelToInstanceSettings(ds, hs.decryptSecureJsonDataFn())
	if err != nil {
		return nil, err
	}

	if query.Headers == nil {
		query.Headers = make(map[string]string)
	}

	if hs.OAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := hs.OAuthTokenService.GetCurrentOAuthToken(ctx, query.User); token != nil {
			delete(query.Headers, "Authorization")
			query.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
		}
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
