package prometheus

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/opentracing/opentracing-go"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// Internal interval and range variables
const (
	varInterval     = "$__interval"
	varIntervalMs   = "$__interval_ms"
	varRange        = "$__range"
	varRangeS       = "$__range_s"
	varRangeMs      = "$__range_ms"
	varRateInterval = "$__rate_interval"
)

type TimeSeriesQueryType string

const (
	RangeQueryType    TimeSeriesQueryType = "range"
	InstantQueryType  TimeSeriesQueryType = "instant"
	ExemplarQueryType TimeSeriesQueryType = "exemplar"
)

func (s *Service) executeTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo *DatasourceInfo) (*backend.QueryDataResponse, error) {
	client := dsInfo.promClient

	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	queries, err := s.parseTimeSeriesQuery(req, dsInfo)
	if err != nil {
		return &result, err
	}

	for _, query := range queries {
		plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)

		span, ctx := opentracing.StartSpanFromContext(ctx, "datasource.prometheus")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		response := make(map[TimeSeriesQueryType]interface{})

		timeRange := apiv1.Range{
			Step: query.Step,
			// Align query range to step. It rounds start and end down to a multiple of step.
			Start: time.Unix(int64(math.Floor((float64(query.Start.Unix()+query.UtcOffsetSec)/query.Step.Seconds()))*query.Step.Seconds()-float64(query.UtcOffsetSec)), 0),
			End:   time.Unix(int64(math.Floor((float64(query.End.Unix()+query.UtcOffsetSec)/query.Step.Seconds()))*query.Step.Seconds()-float64(query.UtcOffsetSec)), 0),
		}

		if query.RangeQuery {
			rangeResponse, _, err := client.QueryRange(ctx, query.Expr, timeRange)
			if err != nil {
				plog.Error("Range query failed", "query", query.Expr, "err", err)
				result.Responses[query.RefId] = backend.DataResponse{Error: err}
				continue
			}
			response[RangeQueryType] = rangeResponse
		}

		if query.InstantQuery {
			instantResponse, _, err := client.Query(ctx, query.Expr, query.End)
			if err != nil {
				plog.Error("Instant query failed", "query", query.Expr, "err", err)
				result.Responses[query.RefId] = backend.DataResponse{Error: err}
				continue
			}
			response[InstantQueryType] = instantResponse
		}

		// This is a special case
		// If exemplar query returns error, we want to only log it and continue with other results processing
		if query.ExemplarQuery {
			exemplarResponse, err := client.QueryExemplars(ctx, query.Expr, timeRange.Start, timeRange.End)
			if err != nil {
				plog.Error("Exemplar query failed", "query", query.Expr, "err", err)
			} else {
				response[ExemplarQueryType] = exemplarResponse
			}
		}

		frames, err := parseTimeSeriesResponse(response, query)
		if err != nil {
			return &result, err
		}

		result.Responses[query.RefId] = backend.DataResponse{
			Frames: frames,
		}
	}

	return &result, nil
}

func formatLegend(metric model.Metric, query *PrometheusQuery) string {
	var legend string

	if query.LegendFormat == "" {
		legend = metric.String()
	} else {
		result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
			labelName := strings.Replace(string(in), "{{", "", 1)
			labelName = strings.Replace(labelName, "}}", "", 1)
			labelName = strings.TrimSpace(labelName)
			if val, exists := metric[model.LabelName(labelName)]; exists {
				return []byte(val)
			}
			return []byte{}
		})
		legend = string(result)
	}

	// If legend is empty brackets, use query expression
	if legend == "{}" {
		legend = query.Expr
	}

	return legend
}

func (s *Service) parseTimeSeriesQuery(queryContext *backend.QueryDataRequest, dsInfo *DatasourceInfo) ([]*PrometheusQuery, error) {
	qs := []*PrometheusQuery{}
	for _, query := range queryContext.Queries {
		model := &QueryModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}
		//Final interval value
		var interval time.Duration

		//Calculate interval
		queryInterval := model.Interval
		//If we are using variable or interval/step, we will replace it with calculated interval
		if queryInterval == varInterval || queryInterval == varIntervalMs || queryInterval == varRateInterval {
			queryInterval = ""
		}
		minInterval, err := intervalv2.GetIntervalFrom(dsInfo.TimeInterval, queryInterval, model.IntervalMS, 15*time.Second)
		if err != nil {
			return nil, err
		}

		calculatedInterval := s.intervalCalculator.Calculate(query.TimeRange, minInterval, query.MaxDataPoints)
		safeInterval := s.intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeRes))
		adjustedInterval := safeInterval.Value

		if calculatedInterval.Value > safeInterval.Value {
			adjustedInterval = calculatedInterval.Value
		}

		if queryInterval == varRateInterval {
			// Rate interval is final and is not affected by resolution
			interval = calculateRateInterval(adjustedInterval, dsInfo.TimeInterval, s.intervalCalculator)
		} else {
			intervalFactor := model.IntervalFactor
			if intervalFactor == 0 {
				intervalFactor = 1
			}
			interval = time.Duration(int64(adjustedInterval) * intervalFactor)
		}

		intervalMs := int64(interval / time.Millisecond)
		rangeS := query.TimeRange.To.Unix() - query.TimeRange.From.Unix()

		// Interpolate variables in expr
		expr := model.Expr
		expr = strings.ReplaceAll(expr, varIntervalMs, strconv.FormatInt(intervalMs, 10))
		expr = strings.ReplaceAll(expr, varInterval, intervalv2.FormatDuration(interval))
		expr = strings.ReplaceAll(expr, varRangeMs, strconv.FormatInt(rangeS*1000, 10))
		expr = strings.ReplaceAll(expr, varRangeS, strconv.FormatInt(rangeS, 10))
		expr = strings.ReplaceAll(expr, varRange, strconv.FormatInt(rangeS, 10)+"s")
		expr = strings.ReplaceAll(expr, varRateInterval, intervalv2.FormatDuration(calculateRateInterval(interval, dsInfo.TimeInterval, s.intervalCalculator)))

		rangeQuery := model.RangeQuery
		if !model.InstantQuery && !model.RangeQuery {
			// In older dashboards, we were not setting range query param and !range && !instant was run as range query
			rangeQuery = true
		}

		// We never want to run exemplar query for alerting
		exemplarQuery := model.ExemplarQuery
		if queryContext.Headers["FromAlert"] == "true" {
			exemplarQuery = false
		}

		qs = append(qs, &PrometheusQuery{
			Expr:          expr,
			Step:          interval,
			LegendFormat:  model.LegendFormat,
			Start:         query.TimeRange.From,
			End:           query.TimeRange.To,
			RefId:         query.RefID,
			InstantQuery:  model.InstantQuery,
			RangeQuery:    rangeQuery,
			ExemplarQuery: exemplarQuery,
			UtcOffsetSec:  model.UtcOffsetSec,
		})
	}
	return qs, nil
}

func parseTimeSeriesResponse(value map[TimeSeriesQueryType]interface{}, query *PrometheusQuery) (data.Frames, error) {
	var (
		frames     = data.Frames{}
		nextFrames = data.Frames{}
	)

	for _, value := range value {
		// Zero out the slice to prevent data corruption.
		nextFrames = nextFrames[:0]

		switch v := value.(type) {
		case model.Matrix:
			nextFrames = matrixToDataFrames(v, query, nextFrames)
		case model.Vector:
			nextFrames = vectorToDataFrames(v, query, nextFrames)
		case *model.Scalar:
			nextFrames = scalarToDataFrames(v, query, nextFrames)
		case []apiv1.ExemplarQueryResult:
			nextFrames = exemplarToDataFrames(v, query, nextFrames)
		default:
			plog.Error("Query returned unexpected result type", "type", v, "query", query.Expr)
			continue
		}

		frames = append(frames, nextFrames...)
	}

	return frames, nil
}

func calculateRateInterval(interval time.Duration, scrapeInterval string, intervalCalculator intervalv2.Calculator) time.Duration {
	scrape := scrapeInterval
	if scrape == "" {
		scrape = "15s"
	}

	scrapeIntervalDuration, err := intervalv2.ParseIntervalStringToTimeDuration(scrape)
	if err != nil {
		return time.Duration(0)
	}

	rateInterval := time.Duration(int(math.Max(float64(interval+scrapeIntervalDuration), float64(4)*float64(scrapeIntervalDuration))))
	return rateInterval
}

func matrixToDataFrames(matrix model.Matrix, query *PrometheusQuery, frames data.Frames) data.Frames {
	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, len(v.Values))
		valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(v.Values))

		for i, k := range v.Values {
			timeField.Set(i, time.Unix(k.Timestamp.Unix(), 0).UTC())
			value := float64(k.Value)
			if !math.IsNaN(value) {
				valueField.Set(i, &value)
			}
		}

		name := formatLegend(v.Metric, query)
		timeField.Name = data.TimeSeriesTimeFieldName
		valueField.Name = data.TimeSeriesValueFieldName
		valueField.Config = &data.FieldConfig{DisplayNameFromDS: name}
		valueField.Labels = tags

		frames = append(frames, newDataFrame(name, "matrix", timeField, valueField))
	}

	return frames
}

func scalarToDataFrames(scalar *model.Scalar, query *PrometheusQuery, frames data.Frames) data.Frames {
	timeVector := []time.Time{time.Unix(scalar.Timestamp.Unix(), 0).UTC()}
	values := []float64{float64(scalar.Value)}
	name := fmt.Sprintf("%g", values[0])

	return append(
		frames,
		newDataFrame(
			name,
			"scalar",
			data.NewField("Time", nil, timeVector),
			data.NewField("Value", nil, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}),
		),
	)
}

func vectorToDataFrames(vector model.Vector, query *PrometheusQuery, frames data.Frames) data.Frames {
	for _, v := range vector {
		name := formatLegend(v.Metric, query)
		tags := make(map[string]string, len(v.Metric))
		timeVector := []time.Time{time.Unix(v.Timestamp.Unix(), 0).UTC()}
		values := []float64{float64(v.Value)}

		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}

		frames = append(
			frames,
			newDataFrame(
				name,
				"vector",
				data.NewField("Time", nil, timeVector),
				data.NewField("Value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: name}),
			),
		)
	}

	return frames
}

func exemplarToDataFrames(response []apiv1.ExemplarQueryResult, query *PrometheusQuery, frames data.Frames) data.Frames {
	// TODO: this preallocation is very naive.
	// We should figure out a better approximation here.
	events := make([]ExemplarEvent, 0, len(response)*2)

	for _, exemplarData := range response {
		for _, exemplar := range exemplarData.Exemplars {
			event := ExemplarEvent{}
			exemplarTime := time.Unix(exemplar.Timestamp.Unix(), 0).UTC()
			event.Time = exemplarTime
			event.Value = float64(exemplar.Value)
			event.Labels = make(map[string]string)

			for label, value := range exemplar.Labels {
				event.Labels[string(label)] = string(value)
			}

			for seriesLabel, seriesValue := range exemplarData.SeriesLabels {
				event.Labels[string(seriesLabel)] = string(seriesValue)
			}

			events = append(events, event)
		}
	}

	// Sampling of exemplars
	bucketedExemplars := make(map[string][]ExemplarEvent)
	values := make([]float64, 0, len(events))

	// Create bucketed exemplars based on aligned timestamp
	for _, event := range events {
		alignedTs := fmt.Sprintf("%.0f", math.Floor(float64(event.Time.Unix())/query.Step.Seconds())*query.Step.Seconds())
		_, ok := bucketedExemplars[alignedTs]
		if !ok {
			bucketedExemplars[alignedTs] = make([]ExemplarEvent, 0)
		}

		bucketedExemplars[alignedTs] = append(bucketedExemplars[alignedTs], event)
		values = append(values, event.Value)
	}

	// Calculate standard deviation
	standardDeviation := deviation(values)

	// Create slice with all of the bucketed exemplars
	sampledBuckets := make([]string, len(bucketedExemplars))
	for bucketTimes := range bucketedExemplars {
		sampledBuckets = append(sampledBuckets, bucketTimes)
	}
	sort.Strings(sampledBuckets)

	// Sample exemplars based ona value, so we are not showing too many of them
	sampleExemplars := make([]ExemplarEvent, 0, len(sampledBuckets))
	for _, bucket := range sampledBuckets {
		exemplarsInBucket := bucketedExemplars[bucket]
		if len(exemplarsInBucket) == 1 {
			sampleExemplars = append(sampleExemplars, exemplarsInBucket[0])
		} else {
			bucketValues := make([]float64, len(exemplarsInBucket))
			for _, exemplar := range exemplarsInBucket {
				bucketValues = append(bucketValues, exemplar.Value)
			}
			sort.Slice(bucketValues, func(i, j int) bool {
				return bucketValues[i] > bucketValues[j]
			})

			sampledBucketValues := make([]float64, 0)
			for _, value := range bucketValues {
				if len(sampledBucketValues) == 0 {
					sampledBucketValues = append(sampledBucketValues, value)
				} else {
					// Then take values only when at least 2 standard deviation distance to previously taken value
					prev := sampledBucketValues[len(sampledBucketValues)-1]
					if standardDeviation != 0 && prev-value >= float64(2)*standardDeviation {
						sampledBucketValues = append(sampledBucketValues, value)
					}
				}
			}
			for _, valueBucket := range sampledBucketValues {
				for _, exemplar := range exemplarsInBucket {
					if exemplar.Value == valueBucket {
						sampleExemplars = append(sampleExemplars, exemplar)
					}
				}
			}
		}
	}

	// Create DF from sampled exemplars
	timeField := data.NewFieldFromFieldType(data.FieldTypeTime, len(sampleExemplars))
	timeField.Name = "Time"
	valueField := data.NewFieldFromFieldType(data.FieldTypeFloat64, len(sampleExemplars))
	valueField.Name = "Value"
	labelsVector := make(map[string][]string, len(sampleExemplars))

	for i, exemplar := range sampleExemplars {
		timeField.Set(i, exemplar.Time)
		valueField.Set(i, exemplar.Value)

		for label, value := range exemplar.Labels {
			if labelsVector[label] == nil {
				labelsVector[label] = make([]string, 0)
			}

			labelsVector[label] = append(labelsVector[label], value)
		}
	}

	dataFields := make([]*data.Field, 0, len(labelsVector)+2)
	dataFields = append(dataFields, timeField, valueField)
	for label, vector := range labelsVector {
		dataFields = append(dataFields, data.NewField(label, nil, vector))
	}

	return append(frames, newDataFrame("exemplar", "exemplar", dataFields...))
}

func deviation(values []float64) float64 {
	var sum, mean, sd float64
	valuesLen := float64(len(values))
	for _, value := range values {
		sum += value
	}
	mean = sum / valuesLen
	for j := 0; j < len(values); j++ {
		sd += math.Pow(values[j]-mean, 2)
	}
	return math.Sqrt(sd / (valuesLen - 1))
}

func newDataFrame(name string, typ string, fields ...*data.Field) *data.Frame {
	frame := data.NewFrame(name, fields...)
	frame.Meta = &data.FrameMeta{
		Custom: map[string]string{
			"resultType": typ,
		},
	}

	return frame
}
