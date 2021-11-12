package query

import (
	"context"
	"errors"
	"fmt"
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
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("query_data")
)

func ProvideService(cfg *setting.Cfg, dataSourceCache datasources.CacheService, expressionService *expr.Service,
	pluginRequestValidator models.PluginRequestValidator, SecretsService secrets.Service,
	pluginClient plugins.Client, OAuthTokenService oauthtoken.OAuthTokenService) *Service {
	logger.Info("Query Service initialization")
	g := &Service{
		Cfg:                    cfg,
		DataSourceCache:        dataSourceCache,
		expressionService:      expressionService,
		PluginRequestValidator: pluginRequestValidator,
		SecretsService:         SecretsService,
		pluginClient:           pluginClient,
		OAuthTokenService:      OAuthTokenService,
	}
	return g
}

// Gateway receives data and translates it to Grafana Live publications.
type Service struct {
	Cfg                    *setting.Cfg
	DataSourceCache        datasources.CacheService
	expressionService      *expr.Service
	PluginRequestValidator models.PluginRequestValidator
	SecretsService         secrets.Service
	pluginClient           plugins.Client
	OAuthTokenService      oauthtoken.OAuthTokenService
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *Service) QueryData(ctx context.Context, u *models.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error) {
	if len(reqDTO.Queries) == 0 {
		return nil, errors.New("no queries found in query")
		//return response.Error(http.StatusBadRequest, "No queries found in query", nil)
	}

	timeRange := legacydata.NewDataTimeRange(reqDTO.From, reqDTO.To)
	request := legacydata.DataQuery{
		TimeRange: &timeRange,
		Debug:     reqDTO.Debug,
		User:      u,
		Queries:   make([]legacydata.DataSubQuery, 0, len(reqDTO.Queries)),
	}

	// Parse the queries
	hasExpression := false
	dss := make(map[string]*models.DataSource, len(reqDTO.Queries))
	for _, query := range reqDTO.Queries {
		ds, errRsp := s.getDataSourceFromQuery(u, skipCache, query, dss)
		if errRsp != nil {
			return nil, errRsp
		}
		//if ds == nil {
		//	return response.Error(http.StatusBadRequest, "Datasource not found for query", nil)
		//}

		dss[ds.Uid] = ds
		if expr.IsDataSource(ds.Uid) {
			hasExpression = true
		}

		//s.log.Debug("Processing metrics query", "query", query)

		request.Queries = append(request.Queries, legacydata.DataSubQuery{
			RefID:         query.Get("refId").MustString("A"),
			MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
			IntervalMS:    query.Get("intervalMs").MustInt64(1000),
			QueryType:     query.Get("queryType").MustString(""),
			Model:         query,
			DataSource:    ds,
		})
	}

	if hasExpression {
		qdr, err := s.expressionService.WrapTransformData(ctx, request)
		if err != nil {
			return nil, err
			//return response.Error(500, "expression request error", err)
		}
		return qdr, nil
		//return toMacronResponse(qdr)
	}

	ds := request.Queries[0].DataSource
	if len(dss) > 1 {
		// We do not (yet) support mixed query type
		return nil, errors.New("all queries must use the same datasource")
		//return response.Error(http.StatusBadRequest, "All queries must use the same datasource", nil)
	}

	err := s.PluginRequestValidator.Validate(ds.Url, nil)
	if err != nil {
		return nil, err
		//return response.Error(http.StatusForbidden, "Access denied", err)
	}

	req, err := s.createRequest(ctx, ds, request)
	if err != nil {
		return nil, err
		//return response.Error(http.StatusBadRequest, "Request formation error", err)
	}

	resp, err := s.pluginClient.QueryData(ctx, req)
	if err != nil {
		return nil, err
		//return response.Error(http.StatusInternalServerError, "Metric request error", err)
	}
	return resp, err
}

func (s *Service) getDataSourceFromQuery(u *models.SignedInUser, skipCache bool, query *simplejson.Json, history map[string]*models.DataSource) (*models.DataSource, error) {
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
		return grafanads.DataSourceModel(u.OrgId), nil
	}

	// use datasourceId if it exists
	id := query.Get("datasourceId").MustInt64(0)
	if id > 0 {
		ds, err = s.DataSourceCache.GetDatasource(id, u, skipCache)
		if err != nil {
			return nil, errors.New("get ds error")
			//return nil, s.handleGetDataSourceError(err, id)
		}
		return ds, nil
	}

	if uid != "" {
		ds, err = s.DataSourceCache.GetDatasourceByUID(uid, u, skipCache)
		if err != nil {
			return nil, errors.New("get ds error")
			//return nil, s.handleGetDataSourceError(err, uid)
		}
		return ds, nil
	}

	return nil, errors.New("query missing data source ID/UID")
	//return nil, response.Error(http.StatusBadRequest, "Query missing data source ID/UID", nil)
}

func (s *Service) createRequest(ctx context.Context, ds *models.DataSource, query legacydata.DataQuery) (*backend.QueryDataRequest, error) {
	instanceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJsonDataFn())
	if err != nil {
		return nil, err
	}

	if query.Headers == nil {
		query.Headers = make(map[string]string)
	}

	if s.OAuthTokenService.IsOAuthPassThruEnabled(ds) {
		if token := s.OAuthTokenService.GetCurrentOAuthToken(ctx, query.User); token != nil {
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

func (s *Service) decryptSecureJsonDataFn() func(map[string][]byte) map[string]string {
	return func(m map[string][]byte) map[string]string {
		decryptedJsonData, err := s.SecretsService.DecryptJsonData(context.Background(), m)
		if err != nil {
			//s.log.Error("Failed to decrypt secure json data", "error", err)
		}
		return decryptedJsonData
	}
}
