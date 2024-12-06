package cloudmonitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func addInterval(period string, field *data.Field) error {
	period = strings.TrimPrefix(period, "+")
	p, err := gtime.ParseIntervalStringToTimeDuration(period)
	if err != nil {
		return err
	}

	if field.Config != nil {
		field.Config.Interval = float64(p.Milliseconds())
	} else {
		field.SetConfig(&data.FieldConfig{
			Interval: float64(p.Milliseconds()),
		})
	}

	return nil
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	return v.(string)
}

func createRequest(ctx context.Context, dsInfo *datasourceInfo, proxyPass string, body io.Reader) (*http.Request, error) {
	u, err := url.Parse(dsInfo.url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	method := http.MethodGet
	if body != nil {
		method = http.MethodPost
	}
	req, err := http.NewRequestWithContext(ctx, method, dsInfo.services[cloudMonitor].url, body)
	if err != nil {
		backend.Logger.Error("Failed to create request", "error", err, "statusSource", backend.ErrorSourceDownstream)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.URL.Path = proxyPass

	return req, nil
}

func doRequestPage(_ context.Context, r *http.Request, dsInfo datasourceInfo, params url.Values, body map[string]any, logger log.Logger) (cloudMonitoringResponse, error) {
	if params != nil {
		r.URL.RawQuery = params.Encode()
	}
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return cloudMonitoringResponse{}, err
		}
		r.Body = io.NopCloser(bytes.NewBuffer(buf))
		r.Method = http.MethodPost
	}
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	if err != nil {
		return cloudMonitoringResponse{}, backend.DownstreamError(err)
	}

	defer func() {
		if err = res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "error", err)
		}
	}()

	dnext, err := unmarshalResponse(res, logger)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}

	return dnext, nil
}

func doRequestWithPagination(ctx context.Context, r *http.Request, dsInfo datasourceInfo, params url.Values, body map[string]any, logger log.Logger) (cloudMonitoringResponse, error) {
	d, err := doRequestPage(ctx, r, dsInfo, params, body, logger)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}
	for d.NextPageToken != "" {
		if params != nil {
			params["pageToken"] = []string{d.NextPageToken}
		}
		if body != nil {
			body["pageToken"] = d.NextPageToken
		}
		nextPage, err := doRequestPage(ctx, r, dsInfo, params, body, logger)
		if err != nil {
			return cloudMonitoringResponse{}, err
		}
		d.TimeSeries = append(d.TimeSeries, nextPage.TimeSeries...)
		d.TimeSeriesData = append(d.TimeSeriesData, nextPage.TimeSeriesData...)
		d.NextPageToken = nextPage.NextPageToken
	}
	return d, nil
}

func traceReq(ctx context.Context, req *backend.QueryDataRequest, dsInfo datasourceInfo, _ *http.Request, target string) trace.Span {
	_, span := tracing.DefaultTracer().Start(ctx, "cloudMonitoring query", trace.WithAttributes(
		attribute.String("target", target),
		attribute.String("from", req.Queries[0].TimeRange.From.String()),
		attribute.String("until", req.Queries[0].TimeRange.To.String()),
		attribute.Int64("datasource_id", dsInfo.id),
		attribute.Int64("org_id", req.PluginContext.OrgID),
	))
	defer span.End()
	return span
}

func runTimeSeriesRequest(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, projectName string, params url.Values, body map[string]any, logger log.Logger) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	dr := &backend.DataResponse{}
	projectName, err := s.ensureProject(ctx, dsInfo, projectName)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}
	timeSeriesMethod := "timeSeries"
	if body != nil {
		timeSeriesMethod += ":query"
	}
	r, err := createRequest(ctx, &dsInfo, path.Join("/v3/projects", projectName, timeSeriesMethod), nil)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	span := traceReq(ctx, req, dsInfo, r, params.Encode())
	defer span.End()

	d, err := doRequestWithPagination(ctx, r, dsInfo, params, body, logger)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	return dr, d, r.URL.RawQuery, nil
}

func bucketFrame(
	bucketOptions cloudMonitoringBucketOptions,
	bucketBoundIndex int,
	metricType string,
	defaultMetricName string,
	query cloudMonitoringQueryExecutor,
	seriesLabels map[string]string,
	frameMeta *data.FrameMeta,
) *data.Frame {
	// set lower bounds
	// https://cloud.google.com/monitoring/api/ref_v3/rest/v3/TimeSeries#Distribution
	bucketBound := calcBucketBound(bucketOptions, bucketBoundIndex)
	additionalLabels := map[string]string{"bucket": bucketBound}

	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, []time.Time{})
	valueField := data.NewField(data.TimeSeriesValueFieldName, nil, []float64{})

	frameName := formatLegendKeys(metricType, defaultMetricName, nil, additionalLabels, query)
	valueField.Name = frameName
	valueField.Labels = seriesLabels
	setDisplayNameAsFieldName(valueField)

	return &data.Frame{
		Name: frameName,
		Fields: []*data.Field{
			timeField,
			valueField,
		},
		RefID: query.getRefID(),
		Meta:  frameMeta,
	}
}

func handleDistributionSeries(
	it pointIterator,
	descriptorIndex int,
	defaultMetricName string,
	query cloudMonitoringQueryExecutor,
	seriesLabels map[string]string,
	frameMeta *data.FrameMeta,
) (map[int]*data.Frame, error) {
	buckets := make(map[int]*data.Frame)
	for i := it.length() - 1; i >= 0; i-- {
		point := it.getPoint(i)
		if len(point.bucketCounts(descriptorIndex)) == 0 {
			continue
		}
		maxKey := 0
		for i := 0; i < len(point.bucketCounts(descriptorIndex)); i++ {
			value, err := strconv.ParseFloat(point.bucketValue(descriptorIndex, i), 64)
			if err != nil {
				return nil, err
			}
			if _, ok := buckets[i]; !ok {
				buckets[i] = bucketFrame(
					point.bucketOptions(descriptorIndex), i,
					it.metricType(), defaultMetricName, query,
					seriesLabels,
					frameMeta,
				)
				if maxKey < i {
					maxKey = i
				}
			}
			buckets[i].AppendRow(point.endTime(), value)
		}

		// fill empty bucket
		for i := 0; i < maxKey; i++ {
			if _, ok := buckets[i]; !ok {
				buckets[i] = bucketFrame(
					point.bucketOptions(descriptorIndex), i,
					it.metricType(), defaultMetricName, query,
					seriesLabels,
					frameMeta,
				)
			}
		}
	}
	return buckets, nil
}

func handleNonDistributionSeries(
	series pointIterator,
	descriptorIndex int,
	defaultMetricName string,
	seriesLabels map[string]string,
	frame *data.Frame,
	query cloudMonitoringQueryExecutor,
) {
	for i := 0; i < series.length(); i++ {
		point := series.getPoint(i)
		value := point.doubleValue(descriptorIndex)

		if series.valueType() == "INT64" {
			parsedValue, err := strconv.ParseFloat(point.int64Value(descriptorIndex), 64)
			if err == nil {
				value = parsedValue
			}
		}

		if series.valueType() == "BOOL" {
			if point.boolValue(descriptorIndex) {
				value = 1
			} else {
				value = 0
			}
		}
		frame.SetRow(series.length()-1-i, point.endTime(), value)
	}

	metricName := formatLegendKeys(series.metricType(), defaultMetricName, seriesLabels, nil, query)
	dataField := frame.Fields[1]
	dataField.Name = metricName
	dataField.Labels = seriesLabels
	setDisplayNameAsFieldName(dataField)
}

func appendFrames(
	frames data.Frames,
	series pointIterator,
	descriptorIndex int,
	defaultMetricName string,
	seriesLabels map[string]string,
	frame *data.Frame,
	query cloudMonitoringQueryExecutor,
) (data.Frames, error) {
	if series.valueType() != "DISTRIBUTION" {
		handleNonDistributionSeries(series, descriptorIndex, defaultMetricName, seriesLabels, frame, query)
		return append(frames, frame), nil
	}
	buckets, err := handleDistributionSeries(series, descriptorIndex, defaultMetricName, query, seriesLabels, frame.Meta)
	if err != nil {
		return nil, err
	}
	for i := 0; i < len(buckets); i++ {
		frames = append(frames, buckets[i])
	}
	if len(buckets) == 0 {
		frames = append(frames, frame)
	}
	return frames, nil
}

func generateLink(projectName string, dataSets []map[string]any, start, end string) (string, error) {
	u, err := url.Parse("https://console.cloud.google.com/monitoring/metrics-explorer")
	if err != nil {
		return "", err
	}

	rawQuery := u.Query()
	rawQuery.Set("project", projectName)
	rawQuery.Set("Grafana_deeplink", "true")

	pageState := map[string]any{
		"xyChart": map[string]any{
			"constantLines":     []string{},
			"dataSets":          dataSets,
			"timeshiftDuration": "0s",
			"y1Axis": map[string]string{
				"label": "y1Axis",
				"scale": "LINEAR",
			},
		},
		"timeSelection": map[string]string{
			"timeRange": "custom",
			"start":     start,
			"end":       end,
		},
	}

	blob, err := json.Marshal(pageState)
	if err != nil {
		return "", err
	}

	rawQuery.Set("pageState", string(blob))
	u.RawQuery = rawQuery.Encode()

	accountChooserURL, err := url.Parse("https://accounts.google.com/AccountChooser")
	if err != nil {
		return "", err
	}
	accountChooserQuery := accountChooserURL.Query()
	accountChooserQuery.Set("continue", u.String())
	accountChooserURL.RawQuery = accountChooserQuery.Encode()

	return accountChooserURL.String(), nil
}
