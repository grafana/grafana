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
	fields := frame.Fields

	if len(fields) < 2 {
		return fmt.Errorf("missing fields in frame")
	}

	// metric-fields have "timefield, valuefield"
	// logs-fields have "labelsfield, timefield, ..."

	secondField := fields[1]

	if secondField.Type() == data.FieldTypeFloat64 {
		return adjustMetricFrame(frame, query)
	} else {
		return adjustLogsFrame(frame, query)
	}
}

func adjustMetricFrame(frame *data.Frame, query *lokiQuery) error {
	fields := frame.Fields
	// we check if the fields are of correct type
	if len(fields) != 2 {
		return fmt.Errorf("invalid fields in metric frame")
	}

	timeField := fields[0]
	valueField := fields[1]

	if (timeField.Type() != data.FieldTypeTime) || (valueField.Type() != data.FieldTypeFloat64) {
		return fmt.Errorf("invalid fields in metric frame")
	}

	labels := getFrameLabels(frame)

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

	if isMetricRange {
		if timeField.Config == nil {
			timeField.Config = &data.FieldConfig{}
		}
		timeField.Config.Interval = float64(query.Step.Milliseconds())
	}

	if valueField.Config == nil {
		valueField.Config = &data.FieldConfig{}
	}
	valueField.Config.DisplayNameFromDS = name

	return nil
}

func adjustLogsFrame(frame *data.Frame, query *lokiQuery) error {
	// we check if the fields are of correct type and length
	fields := frame.Fields
	if len(fields) != 3 {
		return fmt.Errorf("invalid fields in logs frame")
	}

	labelsField := fields[0]
	timeField := fields[1]
	lineField := fields[2]

	if (timeField.Type() != data.FieldTypeTime) || (lineField.Type() != data.FieldTypeString) || (labelsField.Type() != data.FieldTypeString) {
		return fmt.Errorf("invalid fields in metric frame")
	}

	if (timeField.Len() != lineField.Len()) || (timeField.Len() != labelsField.Len()) {
		return fmt.Errorf("invalid fields in metric frame")
	}

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.ExecutedQueryString = "Expr: " + query.Expr

	// we need to send to the browser the nanosecond-precision timestamp too.
	// usually timestamps become javascript-date-objects in the browser automatically, which only
	// have millisecond-precision.
	// so we send a separate timestamp-as-string field too.
	stringTimeField := makeStringTimeField(timeField)

	idField, err := makeIdField(stringTimeField, lineField, labelsField, frame.RefID)
	if err != nil {
		return err
	}
	frame.Fields = append(frame.Fields, stringTimeField, idField)
	return nil
}

func makeStringTimeField(timeField *data.Field) *data.Field {
	length := timeField.Len()
	stringTimestamps := make([]string, length)

	for i := 0; i < length; i++ {
		nsNumber := timeField.At(i).(time.Time).UnixNano()
		stringTimestamps[i] = fmt.Sprintf("%d", nsNumber)
	}
	return data.NewField("tsNs", timeField.Labels.Copy(), stringTimestamps)
}

func calculateCheckSum(time string, line string, labels string) (string, error) {
	input := []byte(line + "_" + labels)
	hash := fnv.New32()
	_, err := hash.Write(input)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s_%x", time, hash.Sum32()), nil
}

func makeIdField(stringTimeField *data.Field, lineField *data.Field, labelsField *data.Field, refId string) (*data.Field, error) {
	length := stringTimeField.Len()

	ids := make([]string, length)

	checksums := make(map[string]int)

	for i := 0; i < length; i++ {
		time := stringTimeField.At(i).(string)
		line := lineField.At(i).(string)
		labels := labelsField.At(i).(string)

		sum, err := calculateCheckSum(time, line, labels)
		if err != nil {
			return nil, err
		}

		sumCount := checksums[sum]
		idSuffix := ""
		if sumCount > 0 {
			// we had this checksum already, we need to do something to make it unique
			idSuffix = fmt.Sprintf("_%d", sumCount)
		}
		checksums[sum] = sumCount + 1

		ids[i] = sum + idSuffix + "_" + refId
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
