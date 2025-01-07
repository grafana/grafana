package loki

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

const (
	varInterval   = "$__interval"
	varIntervalMs = "$__interval_ms"
	varRange      = "$__range"
	varRangeS     = "$__range_s"
	varRangeMs    = "$__range_ms"
	varAuto       = "$__auto"
)

const (
	varIntervalAlt   = "${__interval}"
	varIntervalMsAlt = "${__interval_ms}"
	varRangeAlt      = "${__range}"
	varRangeSAlt     = "${__range_s}"
	varRangeMsAlt    = "${__range_ms}"
	// $__auto is a new variable and we don't want to support this templating format
)

func interpolateVariables(expr string, interval time.Duration, timeRange time.Duration, queryType dataquery.LokiQueryType, step time.Duration) string {
	intervalText := gtime.FormatInterval(interval)
	stepText := gtime.FormatInterval(step)
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
	if queryType == dataquery.LokiQueryTypeInstant {
		expr = strings.ReplaceAll(expr, varAuto, rangeSText+"s")
	}

	if queryType == dataquery.LokiQueryTypeRange {
		expr = strings.ReplaceAll(expr, varAuto, stepText)
	}

	// this is duplicated code, hopefully this can be handled in a nicer way when
	// https://github.com/grafana/grafana/issues/42928 is done.
	expr = strings.ReplaceAll(expr, varIntervalMsAlt, intervalMsText)
	expr = strings.ReplaceAll(expr, varIntervalAlt, intervalText)
	expr = strings.ReplaceAll(expr, varRangeMsAlt, rangeMsText)
	expr = strings.ReplaceAll(expr, varRangeSAlt, rangeSText)
	expr = strings.ReplaceAll(expr, varRangeAlt, rangeSText+"s")
	return expr
}

func parseQueryType(jsonPointerValue *string) (QueryType, error) {
	if jsonPointerValue == nil {
		// there are older queries stored in alerting that did not have queryType,
		// those were range-queries
		return QueryTypeRange, nil
	} else {
		jsonValue := *jsonPointerValue
		switch jsonValue {
		case "instant":
			return QueryTypeInstant, nil
		case "range":
			return QueryTypeRange, nil
		default:
			return QueryTypeRange, fmt.Errorf("invalid queryType: %s", jsonValue)
		}
	}
}

func parseDirection(jsonPointerValue *string) (Direction, error) {
	if jsonPointerValue == nil {
		// there are older queries stored in alerting that did not have queryDirection,
		// we default to "backward"
		return DirectionBackward, nil
	} else {
		jsonValue := *jsonPointerValue
		switch jsonValue {
		case "backward":
			return DirectionBackward, nil
		case "forward":
			return DirectionForward, nil
		case "scan":
			return DirectionBackward, nil
		default:
			return DirectionBackward, fmt.Errorf("invalid queryDirection: %s", jsonValue)
		}
	}
}

func parseSupportingQueryType(jsonPointerValue *string) SupportingQueryType {
	if jsonPointerValue == nil {
		return SupportingQueryNone
	}

	jsonValue := *jsonPointerValue
	switch jsonValue {
	case "logsVolume":
		return SupportingQueryLogsVolume
	case "logsSample":
		return SupportingQueryLogsSample
	case "dataSample":
		return SupportingQueryDataSample
	case "infiniteScroll":
		return SupportingQueryInfiniteScroll
	case "":
		return SupportingQueryNone
	default:
		// `SupportingQueryType` is just a `string` in the schema, so we can just parse this as a string
		return SupportingQueryType(jsonValue)
	}
}

func parseQuery(queryContext *backend.QueryDataRequest, logqlScopesEnabled bool) ([]*lokiQuery, error) {
	qs := []*lokiQuery{}
	for _, query := range queryContext.Queries {
		model, err := parseQueryModel(query.JSON)
		if err != nil {
			return nil, err
		}

		start := query.TimeRange.From
		end := query.TimeRange.To

		var resolution int64 = 1
		if model.Resolution != nil && (*model.Resolution >= 1 && *model.Resolution <= 5 || *model.Resolution == 10) {
			resolution = *model.Resolution
		}

		interval := query.Interval
		timeRange := query.TimeRange.To.Sub(query.TimeRange.From)

		step, err := calculateStep(interval, timeRange, resolution, model.Step)
		if err != nil {
			return nil, err
		}

		queryType, err := parseQueryType(model.QueryType)
		if err != nil {
			return nil, err
		}

		expr := interpolateVariables(depointerizer(model.Expr), interval, timeRange, queryType, step)

		direction, err := parseDirection(model.Direction)
		if err != nil {
			return nil, err
		}

		var maxLines int64
		if model.MaxLines != nil {
			maxLines = *model.MaxLines
		}

		var legendFormat string
		if model.LegendFormat != nil {
			legendFormat = *model.LegendFormat
		}

		if logqlScopesEnabled {
			rewrittenExpr, err := ApplyScopes(expr, model.Scopes)
			if err == nil {
				expr = rewrittenExpr
			}
		}

		supportingQueryType := parseSupportingQueryType(model.SupportingQueryType)

		qs = append(qs, &lokiQuery{
			Expr:                expr,
			QueryType:           queryType,
			Direction:           direction,
			Step:                step,
			MaxLines:            int(maxLines),
			LegendFormat:        legendFormat,
			Start:               start,
			End:                 end,
			RefID:               query.RefID,
			SupportingQueryType: supportingQueryType,
			Scopes:              model.Scopes,
		})
	}

	return qs, nil
}

func depointerizer[T any](v *T) T {
	var emptyValue T
	if v != nil {
		emptyValue = *v
	}

	return emptyValue
}
