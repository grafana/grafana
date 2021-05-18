package flux

import (
	"regexp"
	"strings"
	"time"
)

const variableFilter = `(?m)([a-zA-Z]+)\.([a-zA-Z]+)`

// interpolate processes macros
func interpolate(query queryModel) (string, error) {
	flux := query.RawQuery

	variableFilterExp, err := regexp.Compile(variableFilter)
	matches := variableFilterExp.FindAllStringSubmatch(flux, -1)
	if matches != nil {
		timeRange := query.TimeRange
		from := timeRange.From.UTC().Format(time.RFC3339)
		to := timeRange.To.UTC().Format(time.RFC3339)
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
	return flux, err
}
