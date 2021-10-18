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

func (s *Service) parseQuery(queryContext *backend.QueryDataRequest, dsInfo *DatasourceInfo) ([]*PrometheusQuery, error) {
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

		qs = append(qs, &PrometheusQuery{
			Expr:          expr,
			Step:          interval,
			LegendFormat:  model.LegendFormat,
			Start:         query.TimeRange.From,
			End:           query.TimeRange.To,
			RefId:         query.RefID,
			InstantQuery:  model.InstantQuery,
			RangeQuery:    rangeQuery,
			ExemplarQuery: model.ExemplarQuery,
			UtcOffsetSec:  model.UtcOffsetSec,
		})
	}
	return qs, nil
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
