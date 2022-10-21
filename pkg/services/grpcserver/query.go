package grpcserver

import (
	"context"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
)

type QueryDataService struct {
	cfg    *setting.Cfg
	server *queryDataServer
}

func ProvideQueryDataService(cfg *setting.Cfg, grpcServerProvider Provider, queryService *query.Service) (*QueryDataService, error) {
	server := &queryDataServer{
		logger:       log.New("grpc-server-query-data"),
		queryService: queryService,
	}
	pluginv2.RegisterDataServer(grpcServerProvider.GetServer(), server)
	return &QueryDataService{
		cfg:    cfg,
		server: server,
	}, nil
}

type queryDataServer struct {
	logger       log.Logger
	queryService *query.Service
}

// QueryData handles multiple queries run against multiple datasources.
func (s *queryDataServer) QueryData(ctx context.Context, in *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	req := backend.FromProto().QueryDataRequest(in)
	grpcContext := grpccontext.FromContext(ctx)

	r := dtos.MetricRequest{
		Queries: make([]*simplejson.Json, 0, len(req.Queries)),
		From:    strconv.FormatInt(req.Queries[0].TimeRange.From.UnixMilli(), 10),
		To:      strconv.FormatInt(req.Queries[0].TimeRange.To.UnixMilli(), 10),
	}

	for _, q := range req.Queries {
		sj, err := simplejson.NewJson(q.JSON)
		if err != nil {
			return nil, err
		}
		r.Queries = append(r.Queries, sj)
	}

	resp, err := s.queryService.QueryData(ctx, grpcContext.SignedInUser, false, r)
	if err != nil {
		return nil, err
	}

	return backend.ToProto().QueryDataResponse(resp)
}
