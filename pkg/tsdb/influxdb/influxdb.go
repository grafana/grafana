package influxdb

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/flux"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/fsql"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var logger log.Logger = log.New("tsdb.influxdb")

type Service struct {
	im       instancemgmt.InstanceManager
	features featuremgmt.FeatureToggles
}

func ProvideService(httpClient httpclient.Provider, features featuremgmt.FeatureToggles) *Service {
	return &Service{
		im:       datasource.NewInstanceManager(newInstanceSettings(httpClient)),
		features: features,
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		jsonData := models.DatasourceInfo{}
		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		httpMode := jsonData.HTTPMode
		if httpMode == "" {
			httpMode = "GET"
		}

		maxSeries := jsonData.MaxSeries
		if maxSeries == 0 {
			maxSeries = 1000
		}

		version := jsonData.Version
		if version == "" {
			version = influxVersionInfluxQL
		}

		database := jsonData.DbName
		if database == "" {
			database = settings.Database
		}

		proxyClient, err := settings.ProxyClient(ctx)
		if err != nil {
			logger.Error("influx proxy creation failed", "error", err)
			return nil, fmt.Errorf("influx proxy creation failed")
		}

		model := &models.DatasourceInfo{
			HTTPClient:    client,
			URL:           settings.URL,
			DbName:        database,
			Version:       version,
			HTTPMode:      httpMode,
			TimeInterval:  jsonData.TimeInterval,
			DefaultBucket: jsonData.DefaultBucket,
			Organization:  jsonData.Organization,
			MaxSeries:     maxSeries,
			InsecureGrpc:  jsonData.InsecureGrpc,
			Token:         settings.DecryptedSecureJSONData["token"],
			Timeout:       opts.Timeouts.Timeout,
			ProxyClient:   proxyClient,
		}
		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := logger.FromContext(ctx)
	logger.Debug("Received a query request", "numQueries", len(req.Queries))

	tracer := tracing.DefaultTracer()

	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	logger.Debug(fmt.Sprintf("Making a %s type query", dsInfo.Version))

	switch dsInfo.Version {
	case influxVersionFlux:
		return flux.Query(ctx, dsInfo, *req)
	case influxVersionInfluxQL:
		return influxql.Query(ctx, tracer, dsInfo, req, s.features)
	case influxVersionSQL:
		return fsql.Query(ctx, dsInfo, *req)
	default:
		return nil, fmt.Errorf("unknown influxdb version")
	}
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*models.DatasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*models.DatasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
