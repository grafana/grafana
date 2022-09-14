package grpcserver

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/adapters"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
	"google.golang.org/grpc"
)

type DatasourceService struct {
	cfg    *setting.Cfg
	server *DatasourceServer
}

func ProvideDatasourceService(cfg *setting.Cfg, grpcServerProvider Provider, pluginsClient plugins.Client, dataSourceCache datasources.CacheService, dataSourceService datasources.DataSourceService) (*DatasourceService, error) {
	return &DatasourceService{
		cfg: cfg,
		server: &DatasourceServer{
			pluginClient:      pluginsClient,
			dataSourceCache:   dataSourceCache,
			dataSourceService: dataSourceService,
		},
	}, nil
}

func (s *DatasourceService) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *DatasourceService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrpcServer)
}

type DatasourceServer struct {
	pluginClient      plugins.Client
	dataSourceCache   datasources.CacheService
	dataSourceService datasources.DataSourceService
}

// QueryData handles multiple queries and returns multiple responses.
func (s *DatasourceServer) QueryData(ctx context.Context, in *pluginv2.QueryDataRequest, opts ...grpc.CallOption) (*pluginv2.QueryDataResponse, error) {
	var ds *datasources.DataSource
	req := backend.FromProto().QueryDataRequest(in)
	user := adapters.SignedInUserFromBackendUser(req.PluginContext.User)

	for _, query := range req.Queries {
		sj, err := simplejson.NewJson(query.JSON)
		if err != nil {
			continue
		}
		ds, _ = s.getDataSourceFromQuery(ctx, user, false, sj)
	}

	if ds == nil {
		return nil, fmt.Errorf("failed to get data source")
	}

	instanceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJsonDataFn(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to convert data source to instance settings: %w", err)
	}
	req.PluginContext.DataSourceInstanceSettings = instanceSettings

	res, err := s.pluginClient.QueryData(ctx, req)
	if err != nil {
		return nil, err
	}

	return backend.ToProto().QueryDataResponse(res)
}

// TODO: can this be shared with the query service?
func (s *DatasourceServer) getDataSourceFromQuery(ctx context.Context, signedInUser *user.SignedInUser, skipCache bool, query *simplejson.Json) (*datasources.DataSource, error) {
	uid := query.Get("datasource").Get("uid").MustString()

	// before 8.3 special types could be sent as datasource (expr)
	if uid == "" {
		uid = query.Get("datasource").MustString()
	}

	if expr.IsDataSource(uid) {
		return expr.DataSourceModel(), nil
	}

	if uid == grafanads.DatasourceUID {
		return grafanads.DataSourceModel(signedInUser.OrgID), nil
	}

	// use datasourceId if it exists
	id := query.Get("datasourceId").MustInt64(0)
	if id > 0 {
		ds, err := s.dataSourceCache.GetDatasource(ctx, id, signedInUser, skipCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	if uid != "" {
		ds, err := s.dataSourceCache.GetDatasourceByUID(ctx, uid, signedInUser, skipCache)
		if err != nil {
			return nil, err
		}
		return ds, nil
	}

	return nil, fmt.Errorf("missing data source ID/UID")
}

// TODO: can this be shared with the query service?
func (s *DatasourceServer) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return s.dataSourceService.DecryptedValues(ctx, ds)
	}
}
