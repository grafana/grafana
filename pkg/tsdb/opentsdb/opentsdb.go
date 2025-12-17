package opentsdb

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

var logger = backend.NewLoggerWith("tsdb.opentsdb")

type Service struct {
	im instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider *httpclient.Provider) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
	}
}

type datasourceInfo struct {
	HTTPClient     *http.Client
	URL            string
	TSDBVersion    float32
	TSDBResolution int32
	LookupLimit    int32
}

type DsAccess string

type JSONData struct {
	TSDBVersion    float32 `json:"tsdbVersion"`
	TSDBResolution int32   `json:"tsdbResolution"`
	LookupLimit    int32   `json:"lookupLimit"`
}

type QueryModel struct {
	Metric               string                 `json:"metric"`
	Aggregator           string                 `json:"aggregator"`
	DownsampleInterval   string                 `json:"downsampleInterval"`
	DownsampleAggregator string                 `json:"downsampleAggregator"`
	DownsampleFillPolicy string                 `json:"downsampleFillPolicy"`
	DisableDownsampling  bool                   `json:"disableDownsampling"`
	Filters              []any                  `json:"filters"`
	Tags                 map[string]interface{} `json:"tags"`
	ShouldComputeRate    bool                   `json:"shouldComputeRate"`
	IsCounter            bool                   `json:"isCounter"`
	CounterMax           string                 `json:"counterMax"`
	CounterResetValue    string                 `json:"counterResetValue"`
	ExplicitTags         bool                   `json:"explicitTags"`
}

func newInstanceSettings(httpClientProvider *httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		opts, err := settings.HTTPClientOptions(ctx)
		if err != nil {
			return nil, err
		}

		client, err := httpClientProvider.New(opts)
		if err != nil {
			return nil, err
		}

		jsonData := JSONData{}
		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		model := &datasourceInfo{
			HTTPClient:     client,
			URL:            settings.URL,
			TSDBVersion:    jsonData.TSDBVersion,
			TSDBResolution: jsonData.TSDBResolution,
			LookupLimit:    jsonData.LookupLimit,
		}

		return model, nil
	}
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger := logger.FromContext(ctx)

	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	u.Path = path.Join(u.Path, "api/suggest")
	query := u.Query()
	query.Set("q", "cpu")
	query.Set("type", "metrics")
	u.RawQuery = query.Encode()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res.StatusCode != 200 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("OpenTSDB suggest endpoint returned status %d", res.StatusCode),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/suggest", s.HandleSuggestQuery)

	handler := httpadapter.New(mux)
	return handler.CallResource(ctx, req, sender)
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger := logger.FromContext(ctx)

	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	result := backend.NewQueryDataResponse()

	for _, query := range req.Queries {
		tsdbQuery := OpenTsdbQuery{
			Start: query.TimeRange.From.Unix(),
			End:   query.TimeRange.To.Unix(),
			Queries: []map[string]any{
				BuildMetric(query),
			},
		}

		httpReq, err := CreateRequest(ctx, logger, dsInfo, tsdbQuery)
		if err != nil {
			return nil, err
		}

		httpRes, err := dsInfo.HTTPClient.Do(httpReq)
		if err != nil {
			return nil, err
		}

		defer func() {
			if cerr := httpRes.Body.Close(); cerr != nil {
				logger.Warn("failed to close response body", "error", cerr)
			}
		}()

		queryRes, err := ParseResponse(logger, httpRes, query.RefID, dsInfo.TSDBVersion)
		if err != nil {
			return nil, err
		}

		result.Responses[query.RefID] = queryRes.Responses[query.RefID]
	}

	return result, nil
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datasource info")
	}

	return instance, nil
}
