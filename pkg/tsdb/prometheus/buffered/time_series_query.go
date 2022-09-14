package buffered

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/utils"
	"github.com/grafana/grafana/pkg/util/maputil"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"go.opentelemetry.io/otel/attribute"
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

// Internal interval and range variables with {} syntax
// Repetitive code, we should have functionality to unify these
const (
	varIntervalAlt     = "${__interval}"
	varIntervalMsAlt   = "${__interval_ms}"
	varRangeAlt        = "${__range}"
	varRangeSAlt       = "${__range_s}"
	varRangeMsAlt      = "${__range_ms}"
	varRateIntervalAlt = "${__rate_interval}"
)

const legendFormatAuto = "__auto"

var (
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	safeRes      = 11000
)

type Buffered struct {
	intervalCalculator intervalv2.Calculator
	tracer             tracing.Tracer
	client             apiv1.API
	log                log.Logger
	ID                 int64
	URL                string
	TimeInterval       string
}

// New creates and object capable of executing and parsing a Prometheus queries. It's "buffered" because there is
// another implementation capable of streaming parse the response.
func New(roundTripper http.RoundTripper, tracer tracing.Tracer, settings backend.DataSourceInstanceSettings, plog log.Logger) (*Buffered, error) {
	promClient, err := CreateClient(roundTripper, settings.URL)
	if err != nil {
		return nil, fmt.Errorf("error creating prom client: %v", err)
	}

	jsonData, err := utils.GetJsonData(settings)
	if err != nil {
		return nil, fmt.Errorf("error getting jsonData: %w", err)
	}

	timeInterval, err := maputil.GetStringOptional(jsonData, "timeInterval")
	if err != nil {
		return nil, err
	}

	return &Buffered{
		intervalCalculator: intervalv2.NewCalculator(),
		tracer:             tracer,
		log:                plog,
		client:             promClient,
		TimeInterval:       timeInterval,
		ID:                 settings.ID,
		URL:                settings.URL,
	}, nil
}

func (b *Buffered) ExecuteTimeSeriesQuery(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	queries, err := b.parseTimeSeriesQuery(req)
	if err != nil {
		result := backend.QueryDataResponse{
			Responses: backend.Responses{},
		}
		return &result, fmt.Errorf("error parsing time series query: %v", err)
	}

	return b.runQueries(ctx, queries)
}

func (b *Buffered) runQueries(ctx context.Context, queries []*PrometheusQuery) (*backend.QueryDataResponse, error) {
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}

	for _, query := range queries {
		b.log.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)

		ctx, endSpan := utils.StartTrace(ctx, b.tracer, "datasource.prometheus", []utils.Attribute{
			{Key: "expr", Value: query.Expr, Kv: attribute.Key("expr").String(query.Expr)},
			{Key: "start_unixnano", Value: query.Start, Kv: attribute.Key("start_unixnano").Int64(query.Start.UnixNano())},
			{Key: "stop_unixnano", Value: query.End, Kv: attribute.Key("stop_unixnano").Int64(query.End.UnixNano())},
		})
		defer endSpan()

		response := make(map[TimeSeriesQueryType]interface{})

		timeRange := apiv1.Range{
			Step: query.Step,
			// Align query range to step. It rounds start and end down to a multiple of step.
			Start: alignTimeRange(query.Start, query.Step, query.UtcOffsetSec),
			End:   alignTimeRange(query.End, query.Step, query.UtcOffsetSec),
		}

		if query.RangeQuery {
			rangeResponse, _, err := b.client.QueryRange(ctx, query.Expr, timeRange)
			if err != nil {
				b.log.Error("Range query failed", "query", query.Expr, "err", err)
				result.Responses[query.RefId] = backend.DataResponse{Error: err}
				continue
			}
			response[RangeQueryType] = rangeResponse
		}

		if query.InstantQuery {
			instantResponse, _, err := b.client.Query(ctx, query.Expr, query.End)
			if err != nil {
				b.log.Error("Instant query failed", "query", query.Expr, "err", err)
				result.Responses[query.RefId] = backend.DataResponse{Error: err}
				continue
			}
			response[InstantQueryType] = instantResponse
		}

		// This is a special case
		// If exemplar query returns error, we want to only log it and continue with other results processing
		if query.ExemplarQuery {
			exemplarResponse, err := b.client.QueryExemplars(ctx, query.Expr, timeRange.Start, timeRange.End)
			if err != nil {
				b.log.Error("Exemplar query failed", "query", query.Expr, "err", err)
			} else {
				response[ExemplarQueryType] = exemplarResponse
			}
		}

		frames, err := parseTimeSeriesResponse(response, query)
		if err != nil {
			return &result, err
		}

		// The ExecutedQueryString can be viewed in QueryInspector in UI
		for _, frame := range frames {
			frame.Meta.ExecutedQueryString = "Expr: " + query.Expr + "\n" + "Step: " + query.Step.String()
		}

		result.Responses[query.RefId] = backend.DataResponse{
			Frames: frames,
		}
	}

	return &result, nil
}

func formatLegend(metric model.Metric, query *PrometheusQuery) string {
	var legend = metric.String()

	if query.LegendFormat == legendFormatAuto {
		// If we have labels set legend to empty string to utilize the auto naming system
		if len(metric) > 0 {
			legend = ""
		}
	} else if query.LegendFormat != "" {
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

func (b *Buffered) parseTimeSeriesQuery(req *backend.QueryDataRequest) ([]*PrometheusQuery, error) {
	qs := []*PrometheusQuery{}
	for _, query := range req.Queries {
		model := &QueryModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, fmt.Errorf("error unmarshaling query model: %v", err)
		}
		//Final interval value
		interval, err := calculatePrometheusInterval(model, b.TimeInterval, query, b.intervalCalculator)
		if err != nil {
			return nil, fmt.Errorf("error calculating interval: %v", err)
		}

		// Interpolate variables in expr
		timeRange := query.TimeRange.To.Sub(query.TimeRange.From)
		expr := interpolateVariables(model, interval, timeRange, b.intervalCalculator, b.TimeInterval)
		rangeQuery := model.RangeQuery
		if !model.InstantQuery && !model.RangeQuery {
			// In older dashboards, we were not setting range query param and !range && !instant was run as range query
			rangeQuery = true
		}

		// We never want to run exemplar query for alerting
		exemplarQuery := model.ExemplarQuery
		if req.Headers["FromAlert"] == "true" {
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
			return nil, fmt.Errorf("unexpected result type: %s query: %s", v, query.Expr)
		}

		frames = append(frames, nextFrames...)
	}

	return frames, nil
}

func calculatePrometheusInterval(model *QueryModel, timeInterval string, query backend.DataQuery, intervalCalculator intervalv2.Calculator) (time.Duration, error) {
	queryInterval := model.Interval

	//If we are using variable for interval/step, we will replace it with calculated interval
	if isVariableInterval(queryInterval) {
		queryInterval = ""
	}

	minInterval, err := intervalv2.GetIntervalFrom(timeInterval, queryInterval, model.IntervalMS, 15*time.Second)
	if err != nil {
		return time.Duration(0), err
	}
	calculatedInterval := intervalCalculator.Calculate(query.TimeRange, minInterval, query.MaxDataPoints)
	safeInterval := intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeRes))

	adjustedInterval := safeInterval.Value
	if calculatedInterval.Value > safeInterval.Value {
		adjustedInterval = calculatedInterval.Value
	}

	if model.Interval == varRateInterval || model.Interval == varRateIntervalAlt {
		// Rate interval is final and is not affected by resolution
		return calculateRateInterval(adjustedInterval, timeInterval, intervalCalculator), nil
	} else {
		intervalFactor := model.IntervalFactor
		if intervalFactor == 0 {
			intervalFactor = 1
		}
		return time.Duration(int64(adjustedInterval) * intervalFactor), nil
	}
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

	rateInterval := time.Duration(int64(math.Max(float64(interval+scrapeIntervalDuration), float64(4)*float64(scrapeIntervalDuration))))
	return rateInterval
}

func interpolateVariables(model *QueryModel, interval time.Duration, timeRange time.Duration, intervalCalculator intervalv2.Calculator, timeInterval string) string {
	expr := model.Expr
	rangeMs := timeRange.Milliseconds()
	rangeSRounded := int64(math.Round(float64(rangeMs) / 1000.0))

	var rateInterval time.Duration
	if model.Interval == varRateInterval || model.Interval == varRateIntervalAlt {
		rateInterval = interval
	} else {
		rateInterval = calculateRateInterval(interval, timeInterval, intervalCalculator)
	}

	expr = strings.ReplaceAll(expr, varIntervalMs, strconv.FormatInt(int64(interval/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varInterval, intervalv2.FormatDuration(interval))
	expr = strings.ReplaceAll(expr, varRangeMs, strconv.FormatInt(rangeMs, 10))
	expr = strings.ReplaceAll(expr, varRangeS, strconv.FormatInt(rangeSRounded, 10))
	expr = strings.ReplaceAll(expr, varRange, strconv.FormatInt(rangeSRounded, 10)+"s")
	expr = strings.ReplaceAll(expr, varRateInterval, rateInterval.String())

	// Repetitive code, we should have functionality to unify these
	expr = strings.ReplaceAll(expr, varIntervalMsAlt, strconv.FormatInt(int64(interval/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varIntervalAlt, intervalv2.FormatDuration(interval))
	expr = strings.ReplaceAll(expr, varRangeMsAlt, strconv.FormatInt(rangeMs, 10))
	expr = strings.ReplaceAll(expr, varRangeSAlt, strconv.FormatInt(rangeSRounded, 10))
	expr = strings.ReplaceAll(expr, varRangeAlt, strconv.FormatInt(rangeSRounded, 10)+"s")
	expr = strings.ReplaceAll(expr, varRateIntervalAlt, rateInterval.String())
	return expr
}

func matrixToDataFrames(matrix model.Matrix, query *PrometheusQuery, frames data.Frames) data.Frames {
	for _, v := range matrix {
		tags := make(map[string]string, len(v.Metric))
		for k, v := range v.Metric {
			tags[string(k)] = string(v)
		}
		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, len(v.Values))
		valueField := data.NewFieldFromFieldType(data.FieldTypeFloat64, len(v.Values))

		for i, k := range v.Values {
			timeField.Set(i, k.Timestamp.Time().UTC())
			value := float64(k.Value)

			if !math.IsNaN(value) {
				valueField.Set(i, value)
			}
		}

		name := formatLegend(v.Metric, query)
		timeField.Name = data.TimeSeriesTimeFieldName
		timeField.Config = &data.FieldConfig{Interval: float64(query.Step.Milliseconds())}
		valueField.Name = data.TimeSeriesValueFieldName
		valueField.Labels = tags

		if name != "" {
			valueField.Config = &data.FieldConfig{DisplayNameFromDS: name}
		}

		frames = append(frames, newDataFrame(name, "matrix", timeField, valueField))
	}

	return frames
}

func scalarToDataFrames(scalar *model.Scalar, query *PrometheusQuery, frames data.Frames) data.Frames {
	timeVector := []time.Time{scalar.Timestamp.Time().UTC()}
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
		timeVector := []time.Time{v.Timestamp.Time().UTC()}
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

// normalizeExemplars transforms the exemplar results into a single list of events. At the same time we make sure
// that all exemplar events have the same labels which is important when converting to dataFrames so that we have
// the same length of each field (each label will be a separate field). Exemplars can have different label either
// because the exemplar event have different labels or because they are from different series.
// Reason why we merge exemplars into single list even if they are from different series is that for example in case
// of a histogram query, like histogram_quantile(0.99, sum(rate(traces_spanmetrics_duration_seconds_bucket[15s])) by (le))
// Prometheus still returns all the exemplars for all the series of metric traces_spanmetrics_duration_seconds_bucket.
// Which makes sense because each histogram bucket is separate series but we still want to show all the exemplars for
// the metric and we don't specifically care which buckets they are from.
// For non histogram queries or if you split by some label it would probably be nicer to then split also exemplars to
// multiple frames (so they will have different symbols in the UI) but that would require understanding the query so it
// is not implemented now.
func normalizeExemplars(response []apiv1.ExemplarQueryResult) []ExemplarEvent {
	// TODO: this preallocation is very naive.
	// We should figure out a better approximation here.
	events := make([]ExemplarEvent, 0, len(response)*2)

	// Get all the labels across all exemplars both from the examplars and their series labels. We will use this to make
	// sure the resulting data frame has consistent number of values in each column.
	eventLabels := make(map[string]struct{})
	for _, exemplarData := range response {
		// Check each exemplar labels as there isn't a guarantee they are consistent
		for _, exemplar := range exemplarData.Exemplars {
			for label := range exemplar.Labels {
				eventLabels[string(label)] = struct{}{}
			}
		}

		for label := range exemplarData.SeriesLabels {
			eventLabels[string(label)] = struct{}{}
		}
	}

	for _, exemplarData := range response {
		for _, exemplar := range exemplarData.Exemplars {
			event := ExemplarEvent{}
			exemplarTime := exemplar.Timestamp.Time().UTC()
			event.Time = exemplarTime
			event.Value = float64(exemplar.Value)
			event.Labels = make(map[string]string)

			// Fill in all the labels from eventLabels with values from exemplar labels or series labels or fill with
			// empty string
			for label := range eventLabels {
				if _, ok := exemplar.Labels[model.LabelName(label)]; ok {
					event.Labels[label] = string(exemplar.Labels[model.LabelName(label)])
				} else if _, ok := exemplarData.SeriesLabels[model.LabelName(label)]; ok {
					event.Labels[label] = string(exemplarData.SeriesLabels[model.LabelName(label)])
				} else {
					event.Labels[label] = ""
				}
			}

			events = append(events, event)
		}
	}
	return events
}

func exemplarToDataFrames(response []apiv1.ExemplarQueryResult, query *PrometheusQuery, frames data.Frames) data.Frames {
	events := normalizeExemplars(response)

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

	// Sort the labels/fields so that it is consistent (mainly for easier testing)
	allLabels := sortedLabels(labelsVector)
	for _, label := range allLabels {
		dataFields = append(dataFields, data.NewField(label, nil, labelsVector[label]))
	}

	return append(frames, newDataFrame("exemplar", "exemplar", dataFields...))
}

func sortedLabels(labelsVector map[string][]string) []string {
	allLabels := make([]string, len(labelsVector))
	i := 0
	for key := range labelsVector {
		allLabels[i] = key
		i++
	}
	sort.Strings(allLabels)
	return allLabels
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
		Type: data.FrameTypeTimeSeriesMany,
		Custom: map[string]string{
			"resultType": typ, // Note: SSE depends on this property and map type
		},
	}

	return frame
}

func alignTimeRange(t time.Time, step time.Duration, offset int64) time.Time {
	offsetNano := float64(offset * 1e9)
	stepNano := float64(step.Nanoseconds())
	return time.Unix(0, int64(math.Floor((float64(t.UnixNano())+offsetNano)/stepNano)*stepNano-offsetNano))
}

func isVariableInterval(interval string) bool {
	if interval == varInterval || interval == varIntervalMs || interval == varRateInterval {
		return true
	}
	//Repetitive code, we should have functionality to unify these
	if interval == varIntervalAlt || interval == varIntervalMsAlt || interval == varRateIntervalAlt {
		return true
	}
	return false
}
