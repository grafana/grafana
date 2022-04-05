package loki

import (
	"fmt"
	"hash/fnv"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// we adjust the dataframes to be the way frontend & alerting
// wants them.
func adjustFrame(frame *data.Frame, query *lokiQuery) error {
	_, nonTimeFields := partitionFields(frame)

	isMetricFrame := nonTimeFields[0].Type() != data.FieldTypeString

	if isMetricFrame {
		return adjustMetricFrame(frame, query)
	} else {
		return adjustLogsFrame(frame, query)
	}
}

func adjustMetricFrame(frame *data.Frame, query *lokiQuery) error {
	labels := getFrameLabels(frame)

	timeFields, nonTimeFields := partitionFields(frame)

	isMetricRange := query.QueryType == QueryTypeRange

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

		if isMetricRange {
			if field.Config == nil {
				field.Config = &data.FieldConfig{}
			}
			field.Config.Interval = float64(query.Step.Milliseconds())
		}
	}

	for _, field := range nonTimeFields {
		if field.Config == nil {
			field.Config = &data.FieldConfig{}
		}
		field.Config.DisplayNameFromDS = name
	}

	return nil
}

func adjustLogsFrame(frame *data.Frame, query *lokiQuery) error {
	timeFields, _ := partitionFields(frame)

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.ExecutedQueryString = "Expr: " + query.Expr

	// we need to send to the browser the nanosecond-precision timestamp too.
	// usually timestamps become javascript-date-objects in the browser automatically, which only
	// have millisecond-precision.
	// so we send a separate timestamp-as-string field too.
	stringTimeField, err := makeStringTimeField(timeFields[0])
	if err != nil {
		return err
	}

	idField, err := makeIdField(stringTimeField, frame.Fields[2], frame.Fields[0])
	if err != nil {
		return err
	}
	frame.Fields = append(frame.Fields, stringTimeField, idField)
	return nil
}

func makeStringTimeField(timeField *data.Field) (*data.Field, error) {
	length := timeField.Len()
	if timeField.Type() != data.FieldTypeTime {
		return nil, fmt.Errorf("wrong field type")
	}
	stringTimestamps := make([]string, length)

	for i := 0; i < length; i++ {
		nsNumber := timeField.At(i).(time.Time).UnixNano()
		stringTimestamps[i] = fmt.Sprintf("%d", nsNumber)
	}
	return data.NewField("tsNs", timeField.Labels.Copy(), stringTimestamps), nil
}

func calculateCheckSum(time string, line string, labels string) string {
	input := []byte(line + "_" + labels)
	hash := fnv.New32()
	hash.Write(input)
	return fmt.Sprintf("%s_%x", time, hash.Sum32())
}

func makeIdField(stringTimeField *data.Field, lineField *data.Field, labelsField *data.Field) (*data.Field, error) {
	length := stringTimeField.Len()

	if (lineField.Len() != length) || (labelsField.Len() != length) {
		return nil, fmt.Errorf("fields with different lengths")
	}

	if (stringTimeField.Type() != data.FieldTypeString) ||
		(lineField.Type() != data.FieldTypeString) ||
		(labelsField.Type() != data.FieldTypeString) {
		return nil, fmt.Errorf("wrong field types")
	}

	ids := make([]string, length)

	checksums := make(map[string]int)

	for i := 0; i < length; i++ {
		time := stringTimeField.At(i).(string)
		line := lineField.At(i).(string)
		labels := labelsField.At(i).(string)

		sum := calculateCheckSum(time, line, labels)

		sumCount := checksums[sum]
		idSuffix := ""
		if sumCount > 0 {
			// we had this checksum already, we need to do something to make it unique
			idSuffix = fmt.Sprintf("_%d", sumCount)
		}
		checksums[sum] = sumCount + 1

		ids[i] = sum + idSuffix
	}
	return data.NewField("id", nil, ids), nil
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
