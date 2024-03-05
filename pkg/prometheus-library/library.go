package prometheus_library

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/patrickmn/go-cache"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/prometheus-library/client"
	"github.com/grafana/grafana/pkg/prometheus-library/querydata"
	"github.com/grafana/grafana/pkg/prometheus-library/resource"
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

type instance struct {
	queryData    *querydata.QueryData
	resource     *resource.Resource
	versionCache *cache.Cache
}

func NewService(plog log.Logger) *Service {
	plog.Debug("Initializing")
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(plog)),
		logger: plog,
	}
}

func newInstanceSettings(log log.Logger) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		// Creates a http roundTripper.
		opts, err := client.CreateTransportOptions(ctx, settings, log)
		if err != nil {
			return nil, fmt.Errorf("error creating transport options: %v", err)
		}
		httpClient, err := httpclient.New(*opts)
		if err != nil {
			return nil, fmt.Errorf("error creating http client: %v", err)
		}

		// New version using custom client and better response parsing
		qd, err := querydata.New(httpClient, settings, log)
		if err != nil {
			return nil, err
		}

		// Resource call management using new custom client same as querydata
		r, err := resource.New(httpClient, settings, log)
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

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*instance, error) {
	i, err := s.im.Get(ctx, pluginCtx)
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
