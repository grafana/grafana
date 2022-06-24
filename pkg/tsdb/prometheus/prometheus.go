package prometheus

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/buffered"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querydata"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/resource"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

var plog = log.New("tsdb.prometheus")

type Service struct {
	im       instancemgmt.InstanceManager
	features featuremgmt.FeatureToggles
}

type instance struct {
	buffered  *buffered.Buffered
	queryData *querydata.QueryData
	resource  *resource.Resource
}

func ProvideService(httpClientProvider httpclient.Provider, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) *Service {
	plog.Debug("initializing")
	return &Service{
		im:       datasource.NewInstanceManager(newInstanceSettings(httpClientProvider, cfg, features, tracer)),
		features: features,
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		// Creates a http roundTripper. Probably should be used for both buffered and streaming/querydata instances.
		opts, err := buffered.CreateTransportOptions(settings, cfg, features, plog)
		if err != nil {
			return nil, fmt.Errorf("error creating transport options: %v", err)
		}
		roundTripper, err := httpClientProvider.GetTransport(*opts)
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %v", err)
		}

		b, err := buffered.New(roundTripper, tracer, settings, plog)
		if err != nil {
			return nil, err
		}

		qd, err := querydata.New(httpClientProvider, cfg, features, tracer, settings, plog)
		if err != nil {
			return nil, err
		}

		r, err := resource.New(httpClientProvider, cfg, features, settings, plog)
		if err != nil {
			return nil, err
		}

		return instance{
			buffered:  b,
			queryData: qd,
			resource:  r,
		}, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	i, err := s.getInstance(req.PluginContext)
	if err != nil {
		return nil, err
	}

	if s.features.IsEnabled(featuremgmt.FlagPrometheusStreamingJSONParser) || s.features.IsEnabled(featuremgmt.FlagPrometheusWideSeries) {
		return i.queryData.Execute(ctx, req)
	}

	return i.buffered.ExecuteTimeSeriesQuery(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	i, err := s.getInstance(req.PluginContext)
	if err != nil {
		return err
	}

	statusCode, bytes, err := i.resource.Execute(ctx, req)
	body := bytes
	if err != nil {
		body = []byte(err.Error())
	}

	return sender.Send(&backend.CallResourceResponse{
		Status: statusCode,
		Headers: map[string][]string{
			"content-type": {"application/json"},
		},
		Body: body,
	})
}

func (s *Service) getInstance(pluginCtx backend.PluginContext) (*instance, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	in := i.(instance)
	return &in, nil
}

// IsAPIError returns whether err is or wraps a Prometheus error.
func IsAPIError(err error) bool {
	// Check if the right error type is in err's chain.
	var e *apiv1.Error
	return errors.As(err, &e)
}

func ConvertAPIError(err error) error {
	var e *apiv1.Error
	if errors.As(err, &e) {
		return fmt.Errorf("%s: %s", e.Msg, e.Detail)
	}
	return err
}
