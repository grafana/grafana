package expr

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func ConvertFromFullLongToNumericMulti(frames data.Frames) (data.Frames, error) {
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame, got %d", len(frames))
	}
	frame := frames[0]
	if frame.Meta == nil || frame.Meta.Type != numericFullLongType {
		return nil, fmt.Errorf("expected frame of type %q", numericFullLongType)
	}

	var (
		metricField  *data.Field
		valueField   *data.Field
		displayField *data.Field
		labelFields  []*data.Field
	)

	// Identify key fields
	for _, f := range frame.Fields {
		switch f.Name {
		case SQLMetricFieldName:
			metricField = f
		case SQLValueFieldName:
			valueField = f
		case SQLDisplayFieldName:
			displayField = f
		default:
			if f.Type() == data.FieldTypeNullableString {
				labelFields = append(labelFields, f)
			}
		}
	}

	if metricField == nil || valueField == nil {
		return nil, fmt.Errorf("missing required fields: %q or %q", SQLMetricFieldName, SQLValueFieldName)
	}

	type seriesKey struct {
		metric      string
		labelFP     data.Fingerprint
		displayName string
	}

	type seriesEntry struct {
		indices     []int
		labels      data.Labels
		displayName *string
	}

	grouped := make(map[seriesKey]*seriesEntry)

	for i := 0; i < frame.Rows(); i++ {
		if valueField.NilAt(i) {
			continue // skip null values
		}

		metric := metricField.At(i).(string)

		// collect labels
		labels := data.Labels{}
		for _, f := range labelFields {
			if f.NilAt(i) {
				continue
			}
			val := f.At(i).(*string)
			if val != nil {
				labels[f.Name] = *val
			}
		}
		fp := labels.Fingerprint()

		// handle optional display name
		var displayPtr *string
		displayKey := ""
		if displayField != nil && !displayField.NilAt(i) {
			if raw := displayField.At(i).(*string); raw != nil {
				displayPtr = raw
				displayKey = *raw
			}
		}

		key := seriesKey{
			metric:      metric,
			labelFP:     fp,
			displayName: displayKey,
		}

		entry, ok := grouped[key]
		if !ok {
			entry = &seriesEntry{
				labels:      labels,
				displayName: displayPtr,
			}
			grouped[key] = entry
		}
		entry.indices = append(entry.indices, i)
	}

	var result data.Frames
	for key, entry := range grouped {
		values := make([]*float64, 0, len(entry.indices))
		for _, i := range entry.indices {
			v, err := valueField.FloatAt(i)
			if err != nil {
				return nil, fmt.Errorf("failed to convert value at index %d to float: %w", i, err)
			}
			values = append(values, &v)
		}

		field := data.NewField(key.metric, entry.labels, values)
		if entry.displayName != nil {
			field.Config = &data.FieldConfig{DisplayNameFromDS: *entry.displayName}
		}

		frame := data.NewFrame("", field)
		frame.Meta = &data.FrameMeta{Type: data.FrameTypeNumericMulti}
		result = append(result, frame)
	}

	return result, nil
}
