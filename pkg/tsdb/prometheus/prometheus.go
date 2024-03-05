package prometheus

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	prometheuslibrary "github.com/grafana/grafana/pkg/prometheus-library"
)

type Service struct {
	lib *prometheuslibrary.Service
}

func ProvideService(httpClientProvider *httpclient.Provider) *Service {
	plog := backend.NewLoggerWith("logger", "tsdb.prometheus")
	plog.Debug("Initializing")
	return &Service{
		lib: prometheuslibrary.NewService(httpClientProvider, plog),
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return s.lib.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.lib.CallResource(ctx, req, sender)
}

func (s *Service) GetBuildInfo(ctx context.Context, req prometheuslibrary.BuildInfoRequest) (*prometheuslibrary.BuildInfoResponse, error) {
	return s.GetBuildInfo(ctx, req)
}

func (s *Service) GetHeuristics(ctx context.Context, req prometheuslibrary.HeuristicsRequest) (*prometheuslibrary.Heuristics, error) {
	return s.lib.GetHeuristics(ctx, req)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	return s.lib.CheckHealth(ctx, req)
}
