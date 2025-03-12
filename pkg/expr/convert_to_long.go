package expr

import (
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func ConvertToLong(frames data.Frames) (data.Frames, error) {
	if len(frames) == 0 {
		// general empty case for now
		return frames, nil
	}
	// Four Conversion Possible Cases
	// 1. NumericMulti -> NumericLong
	// 2. NumericWide -> NumericLong
	// 3. TimeSeriesMulti -> TimeSeriesLong
	// 4. TimeSeriesWide -> TimeSeriesLong

	// Detect if input type is declared
	// First Check Frame Meta Type

	var inputType data.FrameType
	if frames[0].Meta != nil && frames[0].Meta.Type != "" {
		inputType = frames[0].Meta.Type
	}

	// TODO: Add some guessing of Type if not declared
	if inputType == "" {
		return frames, fmt.Errorf("no input dataframe type set")
	}

	if !supportedToLongConversion(inputType) {
		return frames, fmt.Errorf("unsupported input dataframe type %s for SQL expression", inputType)
	}

	toLong := getToLongConversionFunc(inputType)
	if toLong == nil {
		return frames, fmt.Errorf("could not get conversion function for input type %s", inputType)
	}

	return toLong(frames)
}

func convertNumericMultiToNumericLong(frames data.Frames) (data.Frames, error) {
	// Apart from metadata, NumericMulti is basically NumericWide, except one frame per thing
	// so we collapse into wide and call the wide conversion
	wide := convertNumericMultiToNumericWide(frames)
	return convertNumericWideToNumericLong(wide)
}

func convertNumericMultiToNumericWide(frames data.Frames) data.Frames {
	newFrame := data.NewFrame("")
	for _, frame := range frames {
		for _, field := range frame.Fields {
			if !field.Type().Numeric() {
				continue
			}
			newField := data.NewFieldFromFieldType(field.Type(), field.Len())
			newField.Name = field.Name
			newField.Labels = field.Labels.Copy()
			if field.Len() == 1 {
				newField.Set(0, field.CopyAt(0))
			}
			newFrame.Fields = append(newFrame.Fields, newField)
		}
	}
	return data.Frames{newFrame}
}

func convertNumericWideToNumericLong(frames data.Frames) (data.Frames, error) {
	// Wide should only be one frame
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	inputFrame := frames[0]

	// The Frame should have no more than one row
	if inputFrame.Rows() > 1 {
		return nil, fmt.Errorf("expected no more than one row in the frame, but got %d", inputFrame.Rows())
	}

	// Gather:
	// - unique numeric Field Names, and
	// - unique Label Keys (from Numeric Fields only)
	// each one maps to a field in the output long Frame.
	uniqueNames := make([]string, 0)
	uniqueKeys := make([]string, 0)

	uniqueNamesMap := make(map[string]data.FieldType)
	uniqueKeysMap := make(map[string]struct{})

	prints := make(map[string]int)

	registerPrint := func(labels data.Labels) {
		fp := labels.Fingerprint().String()
		if _, ok := prints[fp]; !ok {
			prints[fp] = len(prints)
		}
	}

	for _, field := range inputFrame.Fields {
		if field.Type().Numeric() {
			if _, ok := uniqueNamesMap[field.Name]; !ok {
				uniqueNames = append(uniqueNames, field.Name)
				uniqueNamesMap[field.Name] = field.Type()
			}

			if field.Labels != nil {
				registerPrint(field.Labels)
				for key := range field.Labels {
					if _, ok := uniqueKeysMap[key]; !ok {
						uniqueKeys = append(uniqueKeys, key)
					}
					uniqueKeysMap[key] = struct{}{}
				}
			}
		}
	}

	// Create new fields for output Long frame
	fields := make([]*data.Field, 0, len(uniqueNames)+len(uniqueKeys))

	// Create the Numeric Fields, tracking the index of each field by name
	// Note: May want to use FloatAt and and prepopulate with NaN so missing
	// combinations of value can be NA instead of the zero value of 0.
	var nameIndexMap = make(map[string]int, len(uniqueNames))
	for i, name := range uniqueNames {
		field := data.NewFieldFromFieldType(uniqueNamesMap[name], len(prints))
		field.Name = name
		fields = append(fields, field)
		nameIndexMap[name] = i
	}

	// Create the String fields, tracking the index of each field by key
	var keyIndexMap = make(map[string]int, len(uniqueKeys))
	for i, k := range uniqueKeys {
		fields = append(fields, data.NewField(k, nil, make([]string, len(prints))))
		keyIndexMap[k] = len(nameIndexMap) + i
	}

	longFrame := data.NewFrame("", fields...)

	if inputFrame.Rows() == 0 {
		return data.Frames{longFrame}, nil
	}

	// Add Rows to the fields
	for _, field := range inputFrame.Fields {
		if !field.Type().Numeric() {
			continue
		}
		fieldIdx := prints[field.Labels.Fingerprint().String()]
		longFrame.Fields[nameIndexMap[field.Name]].Set(fieldIdx, field.CopyAt(0))
		for key, value := range field.Labels {
			longFrame.Fields[keyIndexMap[key]].Set(fieldIdx, value)
		}
	}

	return data.Frames{longFrame}, nil
}

func convertTimeSeriesMultiToTimeSeriesLong(frames data.Frames) (data.Frames, error) {
	type rowKey struct {
		t      time.Time
		labels data.Labels
	}

	var rows []rowKey
	var timeFieldName string
	var valueFieldName string
	var values []float64

	labelKeysSet := map[string]struct{}{}

	for _, frame := range frames {
		var timeField *data.Field
		var valueField *data.Field

		// Identify time and value fields
		for _, field := range frame.Fields {
			if field.Type() == data.FieldTypeTime {
				timeField = field
				timeFieldName = field.Name
			} else if field.Type().Numeric() {
				valueField = field
				valueFieldName = field.Name
				if field.Labels != nil {
					for k := range field.Labels {
						labelKeysSet[k] = struct{}{}
					}
				}
			}
		}

		if timeField == nil || valueField == nil {
			return nil, fmt.Errorf("frame missing time or value field")
		}

		for i := 0; i < timeField.Len(); i++ {
			t := timeField.At(i).(time.Time)
			v, err := valueField.FloatAt(i)
			if err != nil {
				v = 0
			}
			rows = append(rows, rowKey{t: t, labels: valueField.Labels})
			values = append(values, v)
		}
	}

	// Build time and value columns
	timeCol := make([]time.Time, len(rows))
	valueCol := make([]float64, len(rows))

	labelKeys := make([]string, 0, len(labelKeysSet))
	for k := range labelKeysSet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)

	labelCols := make(map[string][]string, len(labelKeys))
	for _, k := range labelKeys {
		labelCols[k] = make([]string, len(rows))
	}

	for i, row := range rows {
		timeCol[i] = row.t
		valueCol[i] = values[i]
		for _, key := range labelKeys {
			if val, ok := row.labels[key]; ok {
				labelCols[key][i] = val
			} else {
				labelCols[key][i] = ""
			}
		}
	}

	// Assemble output fields
	fields := []*data.Field{
		data.NewField(timeFieldName, nil, timeCol),
		data.NewField(valueFieldName, nil, valueCol),
	}
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(k, nil, labelCols[k]))
	}

	frame := data.NewFrame("time_series_long", fields...)
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesLong,
	}

	return data.Frames{frame}, nil
}

func convertTimeSeriesWideToTimeSeriesLong(frames data.Frames) (data.Frames, error) {
	// Wide should only be one frame
	if len(frames) != 1 {
		return nil, fmt.Errorf("expected exactly one frame for wide format, but got %d", len(frames))
	}
	inputFrame := frames[0]
	longFrame, err := data.WideToLong(inputFrame)
	if err != nil {
		return nil, fmt.Errorf("failed to convert wide time series to long timeseries for sql expression: %w", err)
	}
	return data.Frames{longFrame}, nil
}

func getToLongConversionFunc(inputType data.FrameType) func(data.Frames) (data.Frames, error) {
	switch inputType {
	case data.FrameTypeNumericMulti:
		return convertNumericMultiToNumericLong
	case data.FrameTypeNumericWide:
		return convertNumericWideToNumericLong
	case data.FrameTypeTimeSeriesMulti:
		return convertTimeSeriesMultiToTimeSeriesLong
	case data.FrameTypeTimeSeriesWide:
		return convertTimeSeriesWideToTimeSeriesLong
	default:
		return convertErr
	}
}

func convertErr(_ data.Frames) (data.Frames, error) {
	return nil, fmt.Errorf("unsupported input type for SQL expression")
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
