package query

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	HeaderPluginID       = "X-Plugin-Id"         // can be used for routing
	HeaderDatasourceUID  = "X-Datasource-Uid"    // can be used for routing/ load balancing
	HeaderDashboardUID   = "X-Dashboard-Uid"     // mainly useful for debuging slow queries
	HeaderPanelID        = "X-Panel-Id"          // mainly useful for debuging slow queries
	HeaderQueryGroupID   = "X-Query-Group-Id"    // mainly useful for finding related queries with query chunking
	HeaderFromExpression = "X-Grafana-From-Expr" // used by datasources to identify expression queries
)

func ProvideService(
	cfg *setting.Cfg,
	dataSourceCache datasources.CacheService,
	expressionService *expr.Service,
	pluginRequestValidator validations.PluginRequestValidator,
	dataSourceService datasources.DataSourceService,
	pluginClient plugins.Client,
) *ServiceImpl {
	g := &ServiceImpl{
		cfg:                    cfg,
		dataSourceCache:        dataSourceCache,
		expressionService:      expressionService,
		pluginRequestValidator: pluginRequestValidator,
		dataSourceService:      dataSourceService,
		pluginClient:           pluginClient,
		log:                    log.New("query_data"),
	}
	g.log.Info("Query Service initialization")
	return g
}

//go:generate mockery --name Service --structname FakeQueryService --inpackage --filename query_service_mock.go
type Service interface {
	Run(ctx context.Context) error
	QueryData(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error)
}

// Gives us compile time error if the service does not adhere to the contract of the interface
var _ Service = (*ServiceImpl)(nil)

type ServiceImpl struct {
	cfg                    *setting.Cfg
	dataSourceCache        datasources.CacheService
	expressionService      *expr.Service
	pluginRequestValidator validations.PluginRequestValidator
	dataSourceService      datasources.DataSourceService
	pluginClient           plugins.Client
	log                    log.Logger
}

// Run ServiceImpl.
func (s *ServiceImpl) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

// QueryData processes queries and returns query responses. It handles queries to single or mixed datasources, as well as expressions.
func (s *ServiceImpl) QueryData(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error) {
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
	return s.executeConcurrentQueries(ctx, user, skipCache, reqDTO, parsedReq.parsedQueries)
}

// executeConcurrentQueries executes queries to multiple datasources concurrently and returns the aggregate result.
func (s *ServiceImpl) executeConcurrentQueries(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest, queriesbyDs map[string][]parsedQuery) (*backend.QueryDataResponse, error) {
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(8) // arbitrary limit to prevent too many concurrent requests
	rchan := make(chan backend.Responses, len(queriesbyDs))

	// Create panic recovery function for loop below
	recoveryFn := func(queries []*simplejson.Json) {
		if r := recover(); r != nil {
			var err error
			s.log.Error("query datasource panic", "error", r, "stack", log.Stack(1))
			if theErr, ok := r.(error); ok {
				err = theErr
			} else if theErrString, ok := r.(string); ok {
				err = fmt.Errorf(theErrString)
			} else {
				err = fmt.Errorf("unexpected error, see the server log for details")
			}
			// Due to the panic, there is no valid response for any query for this datasource. Append an error for each one.
			rchan <- buildErrorResponses(err, queries)
		}
	}

	// Query each datasource concurrently
	for _, queries := range queriesbyDs {
		rawQueries := make([]*simplejson.Json, len(queries))
		for i := 0; i < len(queries); i++ {
			rawQueries[i] = queries[i].rawQuery
		}
		g.Go(func() error {
			subDTO := reqDTO.CloneWithQueries(rawQueries)
			// Handle panics in the datasource qery
			defer recoveryFn(subDTO.Queries)

			subResp, err := s.QueryData(ctx, user, skipCache, subDTO)
			if err == nil {
				rchan <- subResp.Responses
			} else {
				// If there was an error, return an error response for each query for this datasource
				rchan <- buildErrorResponses(err, subDTO.Queries)
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	close(rchan)
	resp := backend.NewQueryDataResponse()
	for result := range rchan {
		for refId, dataResponse := range result {
			resp.Responses[refId] = dataResponse
		}
	}

	return resp, nil
}

// buildErrorResponses applies the provided error to each query response in the list. These queries should all belong to the same datasource.
func buildErrorResponses(err error, queries []*simplejson.Json) backend.Responses {
	er := backend.Responses{}
	for _, query := range queries {
		er[query.Get("refId").MustString("A")] = backend.DataResponse{
			Error: err,
		}
	}
	return er
}

// handleExpressions handles POST /api/ds/query when there is an expression.
func (s *ServiceImpl) handleExpressions(ctx context.Context, user *user.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
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
func (s *ServiceImpl) handleQuerySingleDatasource(ctx context.Context, user *user.SignedInUser, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	queries := parsedReq.getFlattenedQueries()
	ds := queries[0].datasource
	if err := s.pluginRequestValidator.Validate(ds.URL, nil); err != nil {
		return nil, datasources.ErrDataSourceAccessDenied
	}

	// ensure that each query passed to this function has the same datasource
	for _, pq := range queries {
		if ds.UID != pq.datasource.UID {
			return nil, fmt.Errorf("all queries must have the same datasource - found %s and %s", ds.UID, pq.datasource.UID)
		}
	}

	instanceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return nil, err
	}

	req := &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{
			OrgID:                      ds.OrgID,
			PluginID:                   ds.Type,
			User:                       adapters.BackendUserFromSignedInUser(user),
			DataSourceInstanceSettings: instanceSettings,
		},
		Headers: map[string]string{},
		Queries: []backend.DataQuery{},
	}

	for _, q := range queries {
		req.Queries = append(req.Queries, q.query)
	}

	return s.pluginClient.QueryData(ctx, req)
}

// parseRequest parses a request into parsed queries grouped by datasource uid
func (s *ServiceImpl) parseMetricRequest(ctx context.Context, user *user.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*parsedRequest, error) {
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

		datasourcesByUid[ds.UID] = ds
		if expr.IsDataSource(ds.UID) {
			req.hasExpression = true
		} else {
			req.dsTypes[ds.Type] = true
		}

		if _, ok := req.parsedQueries[ds.UID]; !ok {
			req.parsedQueries[ds.UID] = []parsedQuery{}
		}

		s.log.Debug("Processing metrics query", "query", query)

		modelJSON, err := query.MarshalJSON()
		if err != nil {
			return nil, err
		}

		req.parsedQueries[ds.UID] = append(req.parsedQueries[ds.UID], parsedQuery{
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

	return req, req.validateRequest(ctx)
}

func (s *ServiceImpl) getDataSourceFromQuery(ctx context.Context, user *user.SignedInUser, skipCache bool, query *simplejson.Json, history map[string]*datasources.DataSource) (*datasources.DataSource, error) {
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

	if uid != "" {
		ds, err = s.dataSourceCache.GetDatasourceByUID(ctx, uid, user, skipCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
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

	return nil, ErrInvalidDatasourceID
}

func (s *ServiceImpl) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return s.dataSourceService.DecryptedValues(ctx, ds)
	}
}
