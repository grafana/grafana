package query

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"runtime"
	"slices"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"golang.org/x/sync/errgroup"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/mtdsclient"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

const (
	HeaderPluginID       = "X-Plugin-Id"       // can be used for routing
	HeaderDatasourceUID  = "X-Datasource-Uid"  // can be used for routing/ load balancing
	HeaderDashboardUID   = "X-Dashboard-Uid"   // mainly useful for debugging slow queries
	HeaderPanelID        = "X-Panel-Id"        // mainly useful for debugging slow queries
	HeaderDashboardTitle = "X-Dashboard-Title" // used for identifying the dashboard with heavy query load
	HeaderPanelTitle     = "X-Panel-Title"     // used for identifying the panel with heavy query load
	HeaderPanelPluginId  = "X-Panel-Plugin-Id"
	HeaderQueryGroupID   = "X-Query-Group-Id"    // mainly useful for finding related queries with query chunking
	HeaderFromExpression = "X-Grafana-From-Expr" // used by datasources to identify expression queries
)

func ProvideService(
	cfg *setting.Cfg,
	dataSourceCache datasources.CacheService,
	expressionService *expr.Service,
	dataSourceRequestValidator validations.DataSourceRequestValidator,
	pluginClient plugins.Client,
	pCtxProvider *plugincontext.Provider,
	mtDatasourceClientBuilder mtdsclient.MTDatasourceClientBuilder,
) *ServiceImpl {
	g := &ServiceImpl{
		cfg:                        cfg,
		dataSourceCache:            dataSourceCache,
		expressionService:          expressionService,
		dataSourceRequestValidator: dataSourceRequestValidator,
		pluginClient:               pluginClient,
		pCtxProvider:               pCtxProvider,
		log:                        log.New("query_data"),
		concurrentQueryLimit:       cfg.SectionWithEnvOverrides("query").Key("concurrent_query_limit").MustInt(runtime.NumCPU()),
		mtDatasourceClientBuilder:  mtDatasourceClientBuilder,
	}
	g.log.Info("Query Service initialization")
	return g
}

//go:generate mockery --name Service --structname FakeQueryService --inpackage --filename query_service_mock.go
type Service interface {
	Run(ctx context.Context) error
	QueryData(ctx context.Context, user identity.Requester, skipDSCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error)
}

// Gives us compile time error if the service does not adhere to the contract of the interface
var _ Service = (*ServiceImpl)(nil)

type ServiceImpl struct {
	cfg                        *setting.Cfg
	dataSourceCache            datasources.CacheService
	expressionService          *expr.Service
	dataSourceRequestValidator validations.DataSourceRequestValidator
	pluginClient               plugins.Client
	pCtxProvider               *plugincontext.Provider
	log                        log.Logger
	concurrentQueryLimit       int
	mtDatasourceClientBuilder  mtdsclient.MTDatasourceClientBuilder
	headers                    map[string]string
}

// Run ServiceImpl.
func (s *ServiceImpl) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

// QueryData processes queries and returns query responses. It handles queries to single or mixed datasources, as well as expressions.
func (s *ServiceImpl) QueryData(ctx context.Context, user identity.Requester, skipDSCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error) {
	fromAlert := false
	for header, val := range s.headers {
		if header == models.FromAlertHeaderName && val == "true" {
			fromAlert = true
		}
	}
	// Parse the request into parsed queries grouped by datasource uid
	parsedReq, err := s.parseMetricRequest(ctx, user, skipDSCache, reqDTO)
	if err != nil {
		return nil, err
	}

	// If there are expressions, handle them and return
	if parsedReq.hasExpression || fromAlert {
		return s.handleExpressions(ctx, user, parsedReq)
	}
	// If there is only one datasource, query it and return
	if len(parsedReq.parsedQueries) == 1 {
		return s.handleQuerySingleDatasource(ctx, user, parsedReq)
	}
	// If there are multiple datasources, handle their queries concurrently and return the aggregate result
	return s.executeConcurrentQueries(ctx, user, skipDSCache, reqDTO, parsedReq.parsedQueries)
}

// splitResponse contains the results of a concurrent data source query - the response and any headers
type splitResponse struct {
	responses backend.Responses
	header    http.Header
}

// executeConcurrentQueries executes queries to multiple datasources concurrently and returns the aggregate result.
func (s *ServiceImpl) executeConcurrentQueries(ctx context.Context, user identity.Requester, skipDSCache bool, reqDTO dtos.MetricRequest, queriesbyDs map[string][]parsedQuery) (*backend.QueryDataResponse, error) {
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(s.concurrentQueryLimit) // prevent too many concurrent requests
	rchan := make(chan splitResponse, len(queriesbyDs))

	// Create panic recovery function for loop below
	recoveryFn := func(queries []*simplejson.Json) {
		if r := recover(); r != nil {
			var err error
			s.log.Error("query datasource panic", "error", r, "stack", log.Stack(1))
			if theErr, ok := r.(error); ok {
				err = theErr
			} else if theErrString, ok := r.(string); ok {
				err = errors.New(theErrString)
			} else {
				err = fmt.Errorf("unexpected error - %s", s.cfg.UserFacingDefaultError)
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

			ctxCopy := contexthandler.CopyWithReqContext(ctx)
			subResp, err := s.QueryData(ctxCopy, user, skipDSCache, subDTO)
			if err == nil {
				reqCtx, header := contexthandler.FromContext(ctxCopy), http.Header{}
				if reqCtx != nil {
					header = reqCtx.Resp.Header()
				}
				rchan <- splitResponse{subResp.Responses, header}
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
	reqCtx := contexthandler.FromContext(ctx)
	for result := range rchan {
		for refId, dataResponse := range result.responses {
			resp.Responses[refId] = dataResponse
		}
		if reqCtx != nil {
			for k, v := range result.header {
				for _, val := range v {
					if !slices.Contains(reqCtx.Resp.Header().Values(k), val) {
						reqCtx.Resp.Header().Add(k, val)
					} else {
						s.log.Warn("skipped duplicate response header", "header", k, "value", val)
					}
				}
			}
		}
	}

	return resp, nil
}

// buildErrorResponses applies the provided error to each query response in the list. These queries should all belong to the same datasource.
func buildErrorResponses(err error, queries []*simplejson.Json) splitResponse {
	er := backend.Responses{}
	for _, query := range queries {
		er[query.Get("refId").MustString("A")] = backend.DataResponse{
			Error: err,
		}
	}
	return splitResponse{er, http.Header{}}
}

func QueryData(ctx context.Context, log log.Logger, dscache datasources.CacheService, exprService *expr.Service, reqDTO dtos.MetricRequest, mtDatasourceClientBuilder mtdsclient.MTDatasourceClientBuilder, headers map[string]string) (*backend.QueryDataResponse, error) {
	s := &ServiceImpl{
		log:                        log,
		dataSourceCache:            dscache,
		expressionService:          exprService,
		dataSourceRequestValidator: validations.ProvideValidator(),
		mtDatasourceClientBuilder:  mtDatasourceClientBuilder,
		headers:                    headers,
	}
	return s.QueryData(ctx, nil, false, reqDTO)
}

// handleExpressions handles queries when there is an expression.
func (s *ServiceImpl) handleExpressions(ctx context.Context, user identity.Requester, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	exprReq := expr.Request{
		Queries: []expr.Query{},
	}

	if user != nil { // for passthrough authentication, SSE does not authenticate
		exprReq.User = user
		exprReq.OrgId = user.GetOrgID()
	}

	for _, pq := range parsedReq.getFlattenedQueries() {
		if pq.datasource == nil {
			return nil, ErrMissingDataSourceInfo.Build(errutil.TemplateData{
				Public: map[string]any{
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
func (s *ServiceImpl) handleQuerySingleDatasource(ctx context.Context, user identity.Requester, parsedReq *parsedRequest) (*backend.QueryDataResponse, error) {
	queries := parsedReq.getFlattenedQueries()
	ds := queries[0].datasource
	if err := s.dataSourceRequestValidator.Validate(ds, nil); err != nil {
		return nil, datasources.ErrDataSourceAccessDenied
	}

	// ensure that each query passed to this function has the same datasource
	for _, pq := range queries {
		if ds.UID != pq.datasource.UID {
			return nil, fmt.Errorf("all queries must have the same datasource - found %s and %s", ds.UID, pq.datasource.UID)
		}
	}

	req := &backend.QueryDataRequest{
		Headers: map[string]string{},
		Queries: []backend.DataQuery{},
	}

	for _, q := range queries {
		req.Queries = append(req.Queries, q.query)
	}

	mtDsClient, ok := s.mtDatasourceClientBuilder.BuildClient(ds.Type, ds.UID)
	if !ok { // single tenant flow
		pCtx, err := s.pCtxProvider.GetWithDataSource(ctx, ds.Type, user, ds)
		if err != nil {
			return nil, err
		}
		req.PluginContext = pCtx
		return s.pluginClient.QueryData(ctx, req)
	} else { // multi tenant flow
		// transform request from backend.QueryDataRequest to k8s request
		k8sReq := &data.QueryDataRequest{
			TimeRange: data.TimeRange{
				From: req.Queries[0].TimeRange.From.Format(time.RFC3339),
				To:   req.Queries[0].TimeRange.To.Format(time.RFC3339),
			},
		}
		for _, q := range req.Queries {
			var dataQuery data.DataQuery
			err := json.Unmarshal(q.JSON, &dataQuery)
			if err != nil {
				return nil, err
			}

			k8sReq.Queries = append(k8sReq.Queries, dataQuery)
		}
		return mtDsClient.QueryData(ctx, *k8sReq)
	}
}

// parseRequest parses a request into parsed queries grouped by datasource uid
func (s *ServiceImpl) parseMetricRequest(ctx context.Context, user identity.Requester, skipDSCache bool, reqDTO dtos.MetricRequest) (*parsedRequest, error) {
	if len(reqDTO.Queries) == 0 {
		return nil, ErrNoQueriesFound
	}

	timeRange := gtime.NewTimeRange(reqDTO.From, reqDTO.To)
	req := &parsedRequest{
		hasExpression: false,
		parsedQueries: make(map[string][]parsedQuery),
		dsTypes:       make(map[string]bool),
	}

	// Parse the queries and store them by datasource
	datasourcesByUid := map[string]*datasources.DataSource{}
	for _, query := range reqDTO.Queries {
		ds, err := s.getDataSourceFromQuery(ctx, user, skipDSCache, query, datasourcesByUid)
		if err != nil {
			return nil, err
		}
		if ds == nil {
			return nil, ErrInvalidDatasourceID
		}

		datasourcesByUid[ds.UID] = ds
		if expr.NodeTypeFromDatasourceUID(ds.UID) != expr.TypeDatasourceNode {
			req.hasExpression = true
		} else {
			req.dsTypes[ds.Type] = true
		}

		if _, ok := req.parsedQueries[ds.UID]; !ok {
			req.parsedQueries[ds.UID] = []parsedQuery{}
		}

		modelJSON, err := query.MarshalJSON()
		if err != nil {
			return nil, err
		}

		pq := parsedQuery{
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
		}
		req.parsedQueries[ds.UID] = append(req.parsedQueries[ds.UID], pq)

		s.log.Debug("Processed metrics query",
			"ref_id", pq.query.RefID,
			"from", timeRange.GetFromAsMsEpoch(),
			"to", timeRange.GetToAsMsEpoch(),
			"interval", pq.query.Interval.Milliseconds(),
			"max_data_points", pq.query.MaxDataPoints,
			"query", string(modelJSON))
	}

	return req, req.validateRequest(ctx)
}

func (s *ServiceImpl) getDataSourceFromQuery(ctx context.Context, user identity.Requester, skipDSCache bool, query *simplejson.Json, history map[string]*datasources.DataSource) (*datasources.DataSource, error) {
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

	if kind := expr.NodeTypeFromDatasourceUID(uid); kind != expr.TypeDatasourceNode {
		return expr.DataSourceModelFromNodeType(kind)
	}

	if uid == grafanads.DatasourceUID {
		return grafanads.DataSourceModel(user.GetOrgID()), nil
	}

	if uid != "" {
		ds, err = s.dataSourceCache.GetDatasourceByUID(ctx, uid, user, skipDSCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	// use datasourceId if it exists
	id := query.Get("datasourceId").MustInt64(0)
	if id > 0 {
		ds, err = s.dataSourceCache.GetDatasource(ctx, id, user, skipDSCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	return nil, ErrInvalidDatasourceID
}
