package elasticsearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

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

		// we used to have a field named `esVersion`, please do not use this name in the future.

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

		index, ok := jsonData["index"].(string)
		if !ok {
			index = ""
		}
		if index == "" {
			index = settings.Database
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
			Database:                   index,
			MaxConcurrentShardRequests: int64(maxConcurrentShardRequests),
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
