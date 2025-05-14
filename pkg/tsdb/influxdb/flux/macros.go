package flux

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

// $__interval_ms is the exact value in milliseconds
// $__interval is rounded to nice whole values
// v.windowPeriod is the exact value string-formatted

func interpolateInterval(flux string, interval time.Duration) string {
	intervalMs := int64(interval / time.Millisecond)
	intervalText := gtime.FormatInterval(interval)

	flux = strings.ReplaceAll(flux, "$__interval_ms", strconv.FormatInt(intervalMs, 10))
	flux = strings.ReplaceAll(flux, "$__interval", intervalText)
	return flux
}

var fluxVariableFilterExp = regexp.MustCompile(`(?m)(v)\.([a-zA-Z]+)`)

func interpolateFluxSpecificVariables(query queryModel) string {
	rawQuery := query.RawQuery
	flux := query.RawQuery

	matches := fluxVariableFilterExp.FindAllStringSubmatchIndex(rawQuery, -1)
	if matches != nil {
		timeRange := query.TimeRange
		from := timeRange.From.UTC().Format(time.RFC3339Nano)
		to := timeRange.To.UTC().Format(time.RFC3339Nano)
		for _, match := range matches {
			// For query "range(start: v.timeRangeStart, stop: v.timeRangeStop)"
			// rawQuery[match[0]:match[1]] will be v.timeRangeStart
			// rawQuery[match[2]:match[3]] will be v
			// rawQuery[match[4]:match[5]] will be timeRangeStart
			fullMatch := rawQuery[match[0]:match[1]]
			key := rawQuery[match[4]:match[5]]

			switch key {
			case "timeRangeStart":
				flux = strings.ReplaceAll(flux, fullMatch, from)
			case "timeRangeStop":
				flux = strings.ReplaceAll(flux, fullMatch, to)
			case "windowPeriod":
				flux = strings.ReplaceAll(flux, fullMatch, query.Interval.String())
			case "bucket":
				// Check if 'bucket' is part of a join query
				beforeMatch := rawQuery[:match[0]]
				if strings.Contains(beforeMatch, "join.") {
					continue
				}
				flux = strings.ReplaceAll(flux, fullMatch, "\""+query.Options.Bucket+"\"")
			case "defaultBucket":
				flux = strings.ReplaceAll(flux, fullMatch, "\""+query.Options.DefaultBucket+"\"")
			case "organization":
				flux = strings.ReplaceAll(flux, fullMatch, "\""+query.Options.Organization+"\"")
			}
		}
	}
	return flux
}

func interpolate(query queryModel) string {
	flux := interpolateFluxSpecificVariables(query)
	flux = interpolateInterval(flux, query.Interval)
	return flux
}
