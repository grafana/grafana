package flux

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const variableFilter = `(?m)([a-zA-Z]+)\.([a-zA-Z]+)`

// Interpolate processes macros
func Interpolate(query QueryModel) (string, error) {

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

	backend.Logger.Info(fmt.Sprintf("%s => %v", flux, query.Options))
	return flux, err
}
