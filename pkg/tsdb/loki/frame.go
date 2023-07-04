package loki

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// we adjust the dataframes to be the way frontend & alerting
// wants them.
func adjustFrame(frame *data.Frame, query *lokiQuery, setMetricFrameName bool) error {
	fields := frame.Fields

	if len(fields) < 2 {
		return fmt.Errorf("missing fields in frame")
	}

	// metric-fields have "timefield, valuefield"
	// logs-fields have "labelsfield, timefield, ..."

	secondField := fields[1]

	if secondField.Type() == data.FieldTypeFloat64 {
		return adjustMetricFrame(frame, query, setMetricFrameName)
	} else {
		return adjustLogsFrame(frame, query)
	}
}

func adjustMetricFrame(frame *data.Frame, query *lokiQuery, setFrameName bool) error {
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
	if setFrameName {
		frame.Name = name
	}

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.Stats = parseStats(frame.Meta.Custom)
	frame.Meta.Custom = nil

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
	if len(fields) != 4 {
		return fmt.Errorf("invalid fields in logs frame")
	}

	labelsField := fields[0]
	timeField := fields[1]
	lineField := fields[2]
	stringTimeField := fields[3]

	if (timeField.Type() != data.FieldTypeTime) || (lineField.Type() != data.FieldTypeString) || (labelsField.Type() != data.FieldTypeJSON) || (stringTimeField.Type() != data.FieldTypeString) {
		return fmt.Errorf("invalid fields in logs frame")
	}

	if (timeField.Len() != lineField.Len()) || (timeField.Len() != labelsField.Len()) || (timeField.Len() != stringTimeField.Len()) {
		return fmt.Errorf("invalid fields in logs frame")
	}

	// this returns an error when the length of fields do not match
	_, err := frame.RowLen()
	if err != nil {
		return err
	}

	labelsField.Name = "labels"
	stringTimeField.Name = "tsNs"

	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.Stats = parseStats(frame.Meta.Custom)
	// TODO: when we get a real frame-type in grafana-plugin-sdk-go,
	// move this to frame.Meta.FrameType
	frame.Meta.Custom = map[string]string{
		"frameType": "LabeledTimeValues",
	}

	frame.Meta.ExecutedQueryString = "Expr: " + query.Expr

	// we need to send to the browser the nanosecond-precision timestamp too.
	// usually timestamps become javascript-date-objects in the browser automatically, which only
	// have millisecond-precision.
	// so we send a separate timestamp-as-string field too. it is provided by the
	// loki-json-parser-code

	idField, err := makeIdField(stringTimeField, lineField, labelsField, query.RefID)
	if err != nil {
		return err
	}
	frame.Fields = append(frame.Fields, idField)
	return nil
}

func calculateCheckSum(time string, line string, labels []byte) (string, error) {
	input := []byte(line + "_")
	input = append(input, labels...)
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
		labels := labelsField.At(i).(json.RawMessage)

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

		ids[i] = sum + idSuffix
	}
	return data.NewField("id", nil, ids), nil
}

func formatNamePrometheusStyle(labels map[string]string) string {
	parts := make([]string, 0, len(labels))

	for k, v := range labels {
		parts = append(parts, fmt.Sprintf("%s=%q", k, v))
	}

	sort.Strings(parts)

	return fmt.Sprintf("{%s}", strings.Join(parts, ", "))
}

// If legend (using of name or pattern instead of time series name) is used, use that name/pattern for formatting
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

func parseStats(frameMetaCustom interface{}) []data.QueryStat {
	customMap, ok := frameMetaCustom.(map[string]interface{})
	if !ok {
		return nil
	}
	rawStats, ok := customMap["stats"].(map[string]interface{})
	if !ok {
		return nil
	}

	var stats []data.QueryStat

	summary, ok := rawStats["summary"].(map[string]interface{})
	if ok {
		stats = append(stats,
			makeStat("Summary: bytes processed per second", summary["bytesProcessedPerSecond"], "Bps"),
			makeStat("Summary: lines processed per second", summary["linesProcessedPerSecond"], ""),
			makeStat("Summary: total bytes processed", summary["totalBytesProcessed"], "decbytes"),
			makeStat("Summary: total lines processed", summary["totalLinesProcessed"], ""),
			makeStat("Summary: exec time", summary["execTime"], "s"))
	}

	store, ok := rawStats["store"].(map[string]interface{})
	if ok {
		stats = append(stats,
			makeStat("Store: total chunks ref", store["totalChunksRef"], ""),
			makeStat("Store: total chunks downloaded", store["totalChunksDownloaded"], ""),
			makeStat("Store: chunks download time", store["chunksDownloadTime"], "s"),
			makeStat("Store: head chunk bytes", store["headChunkBytes"], "decbytes"),
			makeStat("Store: head chunk lines", store["headChunkLines"], ""),
			makeStat("Store: decompressed bytes", store["decompressedBytes"], "decbytes"),
			makeStat("Store: decompressed lines", store["decompressedLines"], ""),
			makeStat("Store: compressed bytes", store["compressedBytes"], "decbytes"),
			makeStat("Store: total duplicates", store["totalDuplicates"], ""))
	}

	ingester, ok := rawStats["ingester"].(map[string]interface{})
	if ok {
		stats = append(stats,
			makeStat("Ingester: total reached", ingester["totalReached"], ""),
			makeStat("Ingester: total chunks matched", ingester["totalChunksMatched"], ""),
			makeStat("Ingester: total batches", ingester["totalBatches"], ""),
			makeStat("Ingester: total lines sent", ingester["totalLinesSent"], ""),
			makeStat("Ingester: head chunk bytes", ingester["headChunkBytes"], "decbytes"),
			makeStat("Ingester: head chunk lines", ingester["headChunkLines"], ""),
			makeStat("Ingester: decompressed bytes", ingester["decompressedBytes"], "decbytes"),
			makeStat("Ingester: decompressed lines", ingester["decompressedLines"], ""),
			makeStat("Ingester: compressed bytes", ingester["compressedBytes"], "decbytes"),
			makeStat("Ingester: total duplicates", ingester["totalDuplicates"], ""))
	}

	return stats
}

func makeStat(name string, interfaceValue interface{}, unit string) data.QueryStat {
	var value float64
	switch v := interfaceValue.(type) {
	case float64:
		value = v
	case int:
		value = float64(v)
	}

	return data.QueryStat{
		FieldConfig: data.FieldConfig{
			DisplayName: name,
			Unit:        unit,
		},
		Value: value,
	}
}
