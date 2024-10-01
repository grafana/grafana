package opentsdb

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("tsdb.opentsdb")

type Service struct {
	im instancemgmt.InstanceManager
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
	}
}

type datasourceInfo struct {
	HTTPClient *http.Client
	URL        string
}

type DsAccess string

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

		model := &datasourceInfo{
			HTTPClient: client,
			URL:        settings.URL,
		}

		return model, nil
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	var tsdbQuery OpenTsdbQuery

	logger := logger.FromContext(ctx)

	q := req.Queries[0]

	myRefID := q.RefID

	tsdbQuery.Start = q.TimeRange.From.UnixNano() / int64(time.Millisecond)
	tsdbQuery.End = q.TimeRange.To.UnixNano() / int64(time.Millisecond)

	for _, query := range req.Queries {
		metric := s.buildMetric(query)
		tsdbQuery.Queries = append(tsdbQuery.Queries, metric)
	}

	// TODO: Don't use global variable
	if setting.Env == setting.Dev {
		logger.Debug("OpenTsdb request", "params", tsdbQuery)
	}

	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	request, err := s.createRequest(ctx, logger, dsInfo, tsdbQuery)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	res, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	defer func() {
		err := res.Body.Close()
		if err != nil {
			logger.Warn("failed to close response body", "error", err)
		}
	}()

	result, err := s.parseResponse(logger, res, myRefID)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	return result, nil
}

func (s *Service) createRequest(ctx context.Context, logger log.Logger, dsInfo *datasourceInfo, data OpenTsdbQuery) (*http.Request, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "api/query")
	queryParams := u.Query()
	queryParams.Set("arrays", "true")
	u.RawQuery = queryParams.Encode()

	postData, err := json.Marshal(data)
	if err != nil {
		logger.Info("Failed marshaling data", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(string(postData)))
	if err != nil {
		logger.Info("Failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func (s *Service) parseResponse(logger log.Logger, res *http.Response, myRefID string) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		logger.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("request failed, status: %s", res.Status)
	}

	var responseData []OpenTsdbResponse
	err = json.Unmarshal(body, &responseData)
	if err != nil {
		logger.Info("Failed to unmarshal opentsdb response", "error", err, "status", res.Status, "body", string(body))
		return nil, err
	}

	frames := data.Frames{}
	for _, val := range responseData {
		labels := data.Labels{}
		for label, value := range val.Tags {
			labels[label] = value
		}

		frame := data.NewFrameOfFieldTypes(val.Metric, len(val.DataPoints), data.FieldTypeTime, data.FieldTypeFloat64)
		frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti, TypeVersion: data.FrameTypeVersion{0, 1}}
		frame.RefID = myRefID
		timeField := frame.Fields[0]
		timeField.Name = data.TimeSeriesTimeFieldName
		dataField := frame.Fields[1]
		dataField.Name = "value"
		dataField.Labels = labels

		points := val.DataPoints
		for i, point := range points {
			frame.SetRow(i, time.Unix(int64(point[0]), 0).UTC(), point[1])
		}
		frames = append(frames, frame)
	}
	result := resp.Responses[myRefID]
	result.Frames = frames
	resp.Responses[myRefID] = result
	return resp, nil
}

func (s *Service) buildMetric(query backend.DataQuery) map[string]any {
	metric := make(map[string]any)

	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		return nil
	}

	// Setting metric and aggregator
	metric["metric"] = model.Get("metric").MustString()
	metric["aggregator"] = model.Get("aggregator").MustString()

	// Setting downsampling options
	disableDownsampling := model.Get("disableDownsampling").MustBool()
	if !disableDownsampling {
		downsampleInterval := model.Get("downsampleInterval").MustString()
		if downsampleInterval == "" {
			downsampleInterval = "1m" // default value for blank
		}
		downsample := downsampleInterval + "-" + model.Get("downsampleAggregator").MustString()
		if model.Get("downsampleFillPolicy").MustString() != "none" {
			metric["downsample"] = downsample + "-" + model.Get("downsampleFillPolicy").MustString()
		} else {
			metric["downsample"] = downsample
		}
	}

	// Setting rate options
	if model.Get("shouldComputeRate").MustBool() {
		metric["rate"] = true
		rateOptions := make(map[string]any)
		rateOptions["counter"] = model.Get("isCounter").MustBool()

		counterMax, counterMaxCheck := model.CheckGet("counterMax")
		if counterMaxCheck {
			rateOptions["counterMax"] = counterMax.MustFloat64()
		}

		resetValue, resetValueCheck := model.CheckGet("counterResetValue")
		if resetValueCheck {
			rateOptions["resetValue"] = resetValue.MustFloat64()
		}

		if !counterMaxCheck && (!resetValueCheck || resetValue.MustFloat64() == 0) {
			rateOptions["dropResets"] = true
		}

		metric["rateOptions"] = rateOptions
	}

	// Setting tags
	tags, tagsCheck := model.CheckGet("tags")
	if tagsCheck && len(tags.MustMap()) > 0 {
		metric["tags"] = tags.MustMap()
	}

	// Setting filters
	filters, filtersCheck := model.CheckGet("filters")
	if filtersCheck && len(filters.MustArray()) > 0 {
		metric["filters"] = filters.MustArray()
	}

	return metric
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*datasourceInfo, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}

	instance, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}
