package zipkin

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/zipkin/zipkin"
)

var logger = log.New("tsdb.zipkin")

type Service struct {
	im instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
	}
}

type datasourceInfo struct {
	ZipkinClient zipkin.ZipkinClient
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		ts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, err
		}
		hc, err := httpClientProvider.New(ts)
		if err != nil {
			return nil, err
		}
		zc, err := zipkin.New(settings.URL, hc, logger)
		return &datasourceInfo{ZipkinClient: zc}, err
	}
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datasource info")
	}
	return instance, nil
}
