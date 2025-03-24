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
	type rowKey string
	type rowEntry struct {
		t      time.Time
		labels data.Labels
		values map[string]float64
	}

	rowMap := make(map[rowKey]rowEntry)
	valueFieldNames := map[string]struct{}{}
	labelKeySet := map[string]struct{}{}
	var timeFieldName string

	for _, frame := range frames {
		var timeField *data.Field

		// Find time field
		for _, field := range frame.Fields {
			if field.Type() == data.FieldTypeTime {
				timeField = field
				timeFieldName = field.Name
				break
			}
		}
		if timeField == nil {
			return nil, fmt.Errorf("frame missing time field")
		}

		// Process numeric fields
		for _, field := range frame.Fields {
			if !field.Type().Numeric() {
				continue
			}

			valueFieldNames[field.Name] = struct{}{}
			for k := range field.Labels {
				labelKeySet[k] = struct{}{}
			}

			for i := 0; i < field.Len(); i++ {
				t := timeField.At(i).(time.Time)
				v, err := field.FloatAt(i)
				if err != nil {
					v = 0
				}

				key := rowKey(fmt.Sprintf("%d|%s", t.UnixNano(), field.Labels.Fingerprint()))
				entry, exists := rowMap[key]
				if !exists {
					entry = rowEntry{
						t:      t,
						labels: field.Labels,
						values: map[string]float64{},
					}
				}
				entry.values[field.Name] = v
				rowMap[key] = entry
			}
		}
	}

	// Extract and sort row entries
	type sortableRow struct {
		key   rowKey
		entry rowEntry
	}
	var sortedRows []sortableRow
	for k, v := range rowMap {
		sortedRows = append(sortedRows, sortableRow{key: k, entry: v})
	}

	// Sort by time asc, then label fingerprint
	sort.Slice(sortedRows, func(i, j int) bool {
		ti := sortedRows[i].entry.t
		tj := sortedRows[j].entry.t
		if ti.Equal(tj) {
			return sortedRows[i].entry.labels.Fingerprint().String() < sortedRows[j].entry.labels.Fingerprint().String()
		}
		return ti.Before(tj)
	})

	// Collect ordered value and label field names
	valueNames := make([]string, 0, len(valueFieldNames))
	for name := range valueFieldNames {
		valueNames = append(valueNames, name)
	}
	sort.Strings(valueNames)

	labelKeys := make([]string, 0, len(labelKeySet))
	for k := range labelKeySet {
		labelKeys = append(labelKeys, k)
	}
	sort.Strings(labelKeys)

	// Build columns
	numRows := len(sortedRows)
	timeCol := make([]time.Time, numRows)
	valueCols := make(map[string][]float64, len(valueNames))
	for _, name := range valueNames {
		valueCols[name] = make([]float64, numRows)
	}
	labelCols := make(map[string][]string, len(labelKeys))
	for _, k := range labelKeys {
		labelCols[k] = make([]string, numRows)
	}

	// Fill rows
	for i, row := range sortedRows {
		timeCol[i] = row.entry.t
		for _, name := range valueNames {
			if val, ok := row.entry.values[name]; ok {
				valueCols[name][i] = val
			}
		}
		for _, k := range labelKeys {
			labelCols[k][i] = row.entry.labels[k]
		}
	}

	// Build final fields
	fields := []*data.Field{
		data.NewField(timeFieldName, nil, timeCol),
	}
	for _, name := range valueNames {
		fields = append(fields, data.NewField(name, nil, valueCols[name]))
	}
	for _, k := range labelKeys {
		fields = append(fields, data.NewField(k, nil, labelCols[k]))
	}

	frame := data.NewFrame("time_series_long", fields...)
	frame.Meta = &data.FrameMeta{Type: data.FrameTypeTimeSeriesLong}

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
