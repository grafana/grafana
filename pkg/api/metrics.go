package api

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// QueryMetricsV2 returns query metrics.
// POST /api/ds/query   DataSource query w/ expressions
func (hs *HTTPServer) QueryMetricsV2(c *models.ReqContext, reqDTO dtos.MetricRequest) response.Response {
	parsedReq, err := hs.parseMetricRequest(c, reqDTO)
	if err != nil {
		return hs.handleGetDataSourceError(err, nil)
	}

	if parsedReq.hasExpression {
		return hs.handleExpressions(c, parsedReq)
	}

	resp, err := hs.handleQueryData(c, parsedReq)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Metric request error", err)
	}

	return toMacronResponse(resp)
}

// handleExpressions handles POST /api/ds/query when there is an expression.
func (hs *HTTPServer) handleExpressions(c *models.ReqContext, parsedReq *parsedRequest) response.Response {
	exprReq := expr.Request{
		OrgId:   c.OrgId,
		Queries: []expr.Query{},
	}

	for _, pq := range parsedReq.parsedQueries {
		if pq.datasource == nil {
			return response.Error(http.StatusBadRequest, "Query mising datasource info: "+pq.query.RefID, nil)
		}

		exprReq.Queries = append(exprReq.Queries, expr.Query{
			JSON:          pq.query.JSON,
			Interval:      pq.query.Interval,
			RefID:         pq.query.RefID,
			MaxDataPoints: pq.query.MaxDataPoints,
			QueryType:     pq.query.QueryType,
			Datasource: expr.DataSourceRef{
				Type: pq.datasource.Type,
				UID:  pq.datasource.Uid,
			},
			TimeRange: expr.TimeRange{
				From: pq.query.TimeRange.From,
				To:   pq.query.TimeRange.To,
			},
		})
	}

	qdr, err := hs.expressionService.TransformData(c.Req.Context(), &exprReq)
	if err != nil {
		return response.Error(500, "expression request error", err)
	}
	return toMacronResponse(qdr)
}

func (hs *HTTPServer) handleQueryData(c *models.ReqContext, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	ds := parsedReq.parsedQueries[0].datasource
	if err := hs.PluginRequestValidator.Validate(ds.Url, nil); err != nil {
		return nil, models.ErrDataSourceAccessDenied
	}

	instanceSettings, err := adapters.ModelToInstanceSettings(ds, hs.decryptSecureJsonDataFn())
	if err != nil {
		return nil, fmt.Errorf("failed to convert data source to instance settings")
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgId,
			PluginID:                   ds.Type,
			User:                       adapters.BackendUserFromSignedInUser(c.SignedInUser),
			DataSourceInstanceSettings: instanceSettings,
		},
		Headers: map[string]string{},
		Queries: []backend.DataQuery{},
	}

	if hs.OAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := hs.OAuthTokenService.GetCurrentOAuthToken(c.Req.Context(), c.SignedInUser); token != nil {
			req.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)
		}
	}

	for _, q := range parsedReq.parsedQueries {
		req.Queries = append(req.Queries, q.query)
	}

	return hs.pluginClient.QueryData(c.Req.Context(), req)
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
		return response.Error(http.StatusForbidden, "Access denied to data source", err)
	}
	if errors.Is(err, models.ErrDataSourceNotFound) {
		return response.Error(http.StatusBadRequest, "Invalid data source ID", err)
	}
	return response.Error(http.StatusInternalServerError, "Unable to load data source metadata", err)
}

// QueryMetrics returns query metrics
// POST /api/tsdb/query
//nolint: staticcheck // legacydata.DataResponse deprecated
//nolint: staticcheck // legacydata.DataQueryResult deprecated
func (hs *HTTPServer) QueryMetrics(c *models.ReqContext, reqDto dtos.MetricRequest) response.Response {
	parsedReq, err := hs.parseMetricRequest(c, reqDto)
	if err != nil {
		return hs.handleGetDataSourceError(err, nil)
	}

	sdkResp, err := hs.handleQueryData(c, parsedReq)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Metric request error", err)
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

type parsedQuery struct {
	datasource *models.DataSource
	query      backend.DataQuery
}

type parsedRequest struct {
	hasExpression bool
	parsedQueries []parsedQuery
}

func (hs *HTTPServer) parseMetricRequest(c *models.ReqContext, reqDTO dtos.MetricRequest) (*parsedRequest, error) {
	if len(reqDTO.Queries) == 0 {
		return nil, errors.New("no queries found in query")
	}

	timeRange := legacydata.NewDataTimeRange(reqDTO.From, reqDTO.To)
	req := &parsedRequest{
		hasExpression: false,
		parsedQueries: []parsedQuery{},
	}

	// Parse the queries
	datasources := map[string]*models.DataSource{}
	for _, query := range reqDTO.Queries {
		ds, err := hs.getDataSourceFromQuery(c, query, datasources)
		if err != nil {
			return nil, err
		}
		if ds == nil {
			return nil, errors.New("datasource not found for query")
		}

		datasources[ds.Uid] = ds
		if expr.IsDataSource(ds.Uid) {
			req.hasExpression = true
		}

		hs.log.Debug("Processing metrics query", "query", query)

		modelJSON, err := query.MarshalJSON()
		if err != nil {
			return nil, err
		}

		req.parsedQueries = append(req.parsedQueries, parsedQuery{
			datasource: ds,
			query: backend.DataQuery{
				TimeRange: backend.TimeRange{
					From: timeRange.GetFromAsTimeUTC(),
					To:   timeRange.GetToAsTimeUTC(),
				},
				RefID:         query.Get("refId").MustString("A"),
				MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
				Interval:      time.Duration(query.Get("intervalMs").MustInt64(1000)) * time.Millisecond,
				QueryType:     query.Get("queryType").MustString(""),
				JSON:          modelJSON,
			},
		})
	}

	if !req.hasExpression {
		if len(datasources) > 1 {
			// We do not (yet) support mixed query type
			return nil, fmt.Errorf("all queries must use the same datasource")
		}
	}

	return req, nil
}

func (hs *HTTPServer) getDataSourceFromQuery(c *models.ReqContext, query *simplejson.Json, history map[string]*models.DataSource) (*models.DataSource, error) {
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

	if uid != "" {
		ds, err = hs.DataSourceCache.GetDatasourceByUID(uid, c.SignedInUser, c.SkipCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	// Fallback to the datasourceId
	id, err := query.Get("datasourceId").Int64()
	if err != nil {
		return nil, errors.New("query missing data source ID/UID")
	}
	ds, err = hs.DataSourceCache.GetDatasource(id, c.SignedInUser, c.SkipCache)
	if err != nil {
		return nil, err
	}
	return ds, nil
}
