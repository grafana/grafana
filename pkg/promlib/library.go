package promlib

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/promlib/client"
	"github.com/grafana/grafana/pkg/promlib/instrumentation"
	"github.com/grafana/grafana/pkg/promlib/querydata"
	"github.com/grafana/grafana/pkg/promlib/resource"
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

type instance struct {
	queryData *querydata.QueryData
	resource  *resource.Resource
}

type ExtendOptions func(ctx context.Context, settings backend.DataSourceInstanceSettings, clientOpts *sdkhttpclient.Options, log log.Logger) error

func NewService(httpClientProvider *sdkhttpclient.Provider, plog log.Logger, extendOptions ExtendOptions) *Service {
	if httpClientProvider == nil {
		httpClientProvider = sdkhttpclient.NewProvider()
	}
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider, plog, extendOptions)),
		logger: plog,
	}
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (s *Service) Dispose() {
	// Clean up datasource instance resources.
	s.logger.Debug("Disposing the instance...")
}

func newInstanceSettings(httpClientProvider *sdkhttpclient.Provider, log log.Logger, extendOptions ExtendOptions) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		// Creates a http roundTripper.
		opts, err := client.CreateTransportOptions(ctx, settings, log)
		if err != nil {
			return nil, fmt.Errorf("error creating transport options: %v", err)
		}

		if extendOptions != nil {
			err = extendOptions(ctx, settings, opts, log)
			if err != nil {
				return nil, fmt.Errorf("error extending transport options: %v", err)
			}
		}

		httpClient, err := httpClientProvider.New(*opts)
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %v", err)
		}

		featureToggles := backend.GrafanaConfigFromContext(ctx).FeatureToggles()

		// New version using custom client and better response parsing
		qd, err := querydata.New(httpClient, settings, log, featureToggles)
		if err != nil {
			return nil, err
		}

		// Resource call management using new custom client same as querydata
		r, err := resource.New(httpClient, settings, log)
		if err != nil {
			return nil, err
		}

		return instance{
			queryData: qd,
			resource:  r,
		}, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		err := fmt.Errorf("query contains no queries")
		instrumentation.UpdateQueryDataMetrics(err, nil)
		return &backend.QueryDataResponse{}, err
	}

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		instrumentation.UpdateQueryDataMetrics(err, nil)
		return nil, err
	}

	qd, err := i.queryData.Execute(ctx, req)
	instrumentation.UpdateQueryDataMetrics(err, qd)

	return qd, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	switch {
	case strings.EqualFold(req.Path, "suggestions"):
		resp, err := i.resource.GetSuggestions(ctx, req)
		if err != nil {
			return err
		}
		return sender.Send(resp)
	}

	resp, err := i.resource.Execute(ctx, req)
	if err != nil {
		return err
	}

	return sender.Send(resp)
}

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*instance, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	in := i.(instance)
	return &in, nil
}
