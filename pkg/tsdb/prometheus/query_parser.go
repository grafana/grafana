package prometheus

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

type QueryModel struct {
	Expr           string `json:"expr"`
	LegendFormat   string `json:"legendFormat"`
	Interval       string `json:"interval"`
	IntervalMS     int    `json:"intervalMS"`
	StepMode       string `json:"stepMode"`
	RangeQuery     bool   `json:"range"`
	InstantQuery   bool   `json:"instant"`
	IntervalFactor int    `json:"intervalFactor"`
}

func (s *Service) parseQuery(dsInfo *DatasourceInfo, queryContext *backend.QueryDataRequest) (
	[]PrometheusQuery, error) {
	qs := []PrometheusQuery{}
	for _, query := range queryContext.Queries {
		model := &QueryModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}

		interval, err := createInterval(dsInfo, model, query, s.intervalCalculator)
		if err != nil {
			return nil, err
		}

		// Replace global variables
		expr := model.Expr
		expr = strings.ReplaceAll(expr, "$__interval", intervalv2.FormatDuration(interval))
		expr = strings.ReplaceAll(expr, "$__interval_ms", strconv.FormatInt(int64(interval/time.Millisecond), 10))
		expr = strings.ReplaceAll(expr, "$__rate_interval", intervalv2.FormatDuration(calculateRateInterval(interval, dsInfo.TimeInterval, s.intervalCalculator)))
		expr = strings.ReplaceAll(expr, "$__range", strconv.FormatInt((query.TimeRange.To.Unix()-query.TimeRange.From.Unix()), 10)+"s")
		expr = strings.ReplaceAll(expr, "$__range_s", strconv.FormatInt((query.TimeRange.To.Unix()-query.TimeRange.From.Unix()), 10))
		expr = strings.ReplaceAll(expr, "$__range_ms", strconv.FormatInt((query.TimeRange.To.Unix()-query.TimeRange.From.Unix())/int64(time.Millisecond), 10))
		qs = append(qs, createQuery(model, interval, expr, query))
	}
	return qs, nil
}

func createQuery(model *QueryModel, step time.Duration, expr string, query backend.DataQuery) PrometheusQuery {
	queryType := Range
	if model.InstantQuery {
		queryType = Instant
	}

	queryModel := PrometheusQuery{
		Expr:         expr,
		Step:         step,
		LegendFormat: model.LegendFormat,
		Start:        query.TimeRange.From,
		End:          query.TimeRange.To,
		RefId:        query.RefID,
		QueryType:    queryType,
	}
	return queryModel
}

func createInterval(dsInfo *DatasourceInfo, model *QueryModel, query backend.DataQuery, intervalCalculator intervalv2.Calculator) (time.Duration, error) {
	if model.Interval == "$__interval" || model.Interval == "$__interval_ms" {
		model.Interval = ""
	}

	foundInterval, err := intervalv2.GetIntervalFrom(dsInfo.TimeInterval, model.Interval, int64(model.IntervalMS), 15*time.Second)
	if err != nil {
		return time.Duration(0), err
	}

	calculatedInterval := intervalCalculator.Calculate(query.TimeRange, foundInterval, query.MaxDataPoints)
	safeInterval := intervalCalculator.CalculateSafeInterval(query.TimeRange, int64(safeRes))

	adjustedInterval := safeInterval.Value
	if calculatedInterval.Value > safeInterval.Value {
		adjustedInterval = calculatedInterval.Value
	}

	intervalFactor := model.IntervalFactor
	if intervalFactor == 0 {
		intervalFactor = 1
	}
	finalInterval := time.Duration(int64(adjustedInterval) * int64(intervalFactor))

	return finalInterval, nil
}

func calculateRateInterval(interval time.Duration, scrapeInterval string, intervalCalculator intervalv2.Calculator) time.Duration {
	scrapeIntrvl := scrapeInterval
	if scrapeIntrvl == "" {
		scrapeIntrvl = "15s"
	}

	scrapeIntrvlDuration, err := intervalv2.ParseIntervalStringToTimeDuration(scrapeIntrvl)
	if err != nil {
		return time.Duration(0)
	}
	rateInterval := time.Duration(int(math.Max(float64(interval+scrapeIntrvlDuration), float64(float64(4)*float64(scrapeIntrvlDuration)))))

	return rateInterval
}
