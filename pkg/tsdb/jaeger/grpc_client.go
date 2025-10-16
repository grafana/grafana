package jaeger

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-logfmt/logfmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/types"
	"github.com/grafana/grafana/pkg/tsdb/jaeger/utils"
)

func (j *JaegerClient) GrpcSearch(query *JaegerQuery, start, end time.Time) (*data.Frame, error) {
	u, err := url.JoinPath(j.url, "/api/v3/traces")
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("failed to join url path: %w", err))
	}

	jaegerURL, err := url.Parse(u)
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("failed to parse Jaeger URL: %w", err))
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
			return nil, backend.DownstreamError(fmt.Errorf("failed to convert tags to JSON: %w", err))
		}

		queryTags = string(marshaledTags)
	}

	queryParams := map[string]string{
		"query.service_name":   query.Service,
		"query.operation_name": query.Operation,
		"query.attributes":     queryTags, // TODO: no native support of attributes/tags figure out if we want to do it in post processing.
		"query.duration_min":   query.MinDuration,
		"query.duration_max":   query.MaxDuration,
	}

	urlQuery := jaegerURL.Query()

	for key, value := range queryParams {
		if value != "" {
			urlQuery.Set(key, value)
		}
	}

	jaegerURL.RawQuery = urlQuery.Encode()
	// jaeger will not be able to process the request if the time is encoded, all other parameters are encoded except for the start and end time
	jaegerURL.RawQuery += fmt.Sprintf("&query.start_time_min=%s&query.start_time_max=%s", start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	backend.Logger.Warn("gRPC Search URL", "url", jaegerURL.String())
	resp, err := j.httpClient.Get(jaegerURL.String())
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}

	defer func() {
		if err = resp.Body.Close(); err != nil {
			j.logger.Error("Failed to close response body", "error", err)
		}
	}()

	var response types.GrpcTracesResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode Jaeger response: %w", err)
	}

	if response.Error.HttpCode != 0 && response.Error.HttpCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed %s", response.Error.Message))
		if backend.ErrorSourceFromHTTPStatus(response.Error.HttpCode) == backend.ErrorSourceDownstream {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}
	frames := utils.TransformGrpcSearchResponse(response.Result, j.settings.UID, j.settings.Name, query.Limit)
	return frames, nil
}

func (j *JaegerClient) GrpcTrace(ctx context.Context, traceID string, start, end time.Time, refID string) (*data.Frame, error) {
	logger := j.logger.FromContext(ctx)
	var response types.GrpcTracesResponse

	if traceID == "" {
		return nil, backend.DownstreamError(fmt.Errorf("traceID is empty"))
	}

	traceUrl, err := url.JoinPath(j.url, "/api/v3/traces", url.QueryEscape(traceID))
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("failed to join url: %w", err))
	}

	var jsonData types.SettingsJSONData
	if err := json.Unmarshal(j.settings.JSONData, &jsonData); err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("failed to parse settings JSON data: %w", err))
	}

	// Add time parameters if trace ID time is enabled and time range is provided
	if jsonData.TraceIdTimeParams.Enabled {
		if start.UnixMicro() > 0 || end.UnixMicro() > 0 {
			parsedURL, err := url.Parse(traceUrl)
			if err != nil {
				return nil, backend.DownstreamError(fmt.Errorf("failed to parse url: %w", err))
			}

			// jaeger will not be able to process the request if the time is encoded, all other parameters are encoded except for the start and end time
			parsedURL.RawQuery += fmt.Sprintf("start_time=%s&end_time=%s", start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
			traceUrl = parsedURL.String()
		}
	}

	res, err := j.httpClient.Get(traceUrl)
	if err != nil {
		if backend.IsDownstreamHTTPError(err) {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	if res != nil && res.StatusCode/100 != 2 {
		err := backend.DownstreamError(fmt.Errorf("request failed: %s", res.Status))
		if backend.ErrorSourceFromHTTPStatus(res.StatusCode) == backend.ErrorSourceDownstream {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}

	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		return nil, err
	}

	if response.Error.HttpCode != 0 && response.Error.HttpCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed %s", response.Error.Message))
		if backend.ErrorSourceFromHTTPStatus(response.Error.HttpCode) == backend.ErrorSourceDownstream {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}

	frame := utils.TransformGrpcTraceResponse(response.Result.ResourceSpans, refID)
	return frame, err
}
