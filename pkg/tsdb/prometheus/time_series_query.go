package prometheus

import (
	"context"
	"encoding/json"
	"math"
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

//Internal interval and range variables
const (
	varInterval     = "$__interval"
	varIntervalMs   = "$__interval_ms"
	varRange        = "$__range"
	varRangeS       = "$__range_s"
	varRangeMs      = "$__range_ms"
	varRateInterval = "$__rate_interval"
)

//Internal interval and range variables with {} syntax
//Repetitive code, we should have functionality to unify these
const (
	varIntervalAlt     = "${__interval}"
	varIntervalMsAlt   = "${__interval_ms}"
	varRangeAlt        = "${__range}"
	varRangeSAlt       = "${__range_s}"
	varRangeMsAlt      = "${__range_ms}"
	varRateIntervalAlt = "${__rate_interval}"
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
		//If we are using variable or interval/step with {} syntax, we will replace it with calculated interval
		//Repetitive code, we should have functionality to unify these
		if queryInterval == varIntervalAlt || queryInterval == varIntervalMsAlt || queryInterval == varRateIntervalAlt {
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

		if queryInterval == varRateInterval || queryInterval == varRateIntervalAlt {
			// Rate interval is final and is not affected by resolution
			interval = calculateRateInterval(adjustedInterval, dsInfo.TimeInterval, s.intervalCalculator)
		} else {
			intervalFactor := model.IntervalFactor
			if intervalFactor == 0 {
				intervalFactor = 1
			}
			interval = time.Duration(int64(adjustedInterval) * intervalFactor)
		}

		// Interpolate variables in expr
		timeRange := query.TimeRange.To.Sub(query.TimeRange.From)
		expr := interpolateVariables(model.Expr, interval, timeRange, s.intervalCalculator, dsInfo.TimeInterval)

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
			nextFrames = MatrixToDataFrames(v, query, nextFrames)
		case model.Vector:
			nextFrames = VectorToDataFrames(v, query, nextFrames)
		case *model.Scalar:
			nextFrames = ScalarToDataFrames(v, query, nextFrames)
		case []apiv1.ExemplarQueryResult:
			nextFrames = ExemplarToDataFrames(v, query, nextFrames)
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

func interpolateVariables(expr string, interval time.Duration, timeRange time.Duration, intervalCalculator intervalv2.Calculator, timeInterval string) string {
	rangeMs := timeRange.Milliseconds()
	rangeSRounded := int64(math.Round(float64(rangeMs) / 1000.0))

	expr = strings.ReplaceAll(expr, varIntervalMs, strconv.FormatInt(int64(interval/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varInterval, intervalv2.FormatDuration(interval))
	expr = strings.ReplaceAll(expr, varRangeMs, strconv.FormatInt(rangeMs, 10))
	expr = strings.ReplaceAll(expr, varRangeS, strconv.FormatInt(rangeSRounded, 10))
	expr = strings.ReplaceAll(expr, varRange, strconv.FormatInt(rangeSRounded, 10)+"s")
	expr = strings.ReplaceAll(expr, varRateInterval, intervalv2.FormatDuration(calculateRateInterval(interval, timeInterval, intervalCalculator)))

	// Repetitive code, we should have functionality to unify these
	expr = strings.ReplaceAll(expr, varIntervalMsAlt, strconv.FormatInt(int64(interval/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varIntervalAlt, intervalv2.FormatDuration(interval))
	expr = strings.ReplaceAll(expr, varRangeMsAlt, strconv.FormatInt(rangeMs, 10))
	expr = strings.ReplaceAll(expr, varRangeSAlt, strconv.FormatInt(rangeSRounded, 10))
	expr = strings.ReplaceAll(expr, varRangeAlt, strconv.FormatInt(rangeSRounded, 10)+"s")
	expr = strings.ReplaceAll(expr, varRateIntervalAlt, intervalv2.FormatDuration(calculateRateInterval(interval, timeInterval, intervalCalculator)))
	return expr
}
