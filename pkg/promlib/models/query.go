package models

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	glog "github.com/grafana/grafana-plugin-sdk-go/backend/log"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	scope "github.com/grafana/grafana/apps/scope/pkg/apis/scope/v0alpha1"
	"github.com/grafana/grafana/pkg/promlib/intervalv2"
)

// PromQueryFormat defines model for PromQueryFormat.
// +enum
type PromQueryFormat string

const (
	PromQueryFormatTimeSeries PromQueryFormat = "time_series"
	PromQueryFormatTable      PromQueryFormat = "table"
	PromQueryFormatHeatmap    PromQueryFormat = "heatmap"
)

// UnmarshalJSON implements custom unmarshaling to handle both string and numeric format values.
// This provides a failsafe to prevent unmarshaling errors when clients incorrectly send
// numeric values instead of strings for the format field.
func (f *PromQueryFormat) UnmarshalJSON(data []byte) error {
	// Try to unmarshal as string first (the expected type)
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		// Validate that the string is one of the valid enum values
		switch s {
		case string(PromQueryFormatTimeSeries), string(PromQueryFormatTable), string(PromQueryFormatHeatmap):
			*f = PromQueryFormat(s)
		default:
			// Invalid string value, fall back to default
			*f = PromQueryFormatTimeSeries
		}
		return nil
	}

	// If that fails, try as number and convert to the default format
	// This handles cases where clients incorrectly send numeric values
	var n uint32
	if err := json.Unmarshal(data, &n); err == nil {
		// Map numbers to format strings for backwards compatibility
		switch int(n) {
		case 0, 1:
			*f = PromQueryFormatTimeSeries
		case 2:
			*f = PromQueryFormatTable
		case 3:
			*f = PromQueryFormatHeatmap
		default:
			*f = PromQueryFormatTimeSeries // default fallback
		}
		return nil
	}

	// If both fail, use default and don't error out (failsafe behavior)
	*f = PromQueryFormatTimeSeries
	return nil
}

// QueryEditorMode defines model for QueryEditorMode.
// +enum
type QueryEditorMode string

const (
	QueryEditorModeBuilder QueryEditorMode = "builder"
	QueryEditorModeCode    QueryEditorMode = "code"
)

// PrometheusQueryProperties defines the specific properties used for prometheus
type PrometheusQueryProperties struct {
	// The response format
	Format PromQueryFormat `json:"format,omitempty"`

	// The actual expression/query that will be evaluated by Prometheus
	Expr string `json:"expr"`

	// Returns a Range vector, comprised of a set of time series containing a range of data points over time for each time series
	Range bool `json:"range,omitempty"`

	// Returns only the latest value that Prometheus has scraped for the requested time series
	Instant bool `json:"instant,omitempty"`

	// Execute an additional query to identify interesting raw samples relevant for the given expr
	Exemplar bool `json:"exemplar,omitempty"`

	// what we should show in the editor
	EditorMode QueryEditorMode `json:"editorMode,omitempty"`

	// Used to specify how many times to divide max data points by. We use max data points under query options
	// See https://github.com/grafana/grafana/issues/48081
	// Deprecated: use interval
	IntervalFactor int64 `json:"intervalFactor,omitempty"`

	// Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname
	LegendFormat string `json:"legendFormat,omitempty"`

	// A set of filters applied to apply to the query
	Scopes []scope.ScopeSpec `json:"scopes,omitempty"`

	// Additional Ad-hoc filters that take precedence over Scope on conflict.
	AdhocFilters []scope.ScopeFilter `json:"adhocFilters,omitempty"`

	// Group By parameters to apply to aggregate expressions in the query
	GroupByKeys []string `json:"groupByKeys,omitempty"`
}

// Internal interval and range variables
const (
	varInterval       = "$__interval"
	varIntervalMs     = "$__interval_ms"
	varRange          = "$__range"
	varRangeS         = "$__range_s"
	varRangeMs        = "$__range_ms"
	varRateInterval   = "$__rate_interval"
	varRateIntervalMs = "$__rate_interval_ms"
)

// Internal interval and range variables with {} syntax
// Repetitive code, we should have functionality to unify these
const (
	varIntervalAlt       = "${__interval}"
	varIntervalMsAlt     = "${__interval_ms}"
	varRangeAlt          = "${__range}"
	varRangeSAlt         = "${__range_s}"
	varRangeMsAlt        = "${__range_ms}"
	varRateIntervalAlt   = "${__rate_interval}"
	varRateIntervalMsAlt = "${__rate_interval_ms}"
)

type TimeSeriesQueryType string

const (
	RangeQueryType    TimeSeriesQueryType = "range"
	InstantQueryType  TimeSeriesQueryType = "instant"
	ExemplarQueryType TimeSeriesQueryType = "exemplar"
	UnknownQueryType  TimeSeriesQueryType = "unknown"
)

var safeResolution = 11000

// QueryModel includes both the common and specific values
// NOTE: this struct may have issues when decoding JSON that requires the special handling
// registered in https://github.com/grafana/grafana-plugin-sdk-go/blob/v0.228.0/experimental/apis/datasource/v0alpha1/query.go#L298
type QueryModel struct {
	PrometheusQueryProperties    `json:",inline"`
	sdkapi.CommonQueryProperties `json:",inline"`

	// The following properties may be part of the request payload, however they are not saved in panel JSON
	// Timezone offset to align start & end time on backend
	UtcOffsetSec int64  `json:"utcOffsetSec,omitempty"`
	Interval     string `json:"interval,omitempty"`
}

type TimeRange struct {
	Start time.Time
	End   time.Time
	Step  time.Duration
}

// The internal query object
type Query struct {
	Expr          string
	Step          time.Duration
	LegendFormat  string
	Start         time.Time
	End           time.Time
	RefId         string
	InstantQuery  bool
	RangeQuery    bool
	ExemplarQuery bool
	UtcOffsetSec  int64

	Scopes []scope.ScopeSpec
}

// This internal query struct is just like QueryModel, except it does not include:
// sdkapi.CommonQueryProperties -- this avoids errors where the unused "datasource" property
// may be either a string or DataSourceRef
type internalQueryModel struct {
	PrometheusQueryProperties `json:",inline"`
	//sdkapi.CommonQueryProperties `json:",inline"`
	IntervalMS float64 `json:"intervalMs,omitempty"`

	// The following properties may be part of the request payload, however they are not saved in panel JSON
	// Timezone offset to align start & end time on backend
	UtcOffsetSec int64  `json:"utcOffsetSec,omitempty"`
	Interval     string `json:"interval,omitempty"`
}

func Parse(ctx context.Context, log glog.Logger, span trace.Span, query backend.DataQuery, dsScrapeInterval string, intervalCalculator intervalv2.Calculator, fromAlert bool) (*Query, error) {
	model := &internalQueryModel{}
	if err := json.Unmarshal(query.JSON, model); err != nil {
		return nil, backend.DownstreamErrorf("error unmarshaling query: %w", err)
	}
	span.SetAttributes(attribute.String("rawExpr", model.Expr))

	// Final step value for prometheus
	calculatedStep, err := calculatePrometheusInterval(model.Interval, dsScrapeInterval, int64(model.IntervalMS), model.IntervalFactor, query, intervalCalculator)
	if err != nil {
		return nil, err
	}

	// Interpolate variables in expr
	timeRange := query.TimeRange.To.Sub(query.TimeRange.From)
	expr := InterpolateVariables(
		model.Expr,
		query.Interval,
		calculatedStep,
		model.Interval,
		dsScrapeInterval,
		timeRange,
	)

	var scopeFilters []scope.ScopeFilter
	for _, scope := range model.Scopes {
		scopeFilters = append(scopeFilters, scope.Filters...)
	}

	if len(scopeFilters) > 0 {
		span.SetAttributes(attribute.StringSlice("scopeFilters", func() []string {
			filters := make([]string, 0, len(scopeFilters))
			for _, f := range scopeFilters {
				filters = append(filters, fmt.Sprintf("%q %q %q", f.Key, f.Operator, f.Value))
			}
			return filters
		}()))
	}

	if len(model.AdhocFilters) > 0 {
		span.SetAttributes(attribute.StringSlice("adhocFilters", func() []string {
			var filters []string //nolint:prealloc
			for _, f := range model.AdhocFilters {
				filters = append(filters, fmt.Sprintf("%q %q %q", f.Key, f.Operator, f.Value))
			}
			return filters
		}()))
	}

	if len(scopeFilters) > 0 || len(model.AdhocFilters) > 0 || len(model.GroupByKeys) > 0 {
		log.Info("Applying scope filters", "scopeFiltersCount", len(scopeFilters), "adhocFiltersCount", len(model.AdhocFilters), "groupByKeysCount", len(model.GroupByKeys))
		expr, err = ApplyFiltersAndGroupBy(expr, scopeFilters, model.AdhocFilters, model.GroupByKeys)
		if err != nil {
			return nil, err
		}
	}

	if !model.Instant && !model.Range {
		// In older dashboards, we were not setting range query param and !range && !instant was run as range query
		model.Range = true
	}

	// We never want to run exemplar query for alerting
	if fromAlert {
		model.Exemplar = false
	}

	span.SetAttributes(
		attribute.String("expr", expr),
		attribute.Int64("start_unixnano", query.TimeRange.From.UnixNano()),
		attribute.Int64("stop_unixnano", query.TimeRange.To.UnixNano()),
	)

	return &Query{
		Expr:          expr,
		Step:          calculatedStep,
		LegendFormat:  model.LegendFormat,
		Start:         query.TimeRange.From,
		End:           query.TimeRange.To,
		RefId:         query.RefID,
		InstantQuery:  model.Instant,
		RangeQuery:    model.Range,
		ExemplarQuery: model.Exemplar,
		UtcOffsetSec:  model.UtcOffsetSec,
	}, nil
}

func (query *Query) Type() TimeSeriesQueryType {
	if query.InstantQuery {
		return InstantQueryType
	}
	if query.RangeQuery {
		return RangeQueryType
	}
	if query.ExemplarQuery {
		return ExemplarQueryType
	}
	return UnknownQueryType
}

func (query *Query) TimeRange() TimeRange {
	return TimeRange{
		Step: query.Step,
		// Align query range to step. It rounds start and end down to a multiple of step.
		Start: AlignTimeRange(query.Start, query.Step, query.UtcOffsetSec),
		End:   AlignTimeRange(query.End, query.Step, query.UtcOffsetSec),
	}
}

func calculatePrometheusInterval(
	queryInterval, dsScrapeInterval string,
	intervalMs, intervalFactor int64,
	query backend.DataQuery,
	intervalCalculator intervalv2.Calculator,
) (time.Duration, error) {
	// we need to compare the original query model after it is overwritten below to variables so that we can
	// calculate the rateInterval if it is equal to $__rate_interval or ${__rate_interval}
	originalQueryInterval := queryInterval

	// If we are using variable for interval/step, we will replace it with calculated interval
	if isVariableInterval(queryInterval) {
		queryInterval = ""
	}

	minInterval, err := gtime.GetIntervalFrom(dsScrapeInterval, queryInterval, intervalMs, 15*time.Second)
	if err != nil {
		return time.Duration(0), err
	}
	calculatedInterval := intervalCalculator.Calculate(query.TimeRange, minInterval, query.MaxDataPoints)
	safeInterval := intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeResolution))

	adjustedInterval := safeInterval.Value
	if calculatedInterval.Value > safeInterval.Value {
		adjustedInterval = calculatedInterval.Value
	}

	// here is where we compare for $__rate_interval or ${__rate_interval}
	if originalQueryInterval == varRateInterval || originalQueryInterval == varRateIntervalAlt {
		// Rate interval is final and is not affected by resolution
		return calculateRateInterval(adjustedInterval, dsScrapeInterval), nil
	} else {
		queryIntervalFactor := intervalFactor
		if queryIntervalFactor == 0 {
			queryIntervalFactor = 1
		}
		return time.Duration(int64(adjustedInterval) * queryIntervalFactor), nil
	}
}

// calculateRateInterval calculates the $__rate_interval value
// queryInterval is the value calculated range / maxDataPoints on the frontend
// queryInterval is shown on the Query Options Panel above the query editor
// requestedMinStep is the data source scrape interval (default 15s)
// requestedMinStep can be changed by setting "Min Step" value in Options panel below the code editor
func calculateRateInterval(
	queryInterval time.Duration,
	requestedMinStep string,
) time.Duration {
	scrape := requestedMinStep
	if scrape == "" {
		scrape = "15s"
	}

	scrapeIntervalDuration, err := gtime.ParseIntervalStringToTimeDuration(scrape)
	if err != nil {
		return time.Duration(0)
	}

	rateInterval := time.Duration(int64(math.Max(float64(queryInterval+scrapeIntervalDuration), float64(4)*float64(scrapeIntervalDuration))))
	return rateInterval
}

// InterpolateVariables interpolates built-in variables
// expr                         PromQL query
// queryInterval                Requested interval in milliseconds. This value may be overridden by MinStep in query options
// calculatedStep               Calculated final step value. It was calculated in calculatePrometheusInterval
// requestedMinStep             Requested minimum step value. QueryModel.interval
// dsScrapeInterval             Data source scrape interval in the config
// timeRange                    Requested time range for query
func InterpolateVariables(
	expr string,
	queryInterval time.Duration,
	calculatedStep time.Duration,
	requestedMinStep string,
	dsScrapeInterval string,
	timeRange time.Duration,
) string {
	rangeMs := timeRange.Milliseconds()
	rangeSRounded := int64(math.Round(float64(rangeMs) / 1000.0))

	var rateInterval time.Duration
	if requestedMinStep == varRateInterval || requestedMinStep == varRateIntervalAlt {
		rateInterval = calculatedStep
	} else {
		if requestedMinStep == varInterval || requestedMinStep == varIntervalAlt {
			requestedMinStep = calculatedStep.String()
		}
		if requestedMinStep == "" {
			requestedMinStep = dsScrapeInterval
		}
		rateInterval = calculateRateInterval(queryInterval, requestedMinStep)
	}

	expr = strings.ReplaceAll(expr, varIntervalMs, strconv.FormatInt(int64(calculatedStep/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varInterval, gtime.FormatInterval(calculatedStep))
	expr = strings.ReplaceAll(expr, varRangeMs, strconv.FormatInt(rangeMs, 10))
	expr = strings.ReplaceAll(expr, varRangeS, strconv.FormatInt(rangeSRounded, 10))
	expr = strings.ReplaceAll(expr, varRange, strconv.FormatInt(rangeSRounded, 10)+"s")
	expr = strings.ReplaceAll(expr, varRateIntervalMs, strconv.FormatInt(int64(rateInterval/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varRateInterval, rateInterval.String())

	// Repetitive code, we should have functionality to unify these
	expr = strings.ReplaceAll(expr, varIntervalMsAlt, strconv.FormatInt(int64(calculatedStep/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varIntervalAlt, gtime.FormatInterval(calculatedStep))
	expr = strings.ReplaceAll(expr, varRangeMsAlt, strconv.FormatInt(rangeMs, 10))
	expr = strings.ReplaceAll(expr, varRangeSAlt, strconv.FormatInt(rangeSRounded, 10))
	expr = strings.ReplaceAll(expr, varRangeAlt, strconv.FormatInt(rangeSRounded, 10)+"s")
	expr = strings.ReplaceAll(expr, varRateIntervalMsAlt, strconv.FormatInt(int64(rateInterval/time.Millisecond), 10))
	expr = strings.ReplaceAll(expr, varRateIntervalAlt, rateInterval.String())
	return expr
}

func isVariableInterval(interval string) bool {
	if interval == varInterval || interval == varIntervalMs || interval == varRateInterval || interval == varRateIntervalMs {
		return true
	}
	// Repetitive code, we should have functionality to unify these
	if interval == varIntervalAlt || interval == varIntervalMsAlt || interval == varRateIntervalAlt || interval == varRateIntervalMsAlt {
		return true
	}
	return false
}

// AlignTimeRange aligns query range to step and handles the time offset.
// It rounds start and end down to a multiple of step.
// Prometheus caching is dependent on the range being aligned with the step.
// Rounding to the step can significantly change the start and end of the range for larger steps, i.e. a week.
// In rounding the range to a 1w step the range will always start on a Thursday.
func AlignTimeRange(t time.Time, step time.Duration, offset int64) time.Time {
	offsetNano := float64(offset * 1e9)
	stepNano := float64(step.Nanoseconds())
	return time.Unix(0, int64(math.Floor((float64(t.UnixNano())+offsetNano)/stepNano)*stepNano-offsetNano)).UTC()
}

//go:embed query.types.json
var f embed.FS

// QueryTypeDefinitionsJSON returns the query type definitions
func QueryTypeDefinitionListJSON() (json.RawMessage, error) {
	return f.ReadFile("query.types.json")
}
