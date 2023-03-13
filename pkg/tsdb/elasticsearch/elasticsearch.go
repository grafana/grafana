package elasticsearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

var eslog = log.New("tsdb.elasticsearch")

type Service struct {
	httpClientProvider httpclient.Provider
	im                 instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	eslog.Debug("Initializing")

	return &Service{
		im:                 datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		httpClientProvider: httpClientProvider,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	return queryData(ctx, req.Queries, dsInfo)
}

// separate function to allow testing the whole transformation and query flow
func queryData(ctx context.Context, queries []backend.DataQuery, dsInfo *es.DatasourceInfo) (*backend.QueryDataResponse, error) {
	// Support for version after their end-of-life (currently <7.10.0) was removed
	lastSupportedVersion, _ := semver.NewVersion("7.10.0")
	if dsInfo.ESVersion.LessThan(lastSupportedVersion) {
		return &backend.QueryDataResponse{}, fmt.Errorf("support for elasticsearch versions after their end-of-life (currently versions < 7.10) was removed")
	}

	if len(queries) == 0 {
		return &backend.QueryDataResponse{}, fmt.Errorf("query contains no queries")
	}

	client, err := es.NewClient(ctx, dsInfo, queries[0].TimeRange)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	query := newElasticsearchDataQuery(client, queries)
	return query.execute()
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
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

		// Set SigV4 service namespace
		if httpCliOpts.SigV4 != nil {
			httpCliOpts.SigV4.Service = "es"
		}

		httpCli, err := httpClientProvider.New(httpCliOpts)
		if err != nil {
			return nil, err
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

		logLevelField, ok := jsonData["logLevelField"].(string)
		if !ok {
			logLevelField = ""
		}

		logMessageField, ok := jsonData["logMessageField"].(string)
		if !ok {
			logMessageField = ""
		}

		interval, ok := jsonData["interval"].(string)
		if !ok {
			interval = ""
		}

		timeInterval, ok := jsonData["timeInterval"].(string)
		if !ok {
			timeInterval = ""
		}

		var maxConcurrentShardRequests float64

		switch v := jsonData["maxConcurrentShardRequests"].(type) {
		case float64:
			maxConcurrentShardRequests = v
		case string:
			maxConcurrentShardRequests, err = strconv.ParseFloat(v, 64)
			if err != nil {
				maxConcurrentShardRequests = 256
			}
		default:
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

		configuredFields := es.ConfiguredFields{
			TimeField:       timeField,
			LogLevelField:   logLevelField,
			LogMessageField: logMessageField,
		}

		model := es.DatasourceInfo{
			ID:                         settings.ID,
			URL:                        settings.URL,
			HTTPClient:                 httpCli,
			Database:                   settings.Database,
			MaxConcurrentShardRequests: int64(maxConcurrentShardRequests),
			ESVersion:                  version,
			ConfiguredFields:           configuredFields,
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
