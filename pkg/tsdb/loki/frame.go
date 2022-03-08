package loki

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// we adjust the dataframes to be the way frontend & alerting
// wants them.
func adjustFrame(frame *data.Frame, query *lokiQuery) *data.Frame {
	labels := getFrameLabels(frame)

	timeFields, nonTimeFields := partitionFields(frame)

	isMetricFrame := nonTimeFields[0].Type() != data.FieldTypeString

	isMetricRange := isMetricFrame && query.QueryType == QueryTypeRange

	name := formatName(labels, query)
	frame.Name = name

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	if isMetricRange {
		frame.Meta.ExecutedQueryString = "Expr: " + query.Expr + "\n" + "Step: " + query.Step.String()
	} else {
		frame.Meta.ExecutedQueryString = "Expr: " + query.Expr
	}

	for _, field := range timeFields {
		field.Name = "time"

		if isMetricRange {
			if field.Config == nil {
				field.Config = &data.FieldConfig{}
			}
			field.Config.Interval = float64(query.Step.Milliseconds())
		}
	}

	for _, field := range nonTimeFields {
		field.Name = "value"
		if field.Config == nil {
			field.Config = &data.FieldConfig{}
		}
		field.Config.DisplayNameFromDS = name
	}

	// for streams-dataframes, we need to send to the browser the nanosecond-precision timestamp too.
	// usually timestamps become javascript-date-objects in the browser automatically, which only
	// have millisecond-precision.
	// so we send a separate timestamp-as-string field too.
	if !isMetricFrame {
		stringTimeField := makeStringTimeField(timeFields[0])
		frame.Fields = append(frame.Fields, stringTimeField)
	}

	return frame
}

func makeStringTimeField(field *data.Field) *data.Field {
	length := field.Len()
	stringTimestamps := make([]string, length)

	for i := 0; i < length; i++ {
		if v, ok := field.ConcreteAt(i); ok {
			nsNumber := v.(time.Time).UnixNano()
			stringTimestamps[i] = fmt.Sprintf("%d", nsNumber)
		}
	}
	return data.NewField("tsNs", field.Labels.Copy(), stringTimestamps)
}

func formatNamePrometheusStyle(labels map[string]string) string {
	var parts []string

	for k, v := range labels {
		parts = append(parts, fmt.Sprintf("%s=%q", k, v))
	}

	sort.Strings(parts)

	return fmt.Sprintf("{%s}", strings.Join(parts, ", "))
}

//If legend (using of name or pattern instead of time series name) is used, use that name/pattern for formatting
func formatName(labels map[string]string, query *lokiQuery) string {
	if query.LegendFormat == "" {
		return formatNamePrometheusStyle(labels)
	}

	result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := labels[labelName]; exists {
			return []byte(val)
		}
		return []byte{}
	})

	return string(result)
}

func getFrameLabels(frame *data.Frame) map[string]string {
	labels := make(map[string]string)

	for _, field := range frame.Fields {
		for k, v := range field.Labels {
			labels[k] = v
		}
	}

	return labels
}

func partitionFields(frame *data.Frame) ([]*data.Field, []*data.Field) {
	var timeFields []*data.Field
	var nonTimeFields []*data.Field

	for _, field := range frame.Fields {
		if field.Type() == data.FieldTypeTime {
			timeFields = append(timeFields, field)
		} else {
			nonTimeFields = append(nonTimeFields, field)
		}
	}

	return timeFields, nonTimeFields
}
