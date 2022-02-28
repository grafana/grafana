package loki

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

const (
	varInterval   = "$__interval"
	varIntervalMs = "$__interval_ms"
	varRange      = "$__range"
	varRangeS     = "$__range_s"
	varRangeMs    = "$__range_ms"
)

const (
	varIntervalAlt   = "${__interval}"
	varIntervalMsAlt = "${__interval_ms}"
	varRangeAlt      = "${__range}"
	varRangeSAlt     = "${__range_s}"
	varRangeMsAlt    = "${__range_ms}"
)

func interpolateVariables(expr string, interval time.Duration, timeRange time.Duration) string {
	intervalText := intervalv2.FormatDuration(interval)
	intervalMsText := strconv.FormatInt(int64(interval/time.Millisecond), 10)

	rangeMs := timeRange.Milliseconds()
	rangeSRounded := int64(math.Round(float64(rangeMs) / 1000.0))
	rangeMsText := strconv.FormatInt(rangeMs, 10)
	rangeSText := strconv.FormatInt(rangeSRounded, 10)

	expr = strings.ReplaceAll(expr, varIntervalMs, intervalMsText)
	expr = strings.ReplaceAll(expr, varInterval, intervalText)
	expr = strings.ReplaceAll(expr, varRangeMs, rangeMsText)
	expr = strings.ReplaceAll(expr, varRangeS, rangeSText)
	expr = strings.ReplaceAll(expr, varRange, rangeSText+"s")

	// this is duplicated code, hopefully this can be handled in a nicer way when
	// https://github.com/grafana/grafana/issues/42928 is done.
	expr = strings.ReplaceAll(expr, varIntervalMsAlt, intervalMsText)
	expr = strings.ReplaceAll(expr, varIntervalAlt, intervalText)
	expr = strings.ReplaceAll(expr, varRangeMsAlt, rangeMsText)
	expr = strings.ReplaceAll(expr, varRangeSAlt, rangeSText)
	expr = strings.ReplaceAll(expr, varRangeAlt, rangeSText+"s")
	return expr
}

func parseQueryType(jsonValue string) (QueryType, error) {
	switch jsonValue {
	case "instant":
		return QueryTypeInstant, nil
	case "range":
		return QueryTypeRange, nil
	case "":
		// there are older queries stored in alerting that did not have queryType,
		// those were range-queries
		return QueryTypeRange, nil
	default:
		return QueryTypeRange, fmt.Errorf("invalid queryType: %s", jsonValue)
	}
}

func parseQuery(queryContext *backend.QueryDataRequest) ([]*lokiQuery, error) {
	qs := []*lokiQuery{}
	for _, query := range queryContext.Queries {
		model := &QueryJSONModel{}
		err := json.Unmarshal(query.JSON, model)
		if err != nil {
			return nil, err
		}

		start := query.TimeRange.From
		end := query.TimeRange.To

		var resolution int64 = 1
		if model.Resolution >= 1 && model.Resolution <= 5 || model.Resolution == 10 {
			resolution = model.Resolution
		}

		interval := query.Interval
		timeRange := query.TimeRange.To.Sub(query.TimeRange.From)

		step := calculateStep(interval, timeRange, resolution)

		expr := interpolateVariables(model.Expr, interval, timeRange)

		queryType, err := parseQueryType(model.QueryType)
		if err != nil {
			return nil, err
		}

		qs = append(qs, &lokiQuery{
			Expr:         expr,
			QueryType:    queryType,
			Step:         step,
			MaxLines:     model.MaxLines,
			LegendFormat: model.LegendFormat,
			Start:        start,
			End:          end,
			RefID:        query.RefID,
			VolumeQuery:  model.VolumeQuery,
		})
	}

	return qs, nil
}
