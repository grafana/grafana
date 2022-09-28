package grpcserver

import (
	"context"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type QueryDataService struct {
	cfg    *setting.Cfg
	server *queryDataServer
}

func ProvideQueryDataService(cfg *setting.Cfg, grpcServerProvider Provider, queryService *query.Service, dataSourceCache datasources.CacheService, dataSourceService datasources.DataSourceService) (*QueryDataService, error) {
	server := &queryDataServer{
		logger:            log.New("grpc-server-query-data"),
		queryService:      queryService,
		dataSourceCache:   dataSourceCache,
		dataSourceService: dataSourceService,
	}
	pluginv2.RegisterDataServer(grpcServerProvider.GetServer(), server)
	return &QueryDataService{
		cfg:    cfg,
		server: server,
	}, nil
}

type queryDataServer struct {
	logger            log.Logger
	queryService      *query.Service
	dataSourceCache   datasources.CacheService
	dataSourceService datasources.DataSourceService
}

// QueryData handles multiple queries run against multiple datasources.
func (s *queryDataServer) QueryData(ctx context.Context, in *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	req := backend.FromProto().QueryDataRequest(in)

	// This allows the plugin to execute queries 'on behalf of' any user
	// Given that the connection requires an admin token to run, this is OK
	// However, we need to implement a more robust auth/token passing system
	user := signedInUserFromBackendUser(req.PluginContext.User)
	user.OrgID = req.PluginContext.OrgID

	metricReq := dtos.MetricRequest{
		From:    strconv.FormatInt(req.Queries[0].TimeRange.From.UnixMilli(), 10),
		To:      strconv.FormatInt(req.Queries[0].TimeRange.To.UnixMilli(), 10),
		Queries: make([]*simplejson.Json, 0),
	}

	for _, q := range req.Queries {
		sj, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, err
		}
		metricReq.Queries = append(metricReq.Queries, sj)
	}

	response, err := s.queryService.QueryDataMultipleSources(ctx, user, false, metricReq, true)
	if err != nil {
		return nil, err
	}

	return backend.ToProto().QueryDataResponse(response)
}

// SignedInUserFromBackendUser converts the backend plugin's model to Grafana's SignedInUser model
// This is temporary until we have a better user/token delegation system implemented
func signedInUserFromBackendUser(bu *backend.User) *user.SignedInUser {
	if bu == nil {
		return nil
	}
	return &user.SignedInUser{
		Login:   bu.Login,
		Name:    bu.Name,
		Email:   bu.Email,
		OrgRole: org.RoleType(bu.Role),
	}
}
