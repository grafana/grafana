package query

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	publicDashboards "github.com/grafana/grafana/pkg/services/publicdashboards/queries"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/proxyutil"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
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
func (s *Service) QueryData(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest, handleExpressions bool) (*backend.QueryDataResponse, error) {
	parsedReq, err := s.parseMetricRequest(ctx, user, skipCache, reqDTO)
	if err != nil {
		return nil, err
	}
	if handleExpressions && parsedReq.hasExpression {
		return s.handleExpressions(ctx, user, parsedReq)
	}
	return s.handleQueryData(ctx, user, parsedReq)
}

// QueryData can process queries and return query responses.
func (s *Service) QueryDataMultipleSources(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest, handleExpressions bool) (*backend.QueryDataResponse, error) {
	byDataSource := publicDashboards.GroupQueriesByDataSource(reqDTO.Queries)

	// The expression service will handle mixed datasources, so we don't need to group them when an expression is present.
	if publicDashboards.HasExpressionQuery(reqDTO.Queries) || len(byDataSource) == 1 {
		return s.QueryData(ctx, user, skipCache, reqDTO, handleExpressions)
	} else {
		resp := backend.NewQueryDataResponse()

		// create new reqDTO with only the queries for that datasource
		for _, queries := range byDataSource {
			subDTO := reqDTO.CloneWithQueries(queries)

			subResp, err := s.QueryData(ctx, user, skipCache, subDTO, handleExpressions)

			if err != nil {
				return nil, err
			}

			for refId, queryResponse := range subResp.Responses {
				resp.Responses[refId] = queryResponse
			}
		}

		return resp, nil
	}
}

// handleExpressions handles POST /api/ds/query when there is an expression.
func (s *Service) handleExpressions(ctx context.Context, user *user.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	exprReq := expr.Request{
		Queries: []expr.Query{},
	}

	if user != nil { // for passthrough authentication, SSE does not authenticate
		exprReq.User = adapters.BackendUserFromSignedInUser(user)
		exprReq.OrgId = user.OrgID
	}

	disallowedCookies := []string{s.cfg.LoginCookieName}
	queryEnrichers := parsedReq.createDataSourceQueryEnrichers(ctx, user, s.oAuthTokenService, disallowedCookies)

	for _, pq := range parsedReq.parsedQueries {
		if pq.datasource == nil {
			return nil, ErrMissingDataSourceInfo.Build(errutil.TemplateData{
				Public: map[string]interface{}{
					"RefId": pq.query.RefID,
				},
			})
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
			QueryEnricher: queryEnrichers[pq.datasource.Uid],
		})
	}

	qdr, err := s.expressionService.TransformData(ctx, &exprReq)
	if err != nil {
		return nil, fmt.Errorf("expression request error: %w", err)
	}
	return qdr, nil
}

func (s *Service) handleQueryData(ctx context.Context, user *user.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	ds := parsedReq.parsedQueries[0].datasource
	if err := s.pluginRequestValidator.Validate(ds.Url, nil); err != nil {
		return nil, datasources.ErrDataSourceAccessDenied
	}

	instanceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return nil, err
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

	disallowedCookies := []string{s.cfg.LoginCookieName}
	middlewares := []httpclient.Middleware{}
	if parsedReq.httpRequest != nil {
		middlewares = append(middlewares,
			httpclientprovider.ForwardedCookiesMiddleware(parsedReq.httpRequest.Cookies(), ds.AllowedCookies(), disallowedCookies),
		)
	}

	if s.oAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := s.oAuthTokenService.GetCurrentOAuthToken(ctx, user); token != nil {
			req.Headers["Authorization"] = fmt.Sprintf("%s %s", token.Type(), token.AccessToken)

			idToken, ok := token.Extra("id_token").(string)
			if ok && idToken != "" {
				req.Headers["X-ID-Token"] = idToken
			}
			middlewares = append(middlewares, httpclientprovider.ForwardedOAuthIdentityMiddleware(token))
		}
	}

	if parsedReq.httpRequest != nil {
		proxyutil.ClearCookieHeader(parsedReq.httpRequest, ds.AllowedCookies(), disallowedCookies)
		if cookieStr := parsedReq.httpRequest.Header.Get("Cookie"); cookieStr != "" {
			req.Headers["Cookie"] = cookieStr
		}
	}

	for _, q := range parsedReq.parsedQueries {
		req.Queries = append(req.Queries, q.query)
	}

	ctx = httpclient.WithContextualMiddleware(ctx, middlewares...)

	return s.pluginClient.QueryData(ctx, req)
}

// parseRequest parses a request into parsed queries grouped by datasource uid
func (s *Service) parseMetricRequest(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*parsedRequest, error) {
	if len(reqDTO.Queries) == 0 {
		return nil, ErrNoQueriesFound
	}

	timeRange := legacydata.NewDataTimeRange(reqDTO.From, reqDTO.To)
	req := &parsedRequest{
		hasExpression: false,
		parsedQueries: []parsedQuery{},
	}

	// Parse the queries
	datasourcesByUid := map[string]*datasources.DataSource{}
	for _, query := range reqDTO.Queries {
		ds, err := s.getDataSourceFromQuery(ctx, user, skipCache, query, datasourcesByUid)
		if err != nil {
			return nil, err
		}
		if ds == nil {
			return nil, ErrInvalidDatasourceID
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
			return nil, ErrMultipleDatasources
		}
	}

	if reqDTO.HTTPRequest != nil {
		req.httpRequest = reqDTO.HTTPRequest
	}

	return req, nil
}

func (s *Service) getDataSourceFromQuery(ctx context.Context, user *user.SignedInUser, skipCache bool, query *simplejson.Json, history map[string]*datasources.DataSource) (*datasources.DataSource, error) {
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
		return grafanads.DataSourceModel(user.OrgID), nil
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

	return nil, ErrInvalidDatasourceID
}

func (s *Service) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return s.dataSourceService.DecryptedValues(ctx, ds)
	}
}
