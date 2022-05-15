package prometheus

import (
	"context"
	"encoding/json"
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
		var jsonData map[string]interface{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		b, err := buffered.New(httpClientProvider, cfg, features, tracer, settings, plog)
		if err != nil {
			return nil, err
		}

		qd, err := querydata.New(httpClientProvider, cfg, features, tracer, settings, plog)
		if err != nil {
			return nil, err
		}

		return instance{
			buffered:  b,
			queryData: qd,
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

	if s.features.IsEnabled(featuremgmt.FlagPrometheusStreamingJSONParser) {
		return i.queryData.Execute(ctx, req)
	}

	return i.buffered.ExecuteTimeSeriesQuery(ctx, req)
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
