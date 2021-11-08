package flux

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

// $__interval_ms is the exact value in milliseconds
// $__interval is rounded to nice whole values
// v.windowPeriod is the exact value string-formatted

func interpolateInterval(flux string, interval time.Duration) string {
	intervalMs := int64(interval / time.Millisecond)
	intervalText := intervalv2.FormatDuration(interval)

	flux = strings.ReplaceAll(flux, "$__interval_ms", strconv.FormatInt(intervalMs, 10))
	flux = strings.ReplaceAll(flux, "$__interval", intervalText)
	return flux
}

var fluxVariableFilterExp = regexp.MustCompile(`(?m)([a-zA-Z]+)\.([a-zA-Z]+)`)

func interpolateFluxSpecificVariables(query queryModel) string {
	flux := query.RawQuery

	matches := fluxVariableFilterExp.FindAllStringSubmatch(flux, -1)
	if matches != nil {
		timeRange := query.TimeRange
		from := timeRange.From.UTC().Format(time.RFC3339Nano)
		to := timeRange.To.UTC().Format(time.RFC3339Nano)
		for _, match := range matches {
			switch match[2] {
			case "timeRangeStart":
				flux = strings.ReplaceAll(flux, match[0], from)
			case "timeRangeStop":
				flux = strings.ReplaceAll(flux, match[0], to)
			case "windowPeriod":
				flux = strings.ReplaceAll(flux, match[0], query.Interval.String())
			case "bucket":
				flux = strings.ReplaceAll(flux, match[0], "\""+query.Options.Bucket+"\"")
			case "defaultBucket":
				flux = strings.ReplaceAll(flux, match[0], "\""+query.Options.DefaultBucket+"\"")
			case "organization":
				flux = strings.ReplaceAll(flux, match[0], "\""+query.Options.Organization+"\"")
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
