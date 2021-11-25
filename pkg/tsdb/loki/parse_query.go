package loki

import (
	"encoding/json"
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

	return expr
}

func parseQuery(dsInfo *datasourceInfo, queryContext *backend.QueryDataRequest) ([]*lokiQuery, error) {
	qs := []*lokiQuery{}
	for _, query := range queryContext.Queries {
		model := &ResponseModel{}
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

		qs = append(qs, &lokiQuery{
			Expr:         expr,
			Step:         step,
			LegendFormat: model.LegendFormat,
			Start:        start,
			End:          end,
			RefID:        query.RefID,
		})
	}

	return qs, nil
}
