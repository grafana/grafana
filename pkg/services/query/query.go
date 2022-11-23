package query

import (
	"context"
	"fmt"
	"net/http"
	"strings"
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
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/proxyutil"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"golang.org/x/sync/errgroup"
)

const (
	HeaderPluginID      = "X-Plugin-Id"      // can be used for routing
	HeaderDatasourceUID = "X-Datasource-Uid" // can be used for routing/ load balancing
	HeaderDashboardUID  = "X-Dashboard-Uid"  // mainly useful for debuging slow queries
	HeaderPanelID       = "X-Panel-Id"       // mainly useful for debuging slow queries
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

// QueryData processes queries and returns query responses. It handles queries to single or mixed datasources, as well as expressions.
func (s *Service) QueryData(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error) {
	// Parse the request into parsed queries grouped by datasource uid
	parsedReq, err := s.parseMetricRequest(ctx, user, skipCache, reqDTO)
	if err != nil {
		return nil, err
	}

	// If there are expressions, handle them and return
	if parsedReq.hasExpression {
		return s.handleExpressions(ctx, user, parsedReq)
	}
	// If there is only one datasource, query it and return
	if len(parsedReq.parsedQueries) == 1 {
		return s.handleQuerySingleDatasource(ctx, user, parsedReq)
	}
	// If there are multiple datasources, handle their queries concurrently and return the aggregate result
	byDataSource := parsedReq.parsedQueries
	resp := backend.NewQueryDataResponse()

	g, ctx := errgroup.WithContext(ctx)
	results := make([]backend.Responses, len(byDataSource))

	for _, queries := range byDataSource {
		rawQueries := make([]*simplejson.Json, len(queries))
		for i := 0; i < len(queries); i++ {
			rawQueries[i] = queries[i].rawQuery
		}
		g.Go(func() error {
			subDTO := reqDTO.CloneWithQueries(rawQueries)

			subResp, err := s.QueryData(ctx, user, skipCache, subDTO)

			if err == nil {
				results = append(results, subResp.Responses)
			}

			return err
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	for _, result := range results {
		for refId, dataResponse := range result {
			resp.Responses[refId] = dataResponse
		}
	}

	return resp, nil
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

	for _, pq := range parsedReq.getFlattenedQueries() {
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
			TimeRange: expr.AbsoluteTimeRange{
				From: pq.query.TimeRange.From,
				To:   pq.query.TimeRange.To,
			},
		})
	}

	qdr, err := s.expressionService.TransformData(ctx, time.Now(), &exprReq) // use time now because all queries have absolute time range
	if err != nil {
		return nil, fmt.Errorf("expression request error: %w", err)
	}
	return qdr, nil
}

// handleQuerySingleDatasource handles one or more queries to a single datasource
func (s *Service) handleQuerySingleDatasource(ctx context.Context, user *user.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	queries := parsedReq.getFlattenedQueries()
	ds := queries[0].datasource
	if err := s.pluginRequestValidator.Validate(ds.Url, nil); err != nil {
		return nil, datasources.ErrDataSourceAccessDenied
	}

	// ensure that each query passed to this function has the same datasource
	for _, pq := range queries {
		if ds.Uid != pq.datasource.Uid {
			return nil, fmt.Errorf("all queries must have the same datasource - found %s and %s", ds.Uid, pq.datasource.Uid)
		}
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

	middlewares := []httpclient.Middleware{}
	if parsedReq.httpRequest != nil {
		middlewares = append(middlewares,
			httpclientprovider.ForwardedCookiesMiddleware(parsedReq.httpRequest.Cookies(), ds.AllowedCookies(), []string{s.cfg.LoginCookieName}),
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
		proxyutil.ClearCookieHeader(parsedReq.httpRequest, ds.AllowedCookies(), []string{s.cfg.LoginCookieName})
		if cookieStr := parsedReq.httpRequest.Header.Get("Cookie"); cookieStr != "" {
			req.Headers["Cookie"] = cookieStr
		}
	}

	for _, q := range queries {
		req.Queries = append(req.Queries, q.query)
	}

	ctx = httpclient.WithContextualMiddleware(ctx, middlewares...)

	return s.pluginClient.QueryData(ctx, req)
}

type parsedQuery struct {
	datasource *datasources.DataSource
	query      backend.DataQuery
	rawQuery   *simplejson.Json
}

type parsedRequest struct {
	hasExpression bool
	parsedQueries map[string][]parsedQuery
	dsTypes       map[string]bool
	httpRequest   *http.Request
}

func (pr parsedRequest) getFlattenedQueries() []parsedQuery {
	queries := make([]parsedQuery, 0)
	for _, pq := range pr.parsedQueries {
		queries = append(queries, pq...)
	}
	return queries
}

func (pr parsedRequest) validateRequest() error {
	if pr.httpRequest == nil {
		return nil
	}

	if pr.hasExpression {
		hasExpr := pr.httpRequest.URL.Query().Get("expression")
		if hasExpr == "" || hasExpr == "true" {
			return nil
		}
		return ErrQueryParamMismatch
	}

	vals := splitHeaders(pr.httpRequest.Header.Values(HeaderDatasourceUID))
	count := len(vals)
	if count > 0 { // header exists
		if count != len(pr.parsedQueries) {
			return ErrQueryParamMismatch
		}
		for _, t := range vals {
			if pr.parsedQueries[t] == nil {
				return ErrQueryParamMismatch
			}
		}
	}

	vals = splitHeaders(pr.httpRequest.Header.Values(HeaderPluginID))
	count = len(vals)
	if count > 0 { // header exists
		if count != len(pr.dsTypes) {
			return ErrQueryParamMismatch
		}
		for _, t := range vals {
			if !pr.dsTypes[t] {
				return ErrQueryParamMismatch
			}
		}
	}
	return nil
}

func splitHeaders(headers []string) []string {
	out := []string{}
	for _, v := range headers {
		if strings.Contains(v, ",") {
			for _, sub := range strings.Split(v, ",") {
				out = append(out, strings.TrimSpace(sub))
			}
		} else {
			out = append(out, v)
		}
	}
	return out
}

// parseRequest parses a request into parsed queries grouped by datasource uid
func (s *Service) parseMetricRequest(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*parsedRequest, error) {
	if len(reqDTO.Queries) == 0 {
		return nil, ErrNoQueriesFound
	}

	timeRange := legacydata.NewDataTimeRange(reqDTO.From, reqDTO.To)
	req := &parsedRequest{
		hasExpression: false,
		parsedQueries: make(map[string][]parsedQuery),
		dsTypes:       make(map[string]bool),
	}

	// Parse the queries and store them by datasource
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
		} else {
			req.dsTypes[ds.Type] = true
		}

		if _, ok := req.parsedQueries[ds.Uid]; !ok {
			req.parsedQueries[ds.Uid] = []parsedQuery{}
		}

		s.log.Debug("Processing metrics query", "query", query)

		modelJSON, err := query.MarshalJSON()
		if err != nil {
			return nil, err
		}

		req.parsedQueries[ds.Uid] = append(req.parsedQueries[ds.Uid], parsedQuery{
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
			rawQuery: query,
		})
	}

	if reqDTO.HTTPRequest != nil {
		req.httpRequest = reqDTO.HTTPRequest
	}

	return req, req.validateRequest()
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
