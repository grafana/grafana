package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-logfmt/logfmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type JaegerClient struct {
	logger     log.Logger
	url        string
	httpClient *http.Client
	settings   backend.DataSourceInstanceSettings
}

type ServicesResponse struct {
	Data   []string    `json:"data"`
	Errors interface{} `json:"errors"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
	Total  int         `json:"total"`
}

type SettingsJSONData struct {
	TraceIdTimeParams struct {
		Enabled bool `json:"enabled"`
	} `json:"traceIdTimeParams"`
}

type DependenciesResponse struct {
	Data   []ServiceDependency `json:"data"`
	Errors []struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	} `json:"errors"`
}

type ServiceDependency struct {
	Parent    string `json:"parent"`
	Child     string `json:"child"`
	CallCount int    `json:"callCount"`
}

func New(hc *http.Client, logger log.Logger, settings backend.DataSourceInstanceSettings) (JaegerClient, error) {
	client := JaegerClient{
		logger:     logger,
		url:        settings.URL,
		httpClient: hc,
		settings:   settings,
	}
	return client, nil
}

func (j *JaegerClient) Services() ([]string, error) {
	var response ServicesResponse
	services := []string{}

	u, err := url.JoinPath(j.url, "/api/services")
	if err != nil {
		return services, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	res, err := j.httpClient.Get(u)
	if err != nil {
		return services, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return services, err
	}

	services = response.Data
	return services, err
}

func (j *JaegerClient) Operations(s string) ([]string, error) {
	var response ServicesResponse
	operations := []string{}

	u, err := url.JoinPath(j.url, "/api/services/", s, "/operations")
	if err != nil {
		return operations, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	res, err := j.httpClient.Get(u)
	if err != nil {
		return operations, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return operations, err
	}

	operations = response.Data
	return operations, err
}

func (j *JaegerClient) Search(query *JaegerQuery, start, end int64) ([]TraceResponse, error) {
	u, err := url.JoinPath(j.url, "api/traces")
	if err != nil {
		return []TraceResponse{}, fmt.Errorf("failed to parse Jaeger URL: %w", err)
	}

	jaegerURL, err := url.Parse(u)
	if err != nil {
		return []TraceResponse{}, fmt.Errorf("failed to parse Jaeger URL: %w", err)
	}

	var queryTags string
	if query.Tags != "" {
		tagMap := make(map[string]string)
		decoder := logfmt.NewDecoder(strings.NewReader(query.Tags))
		for decoder.ScanRecord() {
			for decoder.ScanKeyval() {
				key := decoder.Key()
				value := decoder.Value()
				tagMap[string(key)] = string(value)
			}
		}

		marshaledTags, err := json.Marshal(tagMap)
		if err != nil {
			return []TraceResponse{}, fmt.Errorf("failed to convert tags to JSON: %w", err)
		}

		queryTags = string(marshaledTags)
	}

	queryParams := map[string]string{
		"service":     query.Service,
		"operation":   query.Operation,
		"tags":        queryTags,
		"minDuration": query.MinDuration,
		"maxDuration": query.MaxDuration,
	}

	urlQuery := jaegerURL.Query()
	if query.Limit > 0 {
		urlQuery.Set("limit", fmt.Sprintf("%d", query.Limit))
	}

	if start > 0 {
		urlQuery.Set("start", fmt.Sprintf("%d", start))
	}
	if end > 0 {
		urlQuery.Set("end", fmt.Sprintf("%d", end))
	}

	for key, value := range queryParams {
		if value != "" {
			urlQuery.Set(key, value)
		}
	}

	jaegerURL.RawQuery = urlQuery.Encode()
	resp, err := j.httpClient.Get(jaegerURL.String())
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return []TraceResponse{}, backend.DownstreamError(err)
		}
		return []TraceResponse{}, err
	}

	defer func() {
		if err = resp.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", resp.Status))
		if backend.ErrorSourceFromHTTPStatus(resp.StatusCode) == backend.ErrorSourceDownstream {
			return []TraceResponse{}, backend.DownstreamError(err)
		}
		return []TraceResponse{}, err
	}

	var result TracesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return []TraceResponse{}, fmt.Errorf("failed to decode Jaeger response: %w", err)
	}

	return result.Data, nil
}

func (j *JaegerClient) Trace(ctx context.Context, traceID string, start, end int64) (TraceResponse, error) {
	logger := j.logger.FromContext(ctx)
	var response TracesResponse
	trace := TraceResponse{}

	if traceID == "" {
		return trace, backend.DownstreamError(fmt.Errorf("traceID is empty"))
	}

	traceUrl, err := url.JoinPath(j.url, "/api/traces", url.QueryEscape(traceID))
	if err != nil {
		return trace, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	var jsonData SettingsJSONData
	if err := json.Unmarshal(j.settings.JSONData, &jsonData); err != nil {
		return trace, backend.DownstreamError(fmt.Errorf("failed to parse settings JSON data: %w", err))
	}

	// Add time parameters if trace ID time is enabled and time range is provided
	if jsonData.TraceIdTimeParams.Enabled {
		if start > 0 || end > 0 {
			parsedURL, err := url.Parse(traceUrl)
			if err != nil {
				return trace, backend.DownstreamError(fmt.Errorf("failed to parse url: %w", err))
			}

			query := parsedURL.Query()
			if start > 0 {
				query.Set("start", fmt.Sprintf("%d", start))
			}
			if end > 0 {
				query.Set("end", fmt.Sprintf("%d", end))
			}

			parsedURL.RawQuery = query.Encode()
			traceUrl = parsedURL.String()
		}
	}

	res, err := j.httpClient.Get(traceUrl)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return trace, backend.DownstreamError(err)
		}
		return trace, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res != nil && res.StatusCode/100 != 2 {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return trace, backend.DownstreamError(err)
		}
		return trace, err
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return trace, err
	}

	// We only support one trace at a time
	// this is how it was implemented in the frontend before
	trace = response.Data[0]
	return trace, err
}

func (j *JaegerClient) Dependencies(ctx context.Context, start, end int64) (DependenciesResponse, error) {
	logger := j.logger.FromContext(ctx)
	var dependencies DependenciesResponse

	u, err := url.JoinPath(j.url, "/api/dependencies")
	if err != nil {
		return dependencies, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	// Add time parameters
	parsedURL, err := url.Parse(u)
	if err != nil {
		return dependencies, backend.DownstreamError(fmt.Errorf("failed to parse url: %w", err))
	}

	query := parsedURL.Query()
	if end > 0 {
		query.Set("endTs", fmt.Sprintf("%d", end))
	}
	if start > 0 {
		lookback := end - start
		query.Set("lookback", fmt.Sprintf("%d", lookback))
	}

	parsedURL.RawQuery = query.Encode()
	u = parsedURL.String()

	res, err := j.httpClient.Get(u)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return dependencies, backend.DownstreamError(err)
		}
		return dependencies, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res != nil && res.StatusCode/100 != 2 {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return dependencies, backend.DownstreamError(err)
		}
		return dependencies, err
	}

	if err := json.NewDecoder(res.Body).Decode(&dependencies); err != nil {
		return dependencies, err
	}

	return dependencies, nil
}
