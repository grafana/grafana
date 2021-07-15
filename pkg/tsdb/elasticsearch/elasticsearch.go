package elasticsearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

var eslog = log.New("tsdb.elasticsearch")

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "ElasticSearchService",
		InitPriority: registry.Low,
		Instance:     &Service{},
	})
}

type Service struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	HTTPClientProvider   httpclient.Provider   `inject:""`
	intervalCalculator   tsdb.Calculator
	im                   instancemgmt.InstanceManager
}

func (s *Service) Init() error {
	eslog.Debug("initializing")
	im := datasource.NewInstanceManager(newInstanceSettings())
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: newService(im, s.HTTPClientProvider),
	})
	if err := s.BackendPluginManager.Register("elasticsearch", factory); err != nil {
		eslog.Error("Failed to register plugin", "error", err)
	}
	return nil
}

// newService creates a new executor func.
func newService(im instancemgmt.InstanceManager, httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im:                 im,
		HTTPClientProvider: httpClientProvider,
		intervalCalculator: tsdb.NewCalculator(),
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	client, err := es.NewClient(ctx, s.HTTPClientProvider, dsInfo, req.Queries[0].TimeRange)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	query := newTimeSeriesQuery(client, req.Queries, s.intervalCalculator)
	return query.execute()
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := map[string]interface{}{}
		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		httpCliOpts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, fmt.Errorf("error getting http options: %w", err)
		}

		version, err := coerceVersion(jsonData["esVersion"])

		if err != nil {
			return nil, fmt.Errorf("elasticsearch version is required, err=%v", err)
		}

		timeField, ok := jsonData["timeField"].(string)
		if !ok {
			return nil, errors.New("timeField cannot be cast to string")
		}

		if timeField == "" {
			return nil, errors.New("elasticsearch time field name is required")
		}

		interval, ok := jsonData["interval"].(string)
		if !ok {
			interval = ""
		}

		timeInterval, ok := jsonData["timeInterval"].(string)
		if !ok {
			timeInterval = ""
		}

		maxConcurrentShardRequests, ok := jsonData["maxConcurrentShardRequests"].(float64)
		if !ok {
			maxConcurrentShardRequests = 256
		}

		includeFrozen, ok := jsonData["includeFrozen"].(bool)
		if !ok {
			includeFrozen = false
		}

		xpack, ok := jsonData["xpack"].(bool)
		if !ok {
			xpack = false
		}

		model := es.DatasourceInfo{
			ID:                         settings.ID,
			URL:                        settings.URL,
			HTTPClientOpts:             httpCliOpts,
			Database:                   settings.Database,
			MaxConcurrentShardRequests: int64(maxConcurrentShardRequests),
			ESVersion:                  version,
			TimeField:                  timeField,
			Interval:                   interval,
			TimeInterval:               timeInterval,
			IncludeFrozen:              includeFrozen,
			XPack:                      xpack,
		}
		return model, nil
	}
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*es.DatasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}

	instance := i.(es.DatasourceInfo)

	return &instance, nil
}

func coerceVersion(v interface{}) (*semver.Version, error) {
	versionString, ok := v.(string)
	if ok {
		return semver.NewVersion(versionString)
	}

	versionNumber, ok := v.(float64)
	if !ok {
		return nil, fmt.Errorf("elasticsearch version %v, cannot be cast to int", v)
	}

	// Legacy version numbers (before Grafana 8)
	// valid values were 2,5,56,60,70
	switch int64(versionNumber) {
	case 2:
		return semver.NewVersion("2.0.0")
	case 5:
		return semver.NewVersion("5.0.0")
	case 56:
		return semver.NewVersion("5.6.0")
	case 60:
		return semver.NewVersion("6.0.0")
	case 70:
		return semver.NewVersion("7.0.0")
	default:
		return nil, fmt.Errorf("elasticsearch version=%d is not supported", int64(versionNumber))
	}
}
