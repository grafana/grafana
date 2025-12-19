package opentsdb

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func FormatDownsampleInterval(ms int64) string {
	duration := time.Duration(ms) * time.Millisecond

	seconds := int64(duration / time.Second)
	if seconds < 60 {
		if seconds < 1 {
			return strconv.FormatInt(ms, 10) + "ms"
		}
		return strconv.FormatInt(seconds, 10) + "s"
	}

	minutes := int64(duration / time.Minute)
	if minutes < 60 {
		return strconv.FormatInt(minutes, 10) + "m"
	}

	hours := int64(duration / time.Hour)
	if hours < 24 {
		return strconv.FormatInt(hours, 10) + "h"
	}

	days := int64(duration / (24 * time.Hour))
	return strconv.FormatInt(days, 10) + "d"
}

func BuildMetric(query backend.DataQuery) map[string]any {
	metric := make(map[string]any)

	var model QueryModel
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return nil
	}

	// Setting metric and aggregator
	metric["metric"] = model.Metric
	metric["aggregator"] = model.Aggregator

	// Setting downsampling options
	if !model.DisableDownsampling {
		downsampleInterval := model.DownsampleInterval
		if downsampleInterval == "" {
			if ms := query.Interval.Milliseconds(); ms > 0 {
				downsampleInterval = FormatDownsampleInterval(ms)
			} else {
				downsampleInterval = "1m"
			}
		} else if strings.Contains(downsampleInterval, ".") && strings.HasSuffix(downsampleInterval, "s") {
			if val, err := strconv.ParseFloat(strings.TrimSuffix(downsampleInterval, "s"), 64); err == nil {
				downsampleInterval = strconv.FormatInt(int64(val*1000), 10) + "ms"
			}
		}

		downsample := downsampleInterval + "-" + model.DownsampleAggregator
		if model.DownsampleFillPolicy != "" && model.DownsampleFillPolicy != "none" {
			metric["downsample"] = downsample + "-" + model.DownsampleFillPolicy
		} else {
			metric["downsample"] = downsample
		}
	}

	// Setting rate options
	if model.ShouldComputeRate {
		metric["rate"] = true
		rateOptions := make(map[string]any)
		rateOptions["counter"] = model.IsCounter

		var counterMax *float64
		if model.CounterMax != "" {
			if val, err := strconv.ParseFloat(model.CounterMax, 64); err == nil {
				counterMax = &val
			}
		}
		if counterMax != nil {
			rateOptions["counterMax"] = *counterMax
		}

		var counterResetValue *float64
		if model.CounterResetValue != "" {
			if val, err := strconv.ParseFloat(model.CounterResetValue, 64); err == nil {
				counterResetValue = &val
			}
		}
		if counterResetValue != nil {
			rateOptions["resetValue"] = *counterResetValue
		}

		if counterMax == nil && (counterResetValue == nil || *counterResetValue == 0) {
			rateOptions["dropResets"] = true
		}

		metric["rateOptions"] = rateOptions
	}

	// Setting tags
	if len(model.Tags) > 0 {
		metric["tags"] = model.Tags
	}

	// Setting filters
	if len(model.Filters) > 0 {
		metric["filters"] = model.Filters
	}

	if model.ExplicitTags {
		metric["explicitTags"] = true
	}

	return metric
}

func CreateRequest(ctx context.Context, logger log.Logger, dsInfo *datasourceInfo, data OpenTsdbQuery) (*http.Request, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "api/query")
	if dsInfo.TSDBVersion == 4 {
		queryParams := u.Query()
		queryParams.Set("arrays", "true")
		u.RawQuery = queryParams.Encode()
	}

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

func DecodeResponseBody(res *http.Response, logger log.Logger) ([]byte, error) {
	encoding := res.Header.Get("Content-Encoding")
	var reader io.Reader

	switch encoding {
	case "gzip":
		gzipReader, err := gzip.NewReader(res.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to create gzip reader: %w", err)
		}
		defer func() {
			if err := gzipReader.Close(); err != nil {
				logger.Warn("Failed to close gzip reader", "error", err)
			}
		}()
		reader = gzipReader
	default:
		reader = res.Body
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return body, nil
}

func CreateDataFrame(val OpenTsdbCommon, length int, refID string) *data.Frame {
	labels := data.Labels{}
	for label, value := range val.Tags {
		labels[label] = value
	}

	tagKeys := make([]string, 0, len(val.Tags)+len(val.AggregateTags))
	for tagKey := range val.Tags {
		tagKeys = append(tagKeys, tagKey)
	}
	sort.Strings(tagKeys)
	tagKeys = append(tagKeys, val.AggregateTags...)

	frame := data.NewFrameOfFieldTypes(val.Metric, length, data.FieldTypeTime, data.FieldTypeFloat64)
	frame.Meta = &data.FrameMeta{
		Type:        data.FrameTypeTimeSeriesMulti,
		TypeVersion: data.FrameTypeVersion{0, 1},
		Custom:      map[string]any{"tagKeys": tagKeys},
	}
	frame.RefID = refID
	timeField := frame.Fields[0]
	timeField.Name = data.TimeSeriesTimeFieldName
	dataField := frame.Fields[1]
	dataField.Name = val.Metric
	dataField.Labels = labels

	return frame
}

func ParseResponse(logger log.Logger, res *http.Response, refID string, tsdbVersion float32) (*backend.QueryDataResponse, error) {
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

	frames := data.Frames{}

	var responseData []OpenTsdbResponse
	var responseData24 []OpenTsdbResponse24
	if tsdbVersion == 4 {
		err = json.Unmarshal(body, &responseData24)
		if err != nil {
			logger.Info("Failed to unmarshal opentsdb response", "error", err, "status", res.Status, "body", string(body))
			return nil, err
		}

		frames = ParseResponse24(responseData24, refID, frames)
	} else {
		err = json.Unmarshal(body, &responseData)
		if err != nil {
			logger.Info("Failed to unmarshal opentsdb response", "error", err, "status", res.Status, "body", string(body))
			return nil, err
		}

		frames, err = ParseResponseLT24(responseData, refID, frames)
		if err != nil {
			return nil, err
		}
	}

	result := resp.Responses[refID]
	result.Frames = frames
	resp.Responses[refID] = result
	return resp, nil
}

func ParseResponse24(responseData []OpenTsdbResponse24, refID string, frames data.Frames) data.Frames {
	for _, val := range responseData {
		frame := CreateDataFrame(val.OpenTsdbCommon, len(val.DataPoints), refID)

		for i, point := range val.DataPoints {
			frame.SetRow(i, time.Unix(int64(point[0]), 0).UTC(), point[1])
		}

		frames = append(frames, frame)
	}

	return frames
}

func ParseResponseLT24(responseData []OpenTsdbResponse, refID string, frames data.Frames) (data.Frames, error) {
	for _, val := range responseData {
		frame := CreateDataFrame(val.OpenTsdbCommon, len(val.DataPoints), refID)

		// Order the timestamps in ascending order to avoid issues like https://github.com/grafana/grafana/issues/38729
		timestamps := make([]string, 0, len(val.DataPoints))
		for timestamp := range val.DataPoints {
			timestamps = append(timestamps, timestamp)
		}
		sort.Strings(timestamps)

		for i, timeString := range timestamps {
			timestamp, err := strconv.ParseInt(timeString, 10, 64)
			if err != nil {
				logger.Info("Failed to unmarshal opentsdb timestamp", "timestamp", timeString)
				return frames, err
			}
			frame.SetRow(i, time.Unix(timestamp, 0).UTC(), val.DataPoints[timeString])
		}

		frames = append(frames, frame)
	}

	return frames, nil
}
