package jaeger

import (
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
		"query.attributes":     queryTags,
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

	var result types.GrpcTracesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode Jaeger response: %w", err)
	}

	if result.Error.HttpCode != 0 && result.Error.HttpCode != http.StatusOK {
		err := backend.DownstreamError(fmt.Errorf("request failed %s", result.Error.Message))
		if backend.ErrorSourceFromHTTPStatus(result.Error.HttpCode) == backend.ErrorSourceDownstream {
			return nil, backend.DownstreamError(err)
		}
		return nil, err
	}
	frames := utils.TransformGrpcSearchResponse(result.Result, j.settings.UID, j.settings.Name, query.Limit)
	return frames, nil
}
