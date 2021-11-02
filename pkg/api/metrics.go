package api

import (
	"errors"
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

	// Parse all query types
	hasExpression := false
	allSameUID := true
	prevUID := ""
	queryInfo := make([]queryDSInfo, 0, len(reqDTO.Queries))
	for _, query := range reqDTO.Queries {
		q := hs.getDataSourceFromQuery(c, query)
		if q.errRes != nil {
			return q.errRes
		}
		if q.isExpr {
			hasExpression = true
		}
		if q.ds == nil {
			return response.Error(http.StatusBadRequest, "Datasource not found for query", nil)
		} else {
			if prevUID != "" && prevUID != q.ds.Uid {
				allSameUID = false
			}
			prevUID = q.ds.Uid
		}
		queryInfo = append(queryInfo, q)
	}

	ds := queryInfo[0].ds
	if hasExpression {
		ds = nil // Don't attach datsource model for transform
	} else if !allSameUID {
		return response.Error(http.StatusBadRequest, "All queries must use the same datasource", nil)
	}

	for _, info := range queryInfo {
		hs.log.Debug("Processing metrics query", "query", info.query)

		request.Queries = append(request.Queries, plugins.DataSubQuery{
			RefID:         info.query.Get("refId").MustString("A"),
			MaxDataPoints: info.query.Get("maxDataPoints").MustInt64(100),
			IntervalMS:    info.query.Get("intervalMs").MustInt64(1000),
			QueryType:     info.query.Get("queryType").MustString(""),
			Model:         info.query, // includes full datasource info for expressions
			DataSource:    info.ds,
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

type queryDSInfo struct {
	isExpr bool
	ds     *models.DataSource
	query  *simplejson.Json
	errRes response.Response
}

func (hs *HTTPServer) getDataSourceFromQuery(c *models.ReqContext, query *simplejson.Json) (info queryDSInfo) {
	var err error
	info.query = query
	uid := query.Get("datasource").Get("uid").MustString()

	switch uid {
	case expr.DatasourceUID:
		info.isExpr = true
		info.ds = expr.DataSourceModel((c.OrgId))
		return
	case grafanads.DatasourceUID:
		info.ds = grafanads.DataSourceModel(c.OrgId)
		return
	case "": // empty or mssing UID (old or invalid)
		break
	default:
		info.ds, err = hs.DataSourceCache.GetDatasourceByUID(uid, c.SignedInUser, c.SkipCache)
		if err != nil {
			info.errRes = hs.handleGetDataSourceUIDError(err, uid)
		}
		return
	}

	// Support legacy requets from before 8.3
	if query.Get("datasource").MustString() == expr.DatasourceType {
		info.isExpr = true
		info.ds = expr.DataSourceModel((c.OrgId))
		return
	}

	// Fallback to the datasourceId
	id, err := query.Get("datasourceId").Int64()
	if err != nil {
		info.errRes = response.Error(http.StatusBadRequest, "Query missing data source ID/UID", nil)
	} else {
		info.ds, err = hs.DataSourceCache.GetDatasource(id, c.SignedInUser, c.SkipCache)
		if err != nil {
			info.errRes = hs.handleGetDataSourceError(err, id)
		}
	}
	return info
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

func (hs *HTTPServer) handleGetDataSourceUIDError(err error, datasourceUID string) *response.NormalResponse {
	hs.log.Debug("Encountered error getting data source", "err", err, "uid", datasourceUID)
	if errors.Is(err, models.ErrDataSourceAccessDenied) {
		return response.Error(403, "Access denied to data source", err)
	}
	if errors.Is(err, models.ErrDataSourceNotFound) {
		return response.Error(400, "Invalid data source UID", err)
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
