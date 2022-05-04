package streaming

import (
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/query"
)

func addMetadataToFrame(q *query.Query, frame *data.Frame) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.ExecutedQueryString = executedQueryString(q)
	frame.Name = getName(q, frame)
	frame.Fields[0].Config = &data.FieldConfig{Interval: float64(q.Step.Milliseconds())}
	if frame.Name != "" {
		frame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: frame.Name}
	}
}

// this is based on the logic from the String() function in github.com/prometheus/common/model.go
func metricNameFromLabels(f *data.Frame) string {
	labels := f.Fields[1].Labels
	metricName, hasName := labels["__name__"]
	numLabels := len(labels) - 1
	if !hasName {
		numLabels = len(labels)
	}
	labelStrings := make([]string, 0, numLabels)
	for label, value := range labels {
		if label != "__name__" {
			labelStrings = append(labelStrings, fmt.Sprintf("%s=%q", label, value))
		}
	}

	switch numLabels {
	case 0:
		if hasName {
			return string(metricName)
		}
		return "{}"
	default:
		sort.Strings(labelStrings)
		return fmt.Sprintf("%s{%s}", metricName, strings.Join(labelStrings, ", "))
	}
}

func executedQueryString(q *query.Query) string {
	return "Expr: " + q.Expr + "\n" + "Step: " + q.Step.String()
}

func getName(q *query.Query, frame *data.Frame) string {
	labels := frame.Fields[1].Labels
	legend := metricNameFromLabels(frame)

	if q.LegendFormat == legendFormatAuto && len(labels) > 0 {
		return ""
	}

	if q.LegendFormat != "" {
		result := legendFormatRegexp.ReplaceAllFunc([]byte(q.LegendFormat), func(in []byte) []byte {
			labelName := strings.Replace(string(in), "{{", "", 1)
			labelName = strings.Replace(labelName, "}}", "", 1)
			labelName = strings.TrimSpace(labelName)
			if val, exists := labels[labelName]; exists {
				return []byte(val)
			}
			return []byte{}
		})
		legend = string(result)
	}

	// If legend is empty brackets, use query expression
	if legend == "{}" {
		return q.Expr
	}

	return legend
}
