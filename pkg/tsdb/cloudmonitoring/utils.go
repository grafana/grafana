package cloudmonitoring

import (
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

func reverse(s string) string {
	chars := []rune(s)
	for i, j := 0, len(chars)-1; i < j; i, j = i+1, j-1 {
		chars[i], chars[j] = chars[j], chars[i]
	}
	return string(chars)
}

func toSnakeCase(str string) string {
	return strings.ToLower(matchAllCap.ReplaceAllString(str, "${1}_${2}"))
}

func containsLabel(labels []string, newLabel string) bool {
	for _, val := range labels {
		if val == newLabel {
			return true
		}
	}
	return false
}

func addInterval(period string, field *data.Field) error {
	period = strings.TrimPrefix(period, "+")
	p, err := intervalv2.ParseIntervalStringToTimeDuration(period)
	if err != nil {
		return err
	}
	if err == nil {
		if field.Config != nil {
			field.Config.Interval = float64(p.Milliseconds())
		} else {
			field.SetConfig(&data.FieldConfig{
				Interval: float64(p.Milliseconds()),
			})
		}
	}
	return nil
}
