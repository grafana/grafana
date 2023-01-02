package prometheus

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/patrickmn/go-cache"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querydata"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/resource"
)

var plog = log.New("tsdb.prometheus")

type Service struct {
	im       instancemgmt.InstanceManager
	features featuremgmt.FeatureToggles
}

type instance struct {
	queryData    *querydata.QueryData
	resource     *resource.Resource
	versionCache *cache.Cache
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
		// Creates a http roundTripper.
		opts, err := client.CreateTransportOptions(settings, cfg, plog)
		if err != nil {
			return nil, fmt.Errorf("error creating transport options: %v", err)
		}
		httpClient, err := httpClientProvider.New(*opts)
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %v", err)
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
			queryData:    qd,
			resource:     r,
			versionCache: cache.New(time.Minute*1, time.Minute*5),
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

	return i.queryData.Execute(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	i, err := s.getInstance(req.PluginContext)
	if err != nil {
		return err
	}

	if strings.EqualFold(req.Path, "version-detect") {
		versionObj, found := i.versionCache.Get("version")
		if found {
			return sender.Send(versionObj.(*backend.CallResourceResponse))
		}

		vResp, err := i.resource.DetectVersion(ctx, req)
		if err != nil {
			return err
		}
		i.versionCache.Set("version", vResp, cache.DefaultExpiration)
		return sender.Send(vResp)
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
