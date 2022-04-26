package query

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	headerName  = "httpHeaderName"
	headerValue = "httpHeaderValue"
)

func ProvideService(
	cfg *setting.Cfg,
	dataSourceCache datasources.CacheService,
	expressionService *expr.Service,
	pluginRequestValidator models.PluginRequestValidator,
	dataSourceService datasources.DataSourceService,
	pluginClient plugins.Client,
	oAuthTokenService oauthtoken.OAuthTokenService,
) *Service {
	g := &Service{
		cfg:                    cfg,
		dataSourceCache:        dataSourceCache,
		expressionService:      expressionService,
		pluginRequestValidator: pluginRequestValidator,
		dataSourceService:      dataSourceService,
		pluginClient:           pluginClient,
		oAuthTokenService:      oAuthTokenService,
		log:                    log.New("query_data"),
	}
	g.log.Info("Query Service initialization")
	return g
}

type Service struct {
	cfg                    *setting.Cfg
	dataSourceCache        datasources.CacheService
	expressionService      *expr.Service
	pluginRequestValidator models.PluginRequestValidator
	dataSourceService      datasources.DataSourceService
	pluginClient           plugins.Client
	oAuthTokenService      oauthtoken.OAuthTokenService
	log                    log.Logger
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

// QueryData can process queries and return query responses.
func (s *Service) QueryData(ctx context.Context, user *models.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest, handleExpressions bool) (*backend.QueryDataResponse, error) {
	parsedReq, err := s.parseMetricRequest(ctx, user, skipCache, reqDTO)
	if err != nil {
		return nil, err
	}
	if handleExpressions && parsedReq.hasExpression {
		return s.handleExpressions(ctx, user, parsedReq)
	}
	return s.handleQueryData(ctx, user, parsedReq)
}

// handleExpressions handles POST /api/ds/query when there is an expression.
func (s *Service) handleExpressions(ctx context.Context, user *models.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	exprReq := expr.Request{
		OrgId:   user.OrgId,
		Queries: []expr.Query{},
	}

	for _, pq := range parsedReq.parsedQueries {
		if pq.datasource == nil {
			return nil, NewErrBadQuery(fmt.Sprintf("query mising datasource info: %s", pq.query.RefID))
		}

		exprReq.Queries = append(exprReq.Queries, expr.Query{
			JSON:          pq.query.JSON,
			Interval:      pq.query.Interval,
			RefID:         pq.query.RefID,
			MaxDataPoints: pq.query.MaxDataPoints,
			QueryType:     pq.query.QueryType,
			DataSource:    pq.datasource,
			TimeRange: expr.TimeRange{
				From: pq.query.TimeRange.From,
				To:   pq.query.TimeRange.To,
			},
		})
	}

	qdr, err := s.expressionService.TransformData(ctx, &exprReq)
	if err != nil {
		return nil, fmt.Errorf("expression request error: %w", err)
	}
	return qdr, nil
}

func (s *Service) handleQueryData(ctx context.Context, user *models.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	ds := parsedReq.parsedQueries[0].datasource
	if err := s.pluginRequestValidator.Validate(ds.Url, nil); err != nil {
		return nil, models.ErrDataSourceAccessDenied
	}

	instanceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to convert data source to instance settings: %w", err)
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgId,
			PluginID:                   ds.Type,
			User:                       adapters.BackendUserFromSignedInUser(user),
			DataSourceInstanceSettings: instanceSettings,
		},
		Headers: map[string]string{},
		Queries: []backend.DataQuery{},
	}

	if s.oAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := s.oAuthTokenService.GetCurrentOAuthToken(ctx, user); token != nil {
			req.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				req.Headers["X-ID-Token"] = idToken
			}
		}
	}

	for k, v := range customHeaders(ds.JsonData, instanceSettings.DecryptedSecureJSONData) {
		req.Headers[k] = v
	}

	for _, q := range parsedReq.parsedQueries {
		req.Queries = append(req.Queries, q.query)
	}

	return s.pluginClient.QueryData(ctx, req)
}

type parsedQuery struct {
	datasource *models.DataSource
	query      backend.DataQuery
}

type parsedRequest struct {
	hasExpression bool
	parsedQueries []parsedQuery
}

func customHeaders(jsonData *simplejson.Json, decryptedJsonData map[string]string) map[string]string {
	if jsonData == nil {
		return nil
	}

	data := jsonData.MustMap()

	headers := map[string]string{}
	for k := range data {
		if strings.HasPrefix(k, headerName) {
			if header, ok := data[k].(string); ok {
				valueKey := strings.ReplaceAll(k, headerName, headerValue)
				headers[header] = decryptedJsonData[valueKey]
			}
		}
	}

	return headers
}

func (s *Service) parseMetricRequest(ctx context.Context, user *models.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*parsedRequest, error) {
	if len(reqDTO.Queries) == 0 {
		return nil, NewErrBadQuery("no queries found")
	}

	timeRange := legacydata.NewDataTimeRange(reqDTO.From, reqDTO.To)
	req := &parsedRequest{
		hasExpression: false,
		parsedQueries: []parsedQuery{},
	}

	// Parse the queries
	datasourcesByUid := map[string]*models.DataSource{}
	for _, query := range reqDTO.Queries {
		ds, err := s.getDataSourceFromQuery(ctx, user, skipCache, query, datasourcesByUid)
		if err != nil {
			return nil, err
		}
		if ds == nil {
			return nil, NewErrBadQuery("invalid data source ID")
		}

		datasourcesByUid[ds.Uid] = ds
		if expr.IsDataSource(ds.Uid) {
			req.hasExpression = true
		}

		s.log.Debug("Processing metrics query", "query", query)

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
		if len(datasourcesByUid) > 1 {
			// We do not (yet) support mixed query type
			return nil, NewErrBadQuery("all queries must use the same datasource")
		}
	}

	return req, nil
}

func (s *Service) getDataSourceFromQuery(ctx context.Context, user *models.SignedInUser, skipCache bool, query *simplejson.Json, history map[string]*models.DataSource) (*models.DataSource, error) {
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
		return grafanads.DataSourceModel(user.OrgId), nil
	}

	// use datasourceId if it exists
	id := query.Get("datasourceId").MustInt64(0)
	if id > 0 {
		ds, err = s.dataSourceCache.GetDatasource(ctx, id, user, skipCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	if uid != "" {
		ds, err = s.dataSourceCache.GetDatasourceByUID(ctx, uid, user, skipCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	return nil, NewErrBadQuery("missing data source ID/UID")
}

func (s *Service) decryptSecureJsonDataFn(ctx context.Context) func(ds *models.DataSource) map[string]string {
	return func(ds *models.DataSource) map[string]string {
		decryptedJsonData, err := s.dataSourceService.DecryptedValues(ctx, ds)
		if err != nil {
			s.log.Error("Failed to decrypt secure json data", "error", err)
		}
		return decryptedJsonData
	}
}
