package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sync"

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
	"github.com/yudai/gojsondiff"
	"github.com/yudai/gojsondiff/formatter"
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
		opts, err := buffered.CreateTransportOptions(settings, cfg, plog)
		if err != nil {
			return nil, fmt.Errorf("error creating transport options: %v", err)
		}
		httpClient, err := httpClientProvider.New(*opts)
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %v", err)
		}
		// Older version using standard Go Prometheus client
		b, err := buffered.New(httpClient.Transport, tracer, settings, plog)
		if err != nil {
			return nil, err
		}

		// New version using custom client and better response parsing
		qd, err := querydata.New(httpClient, features, tracer, settings, plog)
		if err != nil {
			return nil, err
		}

		// Resource call management using new custom client same as querydata
		r, err := resource.New(httpClient, settings, plog)
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

	// To test the new client implementation this can be run and we do 2 requests and compare.
	if s.features.IsEnabled(featuremgmt.FlagPrometheusStreamingJSONParserTest) {
		var wg sync.WaitGroup
		var streamData *backend.QueryDataResponse
		var streamError error

		var data *backend.QueryDataResponse
		var err error

		plog.Debug("PrometheusStreamingJSONParserTest", "req", req)

		wg.Add(1)
		go func() {
			defer wg.Done()
			streamData, streamError = i.queryData.Execute(ctx, req)
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			data, err = i.buffered.ExecuteTimeSeriesQuery(ctx, req)
		}()

		wg.Wait()

		// Report can take a while and we don't really need to wait for it.
		go reportDiff(data, err, streamData, streamError)
		return data, err
	}

	return i.buffered.ExecuteTimeSeriesQuery(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	i, err := s.getInstance(req.PluginContext)
	if err != nil {
		return err
	}

	resp, err := i.resource.Execute(ctx, req)
	if err != nil {
		return err
	}

	return sender.Send(resp)
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

func reportDiff(data *backend.QueryDataResponse, err error, streamData *backend.QueryDataResponse, streamError error) {
	if err == nil && streamError != nil {
		plog.Debug("PrometheusStreamingJSONParserTest error in streaming client", "err", streamError)
	}

	if err != nil && streamError == nil {
		plog.Debug("PrometheusStreamingJSONParserTest error in buffer but not streaming", "err", err)
	}

	if !reflect.DeepEqual(data, streamData) {
		plog.Debug("PrometheusStreamingJSONParserTest buffer and streaming data are different")
		dataJson, jsonErr := json.MarshalIndent(data, "", "\t")
		if jsonErr != nil {
			plog.Debug("PrometheusStreamingJSONParserTest error marshaling data", "jsonErr", jsonErr)
		}
		streamingJson, jsonErr := json.MarshalIndent(streamData, "", "\t")
		if jsonErr != nil {
			plog.Debug("PrometheusStreamingJSONParserTest error marshaling streaming data", "jsonErr", jsonErr)
		}
		differ := gojsondiff.New()
		d, diffErr := differ.Compare(dataJson, streamingJson)
		if diffErr != nil {
			plog.Debug("PrometheusStreamingJSONParserTest diff error", "err", diffErr)
		}
		config := formatter.AsciiFormatterConfig{
			ShowArrayIndex: true,
			Coloring:       true,
		}

		var aJson map[string]interface{}
		unmarshallErr := json.Unmarshal(dataJson, &aJson)
		if unmarshallErr != nil {
			plog.Debug("PrometheusStreamingJSONParserTest unmarshall error", "err", unmarshallErr)
		}
		formatter := formatter.NewAsciiFormatter(aJson, config)
		diffString, diffErr := formatter.Format(d)
		if diffErr != nil {
			plog.Debug("PrometheusStreamingJSONParserTest diff format error", "err", diffErr)
		}
		fmt.Println(diffString)
	} else {
		plog.Debug("PrometheusStreamingJSONParserTest responses are the same")
	}
}
