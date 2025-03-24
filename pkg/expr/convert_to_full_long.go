package expr

import (
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	SQLMetricFieldName     = "__metric__"
	SQLValueFieldName      = "value"
	numericFullLongType    = "numeric_full_long"
	timeseriesFullLongType = "time_series_full_long"
)

func ConvertToFullLong(frames data.Frames) (data.Frames, error) {
	if len(frames) == 0 {
		return frames, nil
	}

	var inputType data.FrameType
	if frames[0].Meta != nil && frames[0].Meta.Type != "" {
		inputType = frames[0].Meta.Type
	} else {
		return nil, fmt.Errorf("input frame missing FrameMeta.Type")
	}

	if !supportedToLongConversion(inputType) {
		return nil, fmt.Errorf("unsupported input dataframe type %s for full long conversion", inputType)
	}

	switch inputType {
	case data.FrameTypeNumericMulti:
		return convertNumericMultiToFullLong(frames)
	case data.FrameTypeNumericWide:
		return convertNumericWideToFullLong(frames)
	case data.FrameTypeTimeSeriesMulti:
		return convertTimeSeriesMultiToFullLong(frames)
	case data.FrameTypeTimeSeriesWide:
		return convertTimeSeriesWideToFullLong(frames)
	default:
		return nil, fmt.Errorf("unsupported input type %s for full long conversion", inputType)
	}
}

func convertNumericMultiToFullLong(frames data.Frames) (data.Frames, error) {
	wide := convertNumericMultiToNumericWide(frames)
	return convertNumericWideToFullLong(wide)
}

func convertNumericWideToFullLong(frames data.Frames) (data.Frames, error) {
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	inputFrame := frames[0]
	if inputFrame.Rows() > 1 {
		return nil, fmt.Errorf("expected no more than one row in the frame, but got %d", inputFrame.Rows())
	}

	var (
		metricCol   = make([]string, 0, len(inputFrame.Fields))
		valueCol    = make([]*float64, 0, len(inputFrame.Fields))
		labelKeys   []string
		labelValues = make(map[string][]*string)
	)

	labelKeySet := map[string]struct{}{}
	for _, field := range inputFrame.Fields {
		if !field.Type().Numeric() {
			continue
		}
		val, err := field.FloatAt(0)
		if err != nil {
			continue
		}
		v := val
		valueCol = append(valueCol, &v)
		metricCol = append(metricCol, field.Name)
		for k := range field.Labels {
			labelKeySet[k] = struct{}{}
		}
	}

	for k := range labelKeySet {
		labelKeys = append(labelKeys, k)
		labelValues[k] = make([]*string, 0, len(valueCol))
	}
	sort.Strings(labelKeys)

	for _, field := range inputFrame.Fields {
		if !field.Type().Numeric() {
			continue
		}
		for _, k := range labelKeys {
			var val *string
			if field.Labels != nil {
				if v, ok := field.Labels[k]; ok {
					val = &v
				}
			}
			labelValues[k] = append(labelValues[k], val)
		}
	}

	fields := []*data.Field{
		data.NewField(SQLMetricFieldName, nil, metricCol),
		data.NewField(SQLValueFieldName, nil, valueCol),
	}
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(k, nil, labelValues[k]))
	}

	out := data.NewFrame("", fields...)
	out.Meta = &data.FrameMeta{Type: numericFullLongType}
	return data.Frames{out}, nil
}

func convertTimeSeriesMultiToFullLong(frames data.Frames) (data.Frames, error) {
	type row struct {
		t      time.Time
		value  *float64
		metric string
		labels data.Labels
	}

	var rows []row
	labelKeysSet := map[string]struct{}{}

	for _, frame := range frames {
		var timeField *data.Field
		for _, f := range frame.Fields {
			if f.Type() == data.FieldTypeTime {
				timeField = f
				break
			}
		}
		if timeField == nil {
			return nil, fmt.Errorf("missing time field")
		}
		for _, f := range frame.Fields {
			if !f.Type().Numeric() {
				continue
			}
			for i := 0; i < f.Len(); i++ {
				t := timeField.At(i).(time.Time)
				v, err := f.FloatAt(i)
				if err != nil {
					continue
				}
				val := v
				rows = append(rows, row{
					t:      t,
					value:  &val,
					metric: f.Name,
					labels: f.Labels,
				})
				for k := range f.Labels {
					labelKeysSet[k] = struct{}{}
				}
			}
		}
	}

	labelKeys := make([]string, 0, len(labelKeysSet))
	for k := range labelKeysSet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].t.Equal(rows[j].t) {
			return rows[i].metric < rows[j].metric
		}
		return rows[i].t.Before(rows[j].t)
	})

	times := make([]time.Time, len(rows))
	values := make([]*float64, len(rows))
	metrics := make([]string, len(rows))
	labels := make(map[string][]*string)
	for _, k := range labelKeys {
		labels[k] = make([]*string, len(rows))
	}

	for i, r := range rows {
		times[i] = r.t
		values[i] = r.value
		metrics[i] = r.metric
		for _, k := range labelKeys {
			if v, ok := r.labels[k]; ok {
				labels[k][i] = &v
			}
		}
	}

	fields := []*data.Field{
		data.NewField("time", nil, times),
		data.NewField(SQLValueFieldName, nil, values),
		data.NewField(SQLMetricFieldName, nil, metrics),
	}
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(k, nil, labels[k]))
	}

	out := data.NewFrame("", fields...)
	out.Meta = &data.FrameMeta{Type: timeseriesFullLongType}
	return data.Frames{out}, nil
}

func convertTimeSeriesWideToFullLong(frames data.Frames) (data.Frames, error) {
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	frame := frames[0]

	var timeField *data.Field
	for _, f := range frame.Fields {
		if f.Type() == data.FieldTypeTime {
			timeField = f
			break
		}
	}
	if timeField == nil {
		return nil, fmt.Errorf("time field not found in TimeSeriesWide frame")
	}

	type row struct {
		t      time.Time
		value  *float64
		metric string
		labels data.Labels
	}

	var (
		rows         []row
		labelKeysSet = map[string]struct{}{}
	)

	// Collect all label keys
	for _, f := range frame.Fields {
		if !f.Type().Numeric() {
			continue
		}
		for k := range f.Labels {
			labelKeysSet[k] = struct{}{}
		}
	}

	labelKeys := make([]string, 0, len(labelKeysSet))
	for k := range labelKeysSet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)

	// Build rows
	timeLen := timeField.Len()
	for _, f := range frame.Fields {
		if !f.Type().Numeric() {
			continue
		}
		for i := 0; i < timeLen; i++ {
			t := timeField.At(i).(time.Time)
			v, err := f.FloatAt(i)
			if err != nil {
				continue
			}
			val := v
			rows = append(rows, row{
				t:      t,
				value:  &val,
				metric: f.Name,
				labels: f.Labels,
			})
		}
	}

	// Sort rows by time, then metric name
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].t.Equal(rows[j].t) {
			return rows[i].metric < rows[j].metric
		}
		return rows[i].t.Before(rows[j].t)
	})

	times := make([]time.Time, len(rows))
	values := make([]*float64, len(rows))
	metrics := make([]string, len(rows))
	labels := make(map[string][]*string)
	for _, k := range labelKeys {
		labels[k] = make([]*string, len(rows))
	}

	for i, r := range rows {
		times[i] = r.t
		values[i] = r.value
		metrics[i] = r.metric
		for _, k := range labelKeys {
			if v, ok := r.labels[k]; ok {
				labels[k][i] = &v
			}
		}
	}

	fields := []*data.Field{
		data.NewField("time", nil, times),
		data.NewField(SQLValueFieldName, nil, values),
		data.NewField(SQLMetricFieldName, nil, metrics),
	}
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(k, nil, labels[k]))
	}

	out := data.NewFrame("", fields...)
	out.Meta = &data.FrameMeta{Type: timeseriesFullLongType}
	return data.Frames{out}, nil
}

func supportedToLongConversion(inputType data.FrameType) bool {
	switch inputType {
	case data.FrameTypeNumericMulti, data.FrameTypeNumericWide:
		return true
	case data.FrameTypeTimeSeriesMulti, data.FrameTypeTimeSeriesWide:
		return true
	default:
		return false
	}
}

func convertNumericMultiToNumericWide(frames data.Frames) data.Frames {
	if len(frames) == 0 {
		return nil
	}

	out := data.NewFrame("")
	for _, frame := range frames {
		for _, field := range frame.Fields {
			if field.Type().Numeric() {
				out.Fields = append(out.Fields, field)
			}
		}
	}
	out.Meta = &data.FrameMeta{Type: data.FrameTypeNumericWide}
	return data.Frames{out}
}
