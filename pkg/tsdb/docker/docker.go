package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)


type Service struct {
	im				instancemgmt.InstanceManager
	tracer			trace.Tracer
	logger			log.Logger
	resourceHandler backend.CallResourceHandler
}


var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
	_ backend.CheckHealthHandler  = (*Service)(nil)
    _ backend.StreamHandler       = (*Service)(nil)
)


func ProvideService(httpClientProvider *httpclient.Provider, tracer trace.Tracer) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.docker")
	s := &Service{
		im:      datasource.NewInstanceManager(newInstanceSettings(httpClientProvider, logger)),
		tracer:  tracer,
		logger:  logger,
	}
	s.resourceHandler = httpadapter.New(s.newResourceMux())
	return s
}


type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string
	Options    DockerOptions
	API		   *DockerAPI
	streams   map[string]data.FrameJSONCache
	streamsMu sync.RWMutex
}


func  newInstanceSettings(httpClientProvider *httpclient.Provider, logger log.Logger) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		var dockerOpts DockerOptions
        if len(settings.JSONData) > 0 {
            if err := json.Unmarshal(settings.JSONData, &dockerOpts); err != nil {
                return nil, fmt.Errorf("parsing settings: %w", err)
            }
        }        

		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, fmt.Errorf("http client options: %w", err)
		}
		httpClient, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, fmt.Errorf("creating http client: %w", err)
		}

		api, err := newDockerAPI(settings.URL, dockerOpts, httpClient, logger)
        if err != nil {
            return nil, fmt.Errorf("creating docker api: %w", err)
        }

        return &datasourceInfo{
			HTTPClient: httpClient,
            URL:        settings.URL,
            Options:    dockerOpts,
            API:        api,
			streams:    make(map[string]data.FrameJSONCache),
        }, nil
    }
}


func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*datasourceInfo)
	return instance, nil
}


func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := s.logger.FromContext(ctx)

	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("query is empty")
	}
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return nil, err
	}
	response := backend.NewQueryDataResponse()
    for _, q := range req.Queries {
		if isQueryEmpty(q) { continue }
        response.Responses[q.RefID] = s.handleQuery(ctx, dsInfo, q)
    }

	return response, nil
}

func isQueryEmpty(query backend.DataQuery) bool {
	var probeErr struct {
        ResourceType string `json:"resourceType"`
    }
	if err := json.Unmarshal(query.JSON, &probeErr); err != nil {
		return false
	}
	return probeErr.ResourceType == ""
}


func (s *Service) handleQuery(ctx context.Context, dsInfo *datasourceInfo, query backend.DataQuery) backend.DataResponse {
	logger := s.logger.FromContext(ctx)
	
	parsed, err := parseQuery(query)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, err.Error())
	}
	
	resp, err := dsInfo.API.DataQuery(ctx, *parsed);
	if err != nil {
		logger.Error("Failed to perform the query", "error", err)
		return backend.ErrDataResponse(backend.StatusInternal, err.Error())
	}

	frame, err := ResponseParser(resp)
	if err != nil {
		logger.Error("Failed to convert query response into frames", "error", err)
		return backend.ErrDataResponse(backend.StatusInternal, err.Error())
	}
    return frame
}


func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}


func isFeatureEnabled(ctx context.Context, feature string) bool {
	return config.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled(feature)
}
